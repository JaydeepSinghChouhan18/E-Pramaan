import {
  UserProfile,
  UserRole,
  AIAssistantResponse,
  TenderAISummary,
  SupportedLanguage,
  IntegrationSourceHealth,
  IntegrationStatus
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { config } from '../../config/env.js';

export class AIAssistantService {
  private static isAIConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private static async callGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);
      if (!res.ok) return null;

      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return candidateText ? candidateText.trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Answer a grounded procurement or tender inquiry strictly using real persisted data.
   * Never leaks cross-bidder or officer-internal intelligence to bidders.
   */
  static async queryAssistant(
    user: UserProfile,
    prompt: string,
    tenderId?: string,
    bidId?: string,
    language: SupportedLanguage = SupportedLanguage.EN
  ): Promise<AIAssistantResponse> {
    const isAvailable = this.isAIConfigured();
    const groundedReferences: Array<{ type: string; id: string; title: string; url?: string }> = [];

    let contextSummary = '';
    const isOfficer = [UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR].includes(user.role);

    if (config.hasSupabaseConfigured()) {
      const admin = getSupabaseAdminClient();

      if (tenderId) {
        const { data: tender } = await admin
          .from('tenders')
          .select(`
            id,
            tender_number,
            title,
            description,
            status,
            publication_date,
            submission_deadline,
            opening_date,
            estimated_value,
            tender_requirements (
              id,
              code,
              name,
              category,
              is_mandatory
            )
          `)
          .eq('id', tenderId)
          .maybeSingle();

        if (tender) {
          contextSummary += `Tender: ${tender.tender_number} - "${tender.title}" (Status: ${tender.status}). Submission Deadline: ${tender.submission_deadline || 'N/A'}. Estimated Value: INR ${tender.estimated_value || 'Not Disclosed'}. Scope: ${tender.description || 'N/A'}.\n`;
          groundedReferences.push({
            type: 'TENDER',
            id: tender.id,
            title: `Tender ${tender.tender_number}`,
            url: isOfficer ? `/officer/tenders/${tender.id}` : `/bidder/tenders/${tender.id}`
          });

          const reqs = (tender as any).tender_requirements || [];
          if (reqs.length > 0) {
            const reqList = reqs
              .map((r: any) => `[${r.code}] ${r.name} (Mandatory: ${r.is_mandatory})`)
              .join('; ');
            contextSummary += `Requirements: ${reqList}\n`;
          }
        }
      }

      if (bidId) {
        const bidQuery = admin
          .from('bids')
          .select(`
            id,
            bid_number,
            status,
            bid_amount,
            submitted_at,
            bidder_organization_id,
            tender_id,
            bidder_organization:organizations (
              id,
              legal_name,
              identifier
            ),
            verification_runs (
              id,
              verification_status,
              compliance_score,
              risk_assessment,
              is_latest
            )
          `)
          .eq('id', bidId);

        if (!isOfficer) {
          if (!user.organization?.id) {
            throw new Error('Bidder without associated organization cannot query bid context');
          }
          bidQuery.eq('bidder_organization_id', user.organization.id);
        }

        const { data: bid } = await bidQuery.maybeSingle();

        if (bid) {
          const org = Array.isArray(bid.bidder_organization) ? bid.bidder_organization[0] : bid.bidder_organization;
          const runs = (bid as any).verification_runs || [];
          const latestRun = runs.find((r: any) => r.is_latest) || runs[0];

          contextSummary += `Bid: ${bid.bid_number} submitted by ${org?.legal_name || 'Organization'}. Status: ${bid.status}. Bid Amount: INR ${bid.bid_amount || 'N/A'}.\n`;
          if (latestRun) {
            const overallScore = latestRun.compliance_score?.overallScore ?? latestRun.compliance_score ?? 'N/A';
            const riskLevel = latestRun.risk_assessment?.riskLevel ?? latestRun.risk_level ?? 'N/A';
            contextSummary += `Verification Status: ${latestRun.verification_status}. Compliance Score: ${overallScore}/100. Risk Level: ${riskLevel}.\n`;
          }
          groundedReferences.push({
            type: 'BID',
            id: bid.id,
            title: `Bid ${bid.bid_number}`,
            url: isOfficer ? `/officer/bids/review` : `/bidder/applications/${bid.id}`
          });

          if (isOfficer) {
            const { data: discrepancies } = await admin
              .from('discrepancies')
              .select('id, code, title, description, severity')
              .eq('bid_id', bid.id);

            if (discrepancies && discrepancies.length > 0) {
              contextSummary += `Discrepancies (${discrepancies.length}): ` +
                discrepancies.map((d: any) => `[${d.severity}] ${d.title}: ${d.description}`).join('; ') + '\n';
              for (const d of discrepancies.slice(0, 3)) {
                groundedReferences.push({
                  type: 'DISCREPANCY',
                  id: d.id,
                  title: `Discrepancy: ${d.title}`
                });
              }
            }
          }
        }
      }

      // Persist AI interaction audit record
      try {
        await admin.from('ai_interactions').insert({
          user_id: user.id,
          role: user.role,
          context_type: 'ASSISTANT',
          context_id: tenderId || bidId || null,
          provider: isAvailable ? 'GOOGLE_GEMINI' : 'NONE',
          model: isAvailable ? 'gemini-1.5-pro' : 'NONE',
          status: isAvailable ? 'SUCCESS' : 'AI_UNAVAILABLE'
        });
      } catch {
        // non-blocking
      }
    }

    // High-Precision Deterministic Database Fact Routing
    const lowerPrompt = prompt.toLowerCase();
    if (tenderId && contextSummary) {
      if (lowerPrompt.includes('mandatory') || lowerPrompt.includes('eligib')) {
        const reqLines = contextSummary
          .split('\n')
          .find(l => l.startsWith('Requirements:'));
        const directFact = `### Mandatory Eligibility Criteria (Grounded in Verified Tender Records)\n\n` +
          (reqLines ? reqLines.replace('Requirements:', '').trim().split('; ').map((r, i) => `${i + 1}. **${r}**`).join('\n') : 'No mandatory requirements specified in tender notice.') +
          `\n\n**Statutory GFR 2017 Rule 173(i) Compliance**: Failure to satisfy any mandatory eligibility requirement results in technical disqualification before financial opening.`;
        return {
          answer: directFact,
          status: 'SUCCESS',
          groundedReferences,
          provider: 'DATABASE_GROUNDED',
          model: 'database-facts-v1',
          language,
          timestamp: new Date().toISOString()
        };
      }

      if (lowerPrompt.includes('document') || lowerPrompt.includes('checklist') || lowerPrompt.includes('evidence') || lowerPrompt.includes('attach')) {
        const reqLines = contextSummary
          .split('\n')
          .find(l => l.startsWith('Requirements:'));
        const directFact = `### Statutory Document Checklist (Grounded in Verified Tender Records)\n\n` +
          (reqLines ? reqLines.replace('Requirements:', '').trim().split('; ').map((r, i) => `${i + 1}. [Credential Code] **${r}**`).join('\n') : 'No document requirements specified.') +
          `\n\n*Documents uploaded to your Bidder Document Vault will be verified via native text parsing and sovereign SHA-256 hash checks.*`;
        return {
          answer: directFact,
          status: 'SUCCESS',
          groundedReferences,
          provider: 'DATABASE_GROUNDED',
          model: 'database-facts-v1',
          language,
          timestamp: new Date().toISOString()
        };
      }
    }

    if (isAvailable && contextSummary) {
      const systemPrompt = `You are the e-Pramaan Procurement AI Assistant for Indian Sovereign Public Procurement.
Answer strictly based on the provided procurement records.
Distinguish clearly between:
1. VERIFIED DATABASE FACTS: What is confirmed by the system records.
2. ADVISORY / REGULATORY INTERPRETATION: Guidance under Indian General Financial Rules (GFR 2017) and CVC guidelines.
Never speculate or hallucinate. If details are not present in the provided context, state that clearly.`;

      const userPrompt = `Context:
${contextSummary}

User Inquiry: ${prompt}
User Role: ${user.role}
Language: ${language}`;

      const geminiText = await this.callGemini(systemPrompt, userPrompt);
      if (geminiText) {
        return {
          answer: geminiText,
          status: 'SUCCESS',
          groundedReferences,
          provider: 'GOOGLE_GEMINI',
          model: 'gemini-1.5-flash',
          language,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Grounded factual procurement response computed directly from database
    let factualAnswer = `### Verified Procurement Database Records\n\n`;
    if (contextSummary) {
      factualAnswer += `${contextSummary}\n`;
      if (prompt.toLowerCase().includes('mandatory') || prompt.toLowerCase().includes('eligibility')) {
        factualAnswer += `\n**Eligibility Rule**: Bidders must satisfy all mandatory statutory thresholds (PAN, GSTIN, and MSME/Udyam certificates) to qualify for financial evaluation under GFR Rule 173.`;
      } else if (prompt.toLowerCase().includes('discrepanc') || prompt.toLowerCase().includes('risk')) {
        factualAnswer += `\n**Integrity Rule**: Any detected mismatch (e.g. PAN name vs GST trade name) triggers automated discrepancy flags and elevates the vendor's risk level to HIGH/MEDIUM in accordance with procurement compliance policies.`;
      } else {
        factualAnswer += `\n**Procedural Rule**: Proceed with standard automated verification run to evaluate statutory compliance and risk parameters.`;
      }
      if (!isAvailable) {
        factualAnswer += `\n\n*(Note: Live Gemini LLM is currently unconfigured. Responses are strictly grounded in verified database records).*`;
      }
    } else {
      factualAnswer += `No specific procurement context selected. Please select a tender or bid from the dropdown above to analyze its compliance criteria, requirement breakdown, and verification history.`;
    }

    return {
      answer: factualAnswer,
      status: contextSummary ? 'SUCCESS' : 'INSUFFICIENT_EVIDENCE',
      groundedReferences,
      provider: isAvailable ? 'DATABASE_GROUNDED' : 'UNCONFIGURED_FALLBACK',
      model: 'database-facts-v1',
      language,
      timestamp: new Date().toISOString()
    };
  }

  static async getTenderAISummary(tenderId: string): Promise<TenderAISummary> {
    const isAvailable = this.isAIConfigured();

    if (!config.hasSupabaseConfigured()) {
      return {
        tenderId,
        tenderNumber: 'TEN-DRAFT',
        title: 'Draft Tender Notice',
        purposeAndScope: 'Procurement details unavailable in local mode.',
        keyEligibilityCriteria: [],
        mandatoryRequirements: [],
        importantDates: [],
        requiredDocuments: [],
        complianceAreas: [],
        warningsAndConditions: [],
        status: 'AI_UNAVAILABLE',
        generatedAt: new Date().toISOString()
      };
    }

    const admin = getSupabaseAdminClient();
    const { data: tender, error } = await admin
      .from('tenders')
      .select(`
        id,
        tender_number,
        title,
        description,
        status,
        publication_date,
        submission_deadline,
        opening_date,
        estimated_value,
        currency,
        tender_requirements (
          id,
          code,
          name,
          category,
          is_mandatory
        )
      `)
      .eq('id', tenderId)
      .maybeSingle();

    if (error || !tender) {
      throw new Error('Tender not found');
    }

    const reqs = (tender as any).tender_requirements || [];
    const mandatory = reqs.filter((r: any) => r.is_mandatory).map((r: any) => `[${r.code}] ${r.name}`);
    const keyEligibility = reqs.slice(0, 5).map((r: any) => `${r.name} (${r.category})`);
    const requiredDocs = Array.from(
      new Set(reqs.map((r: any) => r.category).filter(Boolean))
    ).map((c) => `${c} compliance certificate / proof`);

    const importantDates: Array<{ label: string; date: string }> = [];
    if (tender.publication_date) {
      importantDates.push({ label: 'Publication Date', date: tender.publication_date });
    }
    if (tender.submission_deadline) {
      importantDates.push({ label: 'Submission Deadline', date: tender.submission_deadline });
    }
    if (tender.opening_date) {
      importantDates.push({ label: 'Opening Date', date: tender.opening_date });
    }

    let purposeAndScope = tender.description || 'Government procurement notice for supplied goods/services.';

    // If Gemini is available, synthesize a refined executive summary
    if (isAvailable && tender.title) {
      const summarySystemPrompt = `You are a Senior Government Procurement Officer drafting an Executive Tender Summary. Summarize the following tender objectively in 2-3 concise sentences based on scope and value.`;
      const summaryUserPrompt = `Tender Number: ${tender.tender_number}\nTitle: ${tender.title}\nScope: ${tender.description || 'Not provided'}\nEstimated Value: ${tender.currency || 'INR'} ${tender.estimated_value || 'Not Disclosed'}\nMandatory Criteria: ${mandatory.join(', ') || 'Standard GFR requirements'}`;
      const aiGeneratedScope = await this.callGemini(summarySystemPrompt, summaryUserPrompt);
      if (aiGeneratedScope) {
        purposeAndScope = aiGeneratedScope;
      }
    }

    return {
      tenderId: tender.id,
      tenderNumber: tender.tender_number,
      title: tender.title,
      purposeAndScope,
      keyEligibilityCriteria: keyEligibility.length > 0 ? keyEligibility : ['Standard General Financial Rules (GFR) eligibility criteria apply.'],
      mandatoryRequirements: mandatory.length > 0 ? mandatory : ['All statutory declarations and technical compliance criteria.'],
      importantDates,
      requiredDocuments: requiredDocs.length > 0 ? requiredDocs : ['PAN, GSTIN Registration, Audited Financial Statements, and Experience Certificate'],
      complianceAreas: ['Statutory Tax Compliance', 'Financial Solvency', 'Technical Experience', 'No-Debarment Undertaking'],
      warningsAndConditions: [
        'Discrepancies between self-declared parameters and sovereign database records will trigger automated risk flags.',
        'Late submissions cannot be accepted under GFR 2017 Rule 161.'
      ],
      status: 'AVAILABLE',
      generatedAt: new Date().toISOString()
    };
  }

  static getIntegrationHealth(): IntegrationSourceHealth[] {
    const hasGovCredentials = Boolean(process.env.GOV_GATEWAY_API_KEY || process.env.SANDBOX_ENABLED);

    return [
      {
        sourceId: 'GSTN',
        sourceName: 'Goods and Services Tax Network (GSTN)',
        category: 'Tax & Corporate Identification',
        status: hasGovCredentials ? IntegrationStatus.SANDBOX : IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Verifies active GSTIN status, filing cadence (GSTR-1, GSTR-3B), and legal business name directly with GST authorities.'
      },
      {
        sourceId: 'INCOME_TAX_PAN',
        sourceName: 'Income Tax Department (PAN Verification)',
        category: 'Direct Tax & Entity Identification',
        status: hasGovCredentials ? IntegrationStatus.SANDBOX : IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Confirms PAN validity, entity constitution, and ITR verification reference numbers.'
      },
      {
        sourceId: 'MCA21',
        sourceName: 'Ministry of Corporate Affairs (MCA21)',
        category: 'Corporate Registry',
        status: IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Retrieves Company CIN/LLPIN, active director identification numbers (DIN), and charges/debts registry.'
      },
      {
        sourceId: 'UDYAM',
        sourceName: 'Ministry of MSME (Udyam Registry)',
        category: 'MSME Classification',
        status: IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Authenticates Micro, Small, and Medium Enterprise status for statutory tender fee exemptions and purchase preferences.'
      },
      {
        sourceId: 'EPFO',
        sourceName: 'Employees Provident Fund Organisation (EPFO)',
        category: 'Labor & Social Security',
        status: IntegrationStatus.UNAVAILABLE,
        canVerify: false,
        description: 'Validates establishment registration code and monthly electronic challan compliance history.'
      },
      {
        sourceId: 'ESIC',
        sourceName: 'Employees State Insurance Corporation (ESIC)',
        category: 'Labor & Social Security',
        status: IntegrationStatus.UNAVAILABLE,
        canVerify: false,
        description: 'Confirms statutory employer insurance coverage for contractual and permanent personnel.'
      },
      {
        sourceId: 'DPIIT',
        sourceName: 'Department for Promotion of Industry and Internal Trade (DPIIT)',
        category: 'Startup Recognition',
        status: IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Verifies DPIIT startup recognition for prior turnover and experience exemption qualifications.'
      },
      {
        sourceId: 'DIGILOCKER',
        sourceName: 'National DigiLocker Sovereign Gateway',
        category: 'Document Authentication',
        status: IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Authenticates cryptographically issued government documents directly from sovereign issuing departments.'
      },
      {
        sourceId: 'CPPP_DEBARMENT',
        sourceName: 'Central Public Procurement Portal Debarment / Blacklist',
        category: 'Vendor Integrity & Debarment',
        status: IntegrationStatus.ACCESS_PENDING,
        canVerify: false,
        description: 'Checks entity against sovereign banned/debarred vendor records under GFR Rule 151.'
      }
    ];
  }
}
