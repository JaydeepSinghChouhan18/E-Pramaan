import {
  AwardDecision,
  AwardDecisionStatus,
  BidComparisonItem,
  ComparativeEvaluationResult,
  CreateAwardDecisionPayload,
  DecisionReconstruction,
  AuditEventType,
  UserProfile,
  UserRole,
  RiskLevel,
  VerificationStatus,
  BidStatus,
  TenderStatus,
  NotificationType
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';

export class AwardsService {
  /**
   * Deterministic Multi-Criteria Decision Analysis (MCDA) & Comparative Evaluation Engine.
   * Evaluates ALL submitted applications belonging to a tender:
   * 1. Mandatory Eligibility Gate (Pass / Excluded)
   * 2. Technical & Statutory Compliance (40% Weight)
   * 3. Operational Experience & Age (20% Weight)
   * 4. Commercial Price Normalization (40% Weight: Lowest Eligible Bid / Quoted Bid * 100)
   * 5. Explainable Composite Scoring & Deterministic Ranking
   */
  static async computeTenderMCDAComparison(
    user: UserProfile,
    tenderId: string,
    options: { autoRunUnverified?: boolean; recordAuditEvent?: boolean } = {}
  ): Promise<ComparativeEvaluationResult> {
    if (!config.hasSupabaseConfigured()) {
      return {
        tenderId,
        evaluatedAt: new Date().toISOString(),
        evaluationVersion: 1,
        weights: { compliance: 40, experience: 20, price: 40 },
        totalBidsCount: 0,
        eligibleBidsCount: 0,
        excludedBidsCount: 0,
        lowestEligiblePrice: null,
        rankedBids: [],
        excludedBids: [],
        topRankedExplanation: null,
        existingDecision: null
      };
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch tender details with requirements
    const { data: tender, error: tErr } = await admin
      .from('tenders')
      .select(`
        id,
        tender_number,
        title,
        status,
        estimated_value,
        minimum_company_age_years,
        procuring_organization_id,
        created_by,
        tender_requirements (
          id,
          code,
          name,
          category,
          requirement_type,
          is_mandatory,
          weight,
          configuration
        )
      `)
      .eq('id', tenderId)
      .maybeSingle();

    if (tErr || !tender) {
      throw new AppError('Tender record not found for comparative evaluation.', 404, 'TENDER_NOT_FOUND');
    }

    // Authorization check
    const isAuthorized = user.role === UserRole.ADMIN ||
      user.role === UserRole.AUDITOR ||
      tender.created_by === user.id ||
      (user.organization?.id && tender.procuring_organization_id === user.organization.id);

    if (!isAuthorized) {
      throw new AppError('You are not authorized to evaluate comparative bids for this tender.', 403, 'FORBIDDEN');
    }

    // 2. Fetch all submitted/under-review bids for tender
    const { data: bids, error: bidsErr } = await admin
      .from('bids')
      .select(`
        id,
        bid_number,
        status,
        submitted_at,
        submission_notes,
        bid_amount,
        bidder_organization_id,
        bidder_organization:organizations (
          id,
          legal_name,
          identifier
        ),
        bid_documents (
          id,
          tender_requirement_id,
          document_name,
          metadata,
          verification_status
        )
      `)
      .eq('tender_id', tenderId)
      .neq('status', BidStatus.DRAFT)
      .neq('status', BidStatus.WITHDRAWN);

    if (bidsErr) {
      throw new AppError('Failed to retrieve bids for comparative evaluation', 500, 'DB_ERROR', bidsErr);
    }

    const reqs = (tender.tender_requirements || []) as Array<any>;
    const mandatoryReqs = reqs.filter(r => r.is_mandatory);
    const minCompanyAge = tender.minimum_company_age_years || 3;

    // Bulk verification execution if requested ("Generate AI Compliance Analysis")
    if (options.autoRunUnverified && bids && bids.length > 0) {
      for (const b of bids) {
        const { count } = await admin
          .from('verification_runs')
          .select('id', { count: 'exact', head: true })
          .eq('bid_id', b.id)
          .eq('is_latest', true);

        if (!count || count === 0) {
          try {
            await ComplianceService.runVerification(user, b.id);
          } catch (verifErr) {
            console.warn(`[computeTenderMCDAComparison] Note running verification for ${b.bid_number}:`, verifErr);
          }
        }
      }
    }

    const intermediateItems: BidComparisonItem[] = [];

    for (const b of bids || []) {
      const org = Array.isArray(b.bidder_organization) ? b.bidder_organization[0] : b.bidder_organization;
      const orgIdentifier = org?.identifier || '';
      const ineligibilityReasons: string[] = [];

      // Fetch latest verification run for this bid
      const { data: run } = await admin
        .from('verification_runs')
        .select('*')
        .eq('bid_id', b.id)
        .eq('is_latest', true)
        .maybeSingle();

      // Count open investigations
      const { count: openInvs } = await admin
        .from('investigations')
        .select('id', { count: 'exact', head: true })
        .eq('bid_id', b.id)
        .in('status', ['OPEN', 'IN_REVIEW', 'ACTION_REQUIRED']);

      // Fetch discrepancies
      const { data: discs } = run ? await admin
        .from('discrepancies')
        .select('id, code, title, description, severity')
        .eq('verification_run_id', run.id) : { data: [] };

      const score = run?.compliance_score?.overallScore ?? 0;
      const risk = (run?.risk_assessment?.riskLevel as RiskLevel) || RiskLevel.LOW;
      const mandComplied = run?.compliance_score?.mandatoryComplied ?? false;
      const mandMet = run?.compliance_score?.mandatoryMetCount ?? 0;
      const criticalDiscs = (discs || []).filter((d: any) => d.severity === 'CRITICAL');

      // Parse commercial bid amount
      let bidAmount: number | null = null;
      const rawBid = b as any;
      if (rawBid.bid_amount !== undefined && rawBid.bid_amount !== null) {
        bidAmount = Number(rawBid.bid_amount);
      } else if (b.submission_notes) {
        const match = b.submission_notes.match(/\[Bid Amount:\s*(?:INR\s*)?([0-9,.]+)/i);
        if (match && match[1]) {
          bidAmount = parseFloat(match[1].replace(/,/g, ''));
        }
      }

      // Mandatory Eligibility Gate Evaluation
      if (b.status === BidStatus.DISQUALIFIED) {
        ineligibilityReasons.push('Bid application formally disqualified');
      }

      if (!mandComplied) {
        ineligibilityReasons.push(`Failed mandatory statutory criteria (${mandMet}/${mandatoryReqs.length} met)`);
      }

      const attachedReqIds = new Set((b.bid_documents || []).map((d: any) => d.tender_requirement_id));
      for (const mr of mandatoryReqs) {
        if (!attachedReqIds.has(mr.id)) {
          ineligibilityReasons.push(`Missing mandatory requirement document: ${mr.code} (${mr.name})`);
        }
      }

      for (const cd of criticalDiscs) {
        ineligibilityReasons.push(`[Critical Discrepancy] ${cd.title}: ${cd.description}`);
      }

      if (bidAmount === null || bidAmount <= 0) {
        ineligibilityReasons.push('Commercial proposal missing or non-positive bid amount');
      }

      // Experience & Company Age Evaluation (Based strictly on verified evidence)
      let verifiedAge: number | null = null;
      let experienceScore = 0;
      let experienceEvidenceNote = 'Insufficient verified evidence';

      // 1. Try CIN parsing (characters 8-11 indicate incorporation year)
      const cinMatch = orgIdentifier.match(/^[LUu]\d{5}[A-Za-z]{2}(\d{4})/i);
      let incYear = cinMatch ? parseInt(cinMatch[1], 10) : null;

      // 2. Check attached document metadata/evidence if CIN did not yield year
      if (!incYear && b.bid_documents) {
        for (const doc of b.bid_documents) {
          const meta = (doc as any).metadata || {};
          if (meta.incorporationDate) {
            const dMatch = String(meta.incorporationDate).match(/(\d{4})/);
            if (dMatch) { incYear = parseInt(dMatch[1], 10); break; }
          }
          if (meta.cin) {
            const m = String(meta.cin).match(/^[LUu]\d{5}[A-Za-z]{2}(\d{4})/i);
            if (m) { incYear = parseInt(m[1], 10); break; }
          }
        }
      }

      const currentYear = new Date().getFullYear();
      if (incYear && incYear > 1900 && incYear <= currentYear) {
        verifiedAge = currentYear - incYear;
        if (verifiedAge >= minCompanyAge) {
          const bonus = Math.min(30, (verifiedAge - minCompanyAge) * 3);
          experienceScore = Math.min(100, 70 + bonus);
          experienceEvidenceNote = `Verified ${verifiedAge} yrs active operation (Est. ${incYear} via CIN ${orgIdentifier}) meets tender threshold (${minCompanyAge} yrs)`;
        } else {
          experienceScore = Math.round((verifiedAge / minCompanyAge) * 60);
          experienceEvidenceNote = `Entity age ${verifiedAge} yrs falls below tender minimum ${minCompanyAge} yrs`;
          ineligibilityReasons.push(`Entity age (${verifiedAge} yrs) falls below tender minimum requirement (${minCompanyAge} yrs)`);
        }
      } else {
        experienceScore = 0;
        experienceEvidenceNote = 'Insufficient verified evidence';
        const hasMandatoryAgeReq = mandatoryReqs.some((r: any) => r.code?.includes('AGE') || r.category === 'COMPANY');
        if (hasMandatoryAgeReq) {
          ineligibilityReasons.push('Insufficient verified experience evidence for mandatory company age threshold');
        }
      }

      const eligibilityStatus: 'PASS' | 'FAIL' = ineligibilityReasons.length === 0 ? 'PASS' : 'FAIL';

      intermediateItems.push({
        bidId: b.id,
        bidNumber: b.bid_number,
        bidderOrganizationId: b.bidder_organization_id,
        bidderOrganizationName: org?.legal_name || 'Anonymous Bidder',
        bidStatus: b.status as BidStatus,
        bidAmount,
        submittedAt: b.submitted_at,
        complianceScore: Number(score),
        riskLevel: risk,
        mandatoryComplied: mandComplied,
        mandatoryMetCount: mandMet,
        mandatoryTotalCount: mandatoryReqs.length,
        discrepanciesCount: (discs || []).length,
        criticalDiscrepanciesCount: criticalDiscs.length,
        openInvestigationsCount: openInvs || 0,
        verificationStatus: (run?.verification_status as VerificationStatus) || VerificationStatus.PENDING_VERIFICATION,
        evidenceCount: (b.bid_documents || []).length,

        // MCDA fields
        eligibilityStatus,
        ineligibilityReasons: ineligibilityReasons.length > 0 ? ineligibilityReasons : undefined,
        experienceYears: verifiedAge,
        experienceScore,
        experienceEvidenceNote,
        priceScore: 0,
        mcdaScore: 0,
        rank: null,
        mcdaWeights: { compliance: 40, experience: 20, price: 40 }
      });
    }

    // 3. Price Normalization across eligible bidders
    const eligibleBids = intermediateItems.filter(i => i.eligibilityStatus === 'PASS' && i.bidAmount && i.bidAmount > 0);
    const lowestEligiblePrice = eligibleBids.length > 0
      ? Math.min(...eligibleBids.map(i => i.bidAmount!))
      : null;

    for (const item of intermediateItems) {
      if (item.eligibilityStatus === 'PASS' && lowestEligiblePrice && item.bidAmount && item.bidAmount > 0) {
        item.priceScore = Math.round((lowestEligiblePrice / item.bidAmount) * 1000) / 10;
        const expScore = item.experienceScore ?? 0;
        item.mcdaScore = Math.round(
          ((item.complianceScore * 0.40) + (expScore * 0.20) + (item.priceScore * 0.40)) * 10
        ) / 10;
      } else {
        item.priceScore = 0;
        item.mcdaScore = 0;
      }
    }

    // 4. Deterministic Ranking for eligible bids
    eligibleBids.sort((a, b) => {
      // Priority 1: MCDA Score DESC
      const mcdaA = a.mcdaScore ?? 0;
      const mcdaB = b.mcdaScore ?? 0;
      if (mcdaB !== mcdaA) return mcdaB - mcdaA;

      // Priority 2: Price Score DESC (lower price breaks tie)
      const priceA = a.priceScore ?? 0;
      const priceB = b.priceScore ?? 0;
      if (priceB !== priceA) return priceB - priceA;

      // Priority 3: Compliance Score DESC
      if (b.complianceScore !== a.complianceScore) return b.complianceScore - a.complianceScore;

      // Priority 4: Submission time ASC (earlier submission breaks tie)
      const tA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tA - tB;
    });

    eligibleBids.forEach((item, index) => {
      item.rank = index + 1;
      item.rankingExplanation = `Rank #${index + 1}: Composite MCDA Score ${item.mcdaScore}/100 ` +
        `[Compliance 40%: ${item.complianceScore}, Experience 20%: ${item.experienceScore}, Price 40%: ${item.priceScore}]. ` +
        `Quoted Amount: INR ${item.bidAmount?.toLocaleString('en-IN')}.`;
    });

    const excludedBids = intermediateItems.filter(i => i.eligibilityStatus === 'FAIL');
    excludedBids.forEach(item => {
      item.rank = null;
      item.rankingExplanation = `Excluded from award ranking: ${item.ineligibilityReasons?.join('; ') || 'Failed mandatory criteria'}.`;
    });

    // 5. Generate Structured Explanation for Top Ranked (#1) Contender
    const topBid = eligibleBids[0];
    const topRankedExplanation = topBid ? {
      bidId: topBid.bidId,
      bidNumber: topBid.bidNumber,
      bidderName: topBid.bidderOrganizationName,
      rank: 1,
      mcdaScore: topBid.mcdaScore ?? 0,
      complianceScore: topBid.complianceScore ?? 0,
      experienceScore: topBid.experienceScore ?? 0,
      priceScore: topBid.priceScore ?? 0,
      bidAmount: topBid.bidAmount ?? null,
      lowestEligiblePrice,
      weights: { compliance: 40, experience: 20, price: 40 },
      keyVerifiedEvidence: [
        `Statutory Compliance: ${topBid.complianceScore}/100 with ${topBid.mandatoryMetCount}/${topBid.mandatoryTotalCount} mandatory requirements satisfied`,
        `Operational Experience: ${topBid.experienceEvidenceNote} (Score: ${topBid.experienceScore}/100)`,
        `Commercial Competitiveness: Quoted ₹${Number(topBid.bidAmount).toLocaleString('en-IN')} yielding normalized Price Score of ${topBid.priceScore}/100 (Benchmark lowest price: ₹${Number(lowestEligiblePrice).toLocaleString('en-IN')})`,
        `Integrity Verification: ${topBid.discrepanciesCount} discrepancies detected, Operational Risk: ${topBid.riskLevel}`
      ],
      riskLevel: topBid.riskLevel,
      discrepanciesCount: topBid.discrepanciesCount,
      summary: `Bidder ${topBid.bidderOrganizationName} achieves Rank #1 with a composite MCDA score of ${topBid.mcdaScore}/100 ` +
        `based on transparent multi-criteria weighting: Compliance (40%), Experience (20%), and Price (40%). ` +
        `Mathematical Verification: (${topBid.complianceScore} × 0.40) + (${topBid.experienceScore} × 0.20) + (${topBid.priceScore} × 0.40) = ${topBid.mcdaScore}/100.`
    } : null;

    // 6. Record Audit Event if requested
    if (options.recordAuditEvent) {
      await AuditService.logEvent({
        eventType: AuditEventType.AI_RECOMMENDATION_GENERATED,
        entityType: 'TENDER',
        entityId: tenderId,
        tenderId: tenderId,
        actorUserId: user.id,
        actorRole: user.role,
        description: `Generated AI Compliance & MCDA Comparative Analysis for tender ${tender.tender_number}.`,
        reason: 'Automated Multi-Criteria Decision Analysis & Statutory Evaluation',
        metadata: {
          evaluationVersion: 1,
          weights: { compliance: 0.40, experience: 0.20, price: 0.40 },
          totalBidsCount: intermediateItems.length,
          eligibleBidsCount: eligibleBids.length,
          excludedBidsCount: excludedBids.length,
          lowestEligiblePrice,
          topRankedBidId: topBid?.bidId,
          topRankedBidder: topBid?.bidderOrganizationName,
          topMcdaScore: topBid?.mcdaScore,
          rankedBids: eligibleBids.map(b => ({ rank: b.rank, bidNumber: b.bidNumber, org: b.bidderOrganizationName, mcda: b.mcdaScore, price: b.bidAmount })),
          excludedBids: excludedBids.map(b => ({ bidNumber: b.bidNumber, org: b.bidderOrganizationName, reasons: b.ineligibilityReasons }))
        }
      });
    }

    // 7. Existing Decision
    const existingDecision = await this.getDecisionByTenderId(user, tenderId).catch(() => null);

    return {
      tenderId,
      evaluatedAt: new Date().toISOString(),
      evaluationVersion: 1,
      weights: { compliance: 40, experience: 20, price: 40 },
      totalBidsCount: intermediateItems.length,
      eligibleBidsCount: eligibleBids.length,
      excludedBidsCount: excludedBids.length,
      lowestEligiblePrice,
      rankedBids: eligibleBids,
      excludedBids: excludedBids,
      topRankedExplanation,
      existingDecision
    };
  }

  /**
   * Comparative Bid Analysis for a tender.
   * Compares all submitted/under-review bids with their compliance scores, risk levels, and MCDA ranking.
   */
  static async getTenderBidComparison(user: UserProfile, tenderId: string): Promise<BidComparisonItem[]> {
    const result = await this.computeTenderMCDAComparison(user, tenderId, { autoRunUnverified: false });
    return [...result.rankedBids, ...result.excludedBids];
  }

  /**
   * Bulk AI Compliance Analysis trigger across all bids belonging to a selected tender.
   */
  static async generateAiComplianceAnalysis(user: UserProfile, tenderId: string): Promise<ComparativeEvaluationResult> {
    return this.computeTenderMCDAComparison(user, tenderId, { autoRunUnverified: true, recordAuditEvent: true });
  }

  /**
   * Create or update a human award decision with mandatory justification validation and AI MCDA override auditing.
   */
  static async recordAwardDecision(
    user: UserProfile,
    payload: CreateAwardDecisionPayload
  ): Promise<AwardDecision> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    // 1. Verify tender is not cancelled or already awarded
    const { data: tender, error: tErr } = await admin
      .from('tenders')
      .select('id, status, tender_number')
      .eq('id', payload.tenderId)
      .maybeSingle();

    if (tErr || !tender) {
      throw new AppError('Tender record not found', 404, 'TENDER_NOT_FOUND');
    }

    if (tender.status === TenderStatus.CANCELLED) {
      throw new AppError('Cannot record award decision for a CANCELLED tender.', 400, 'TENDER_CANCELLED');
    }

    if (tender.status === TenderStatus.AWARDED) {
      throw new AppError(
        'This tender has already been finalized and AWARDED. Award determinations are legally sealed and cannot be modified directly. An authorized officer must execute an explicit revocation/reopening with mandatory statutory justification.',
        400,
        'AWARD_ALREADY_FINALIZED'
      );
    }

    // 2. Fetch comparative bids to evaluate eligibility gate and MCDA Rank #1 override rule
    const comparativeResult = await this.computeTenderMCDAComparison(user, payload.tenderId, { autoRunUnverified: false });
    const allBids = [...comparativeResult.rankedBids, ...comparativeResult.excludedBids];
    const selected = allBids.find(b => b.bidId === payload.selectedBidId);

    if (!selected) {
      throw new AppError('Selected bid does not belong to this tender or is not found.', 400, 'INVALID_SELECTED_BID');
    }

    // Guard: Ineligible bidder cannot be awarded
    if (selected.eligibilityStatus === 'FAIL' && payload.decisionStatus === AwardDecisionStatus.APPROVED) {
      throw new AppError(
        `Cannot award contract to an ineligible bidder: ${selected.ineligibilityReasons?.join('; ') || 'Failed mandatory eligibility criteria'}.`,
        400,
        'INELIGIBLE_BIDDER_CANNOT_BE_AWARDED'
      );
    }

    // Check if selecting a bidder that is not Rank #1
    const topBidder = comparativeResult.rankedBids[0];
    const isAiOverridden = Boolean(topBidder && topBidder.bidId !== selected.bidId);

    if (isAiOverridden && !payload.justificationText && payload.decisionStatus === AwardDecisionStatus.APPROVED) {
      throw new AppError(
        `Selected bidder (${selected.bidderOrganizationName}) is not the Top-Ranked MCDA recommended contender (Rank #1 is ${topBidder.bidderOrganizationName} with MCDA score ${topBidder.mcdaScore}/100). A detailed statutory procurement justification is mandatory before overriding.`,
        400,
        'JUSTIFICATION_REQUIRED'
      );
    }

    // Upsert award decision
    const upsertData = {
      tender_id: payload.tenderId,
      selected_bid_id: payload.selectedBidId,
      selected_bidder_organization_id: selected.bidderOrganizationId,
      decision_status: payload.decisionStatus,
      selected_compliance_score: selected.complianceScore,
      selected_risk_level: selected.riskLevel,
      decision_reason: payload.decisionReason,
      clarification_required: payload.clarificationRequired ?? false,
      clarification_text: payload.clarificationText || null,
      justification_text: payload.justificationText || null,
      evidence_references: payload.evidenceReferences || [],
      decided_by: user.id,
      decided_at: new Date().toISOString()
    };

    const { data: decision, error: decErr } = await admin
      .from('award_decisions')
      .upsert(upsertData, { onConflict: 'tender_id' })
      .select()
      .single();

    if (decErr || !decision) {
      throw new AppError('Failed to record award decision', 500, 'DB_ERROR', decErr);
    }

    // If overriding Rank #1, persist to ai_overrides registry and append specific audit event
    if (isAiOverridden && payload.decisionStatus === AwardDecisionStatus.APPROVED && topBidder) {
      try {
        await admin.from('ai_overrides').insert({
          tender_id: payload.tenderId,
          bid_id: payload.selectedBidId,
          ai_recommendation_text: `MCDA Comparative Recommendation: Rank #1 ${topBidder.bidderOrganizationName} (Score: ${topBidder.mcdaScore}/100, Price: INR ${Number(topBidder.bidAmount || 0).toLocaleString('en-IN')})`,
          ai_recommendation_timestamp: comparativeResult.evaluatedAt || new Date().toISOString(),
          decision_taken: `Award approved to Rank #${selected.rank || 'N/A'} ${selected.bidderOrganizationName} (MCDA Score: ${selected.mcdaScore}/100)`,
          override_reason: payload.justificationText || payload.decisionReason,
          supporting_evidence_refs: payload.evidenceReferences || [],
          officer_user_id: user.id
        });
      } catch (err: any) {
        console.warn('Note recording ai_override record:', err?.message || err);
      }

      await AuditService.logEvent({
        eventType: AuditEventType.AI_RECOMMENDATION_OVERRIDDEN,
        entityType: 'AWARD_DECISION',
        entityId: decision.id,
        tenderId: payload.tenderId,
        bidId: payload.selectedBidId,
        actorUserId: user.id,
        actorRole: user.role,
        description: `Officer selected ${selected.bidderOrganizationName} (Rank #${selected.rank}) over MCDA Rank #1 contender ${topBidder.bidderOrganizationName}.`,
        reason: payload.justificationText || payload.decisionReason,
        metadata: {
          selectedBidId: selected.bidId,
          selectedRank: selected.rank,
          selectedMcdaScore: selected.mcdaScore,
          topRankedBidId: topBidder.bidId,
          topRankedBidder: topBidder.bidderOrganizationName,
          topMcdaScore: topBidder.mcdaScore
        }
      });
    }

    // If approved, transition tender status to AWARDED and notify all participating bidders
    if (payload.decisionStatus === AwardDecisionStatus.APPROVED) {
      await admin.from('tenders').update({ status: TenderStatus.AWARDED }).eq('id', payload.tenderId);
      await admin.from('bids').update({ status: BidStatus.QUALIFIED }).eq('id', payload.selectedBidId);

      const { data: tenderData } = await admin
        .from('tenders')
        .select('tender_number, title')
        .eq('id', payload.tenderId)
        .maybeSingle();
      const tenderTitle = tenderData?.title || 'Tender';
      const tenderNumber = tenderData?.tender_number || '';

      const { data: allBidsToNotify } = await admin
        .from('bids')
        .select('id, bid_number, submitted_by_user_id')
        .eq('tender_id', payload.tenderId);

      if (allBidsToNotify && allBidsToNotify.length > 0) {
        for (const b of allBidsToNotify) {
          if (!b.submitted_by_user_id) continue;
          if (b.id === payload.selectedBidId) {
            await NotificationsService.createNotification({
              recipientUserId: b.submitted_by_user_id,
              type: NotificationType.AWARD_PUBLISHED,
              title: 'Contract Award Decision - Selected',
              message: `Congratulations! Your bid ${b.bid_number} for tender '${tenderTitle}' (${tenderNumber}) has been finalized and selected for contract award.`,
              entityType: 'TENDER',
              entityId: payload.tenderId
            });
          } else {
            await NotificationsService.createNotification({
              recipientUserId: b.submitted_by_user_id,
              type: NotificationType.AWARD_DECISION_RECORDED,
              title: 'Tender Evaluation Finalized',
              message: `The evaluation for tender '${tenderTitle}' (${tenderNumber}) has been finalized. Your bid was not selected for award.`,
              entityType: 'TENDER',
              entityId: payload.tenderId
            });
          }
        }
      }
    } else if (payload.decisionStatus === AwardDecisionStatus.CLARIFICATION_REQUIRED) {
      const { data: selectedBid } = await admin
        .from('bids')
        .select('submitted_by_user_id, bid_number')
        .eq('id', payload.selectedBidId)
        .maybeSingle();

      if (selectedBid?.submitted_by_user_id) {
        await NotificationsService.createNotification({
          recipientUserId: selectedBid.submitted_by_user_id,
          type: NotificationType.DISCREPANCY_DETECTED,
          title: 'Clarification Required on Bid',
          message: `The procurement officer has requested clarification regarding your bid ${selectedBid.bid_number}: ${payload.clarificationText || payload.decisionReason}`,
          entityType: 'BID',
          entityId: payload.selectedBidId
        });
      }
    }

    // Append to audit trail
    await AuditService.logEvent({
      eventType: payload.decisionStatus === AwardDecisionStatus.APPROVED
        ? AuditEventType.AWARD_APPROVED
        : AuditEventType.AWARD_DECISION_CREATED,
      entityType: 'AWARD_DECISION',
      entityId: decision.id,
      tenderId: payload.tenderId,
      bidId: payload.selectedBidId,
      actorUserId: user.id,
      actorRole: user.role,
      description: `Award decision recorded with status '${payload.decisionStatus}' for bid ${selected.bidNumber}.`,
      reason: payload.justificationText || payload.decisionReason,
      metadata: { complianceScore: selected.complianceScore, riskLevel: selected.riskLevel, mcdaScore: selected.mcdaScore, rank: selected.rank }
    });

    return {
      id: decision.id,
      tenderId: decision.tender_id,
      selectedBidId: decision.selected_bid_id,
      selectedBidderOrganizationId: decision.selected_bidder_organization_id,
      decisionStatus: decision.decision_status as AwardDecisionStatus,
      selectedComplianceScore: Number(decision.selected_compliance_score),
      selectedRiskLevel: decision.selected_risk_level as RiskLevel,
      decisionReason: decision.decision_reason,
      clarificationRequired: decision.clarification_required,
      clarificationText: decision.clarification_text,
      justificationText: decision.justification_text,
      evidenceReferences: decision.evidence_references,
      decidedByUserId: decision.decided_by,
      decidedAt: decision.decided_at,
      createdAt: decision.created_at,
      updatedAt: decision.updated_at
    };
  }

  /**
   * Get complete Decision Reconstruction Dossier answering:
   * "Why was Bidder B selected over Bidder A?"
   */
  static async getDecisionReconstruction(user: UserProfile, decisionId: string): Promise<DecisionReconstruction> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const { data: dec, error: decErr } = await admin
      .from('award_decisions')
      .select(`
        *,
        tender:tenders (
          id,
          tender_number,
          title
        ),
        bid:bids (
          id,
          bid_number
        ),
        organization:organizations (
          id,
          legal_name
        ),
        decider:users (
          id,
          full_name
        )
      `)
      .eq('id', decisionId)
      .maybeSingle();

    if (decErr || !dec) {
      throw new AppError('Award decision record not found', 404, 'NOT_FOUND');
    }

    const tender = Array.isArray(dec.tender) ? dec.tender[0] : dec.tender;
    const bid = Array.isArray(dec.bid) ? dec.bid[0] : dec.bid;
    const org = Array.isArray(dec.organization) ? dec.organization[0] : dec.organization;
    const decider = Array.isArray(dec.decider) ? dec.decider[0] : dec.decider;

    // Fetch all compared bidders for the tender
    const comparedBidders = await this.getTenderBidComparison(user, dec.tender_id);

    // Fetch AI overrides if any
    const aiOverrides = await AuditService.listAIOverrides({ tenderId: dec.tender_id });
    const matchingOverride = aiOverrides.find(o => o.bidId === dec.selected_bid_id) || null;

    // Fetch audit timeline
    const auditTimeline = await AuditService.listAuditEvents(user, { tenderId: dec.tender_id });

    // Fetch latest verification run for AI summary
    const { data: run } = await admin
      .from('verification_runs')
      .select('ai_recommendation')
      .eq('bid_id', dec.selected_bid_id)
      .eq('is_latest', true)
      .maybeSingle();

    return {
      decision: {
        id: dec.id,
        tenderId: dec.tender_id,
        selectedBidId: dec.selected_bid_id,
        selectedBidderOrganizationId: dec.selected_bidder_organization_id,
        decisionStatus: dec.decision_status as AwardDecisionStatus,
        selectedComplianceScore: Number(dec.selected_compliance_score),
        selectedRiskLevel: dec.selected_risk_level as RiskLevel,
        decisionReason: dec.decision_reason,
        clarificationRequired: dec.clarification_required,
        clarificationText: dec.clarification_text,
        justificationText: dec.justification_text,
        evidenceReferences: dec.evidence_references,
        decidedByUserId: dec.decided_by,
        decidedAt: dec.decided_at,
        createdAt: dec.created_at,
        updatedAt: dec.updated_at
      },
      tenderNumber: tender?.tender_number || 'N/A',
      tenderTitle: tender?.title || 'N/A',
      selectedBidderName: org?.legal_name || 'Selected Bidder',
      selectedBidNumber: bid?.bid_number || 'N/A',
      decidedByName: decider?.full_name || 'Procurement Officer',
      comparedBidders,
      justificationProvided: Boolean(dec.justification_text),
      lessFavorableWarningTriggered: Boolean(dec.justification_text),
      aiRecommendationSummary: run?.ai_recommendation?.summary,
      aiOverrideRecord: matchingOverride,
      auditTimeline
    };
  }

  /**
   * Get award decision by tender id.
   */
  static async getDecisionByTenderId(_user: UserProfile, tenderId: string): Promise<AwardDecision | null> {
    if (!config.hasSupabaseConfigured()) return null;

    const admin = getSupabaseAdminClient();
    const { data: dec } = await admin
      .from('award_decisions')
      .select('*')
      .eq('tender_id', tenderId)
      .maybeSingle();

    if (!dec) return null;

    return {
      id: dec.id,
      tenderId: dec.tender_id,
      selectedBidId: dec.selected_bid_id,
      selectedBidderOrganizationId: dec.selected_bidder_organization_id,
      decisionStatus: dec.decision_status as AwardDecisionStatus,
      selectedComplianceScore: Number(dec.selected_compliance_score),
      selectedRiskLevel: dec.selected_risk_level as RiskLevel,
      decisionReason: dec.decision_reason,
      clarificationRequired: dec.clarification_required,
      clarificationText: dec.clarification_text,
      justificationText: dec.justification_text,
      evidenceReferences: dec.evidence_references,
      decidedByUserId: dec.decided_by,
      decidedAt: dec.decided_at,
      createdAt: dec.created_at,
      updatedAt: dec.updated_at
    };
  }

  /**
   * Bidder Transparency Endpoint:
   * Provides non-confidential comparative matrix explaining why a bidder was selected for an awarded tender.
   * Redacts private competitor PANs, sensitive financial documents, and internal vigilance notes.
   */
  static async getBidderTransparency(user: UserProfile, tenderId: string) {
    if (!config.hasSupabaseConfigured()) return null;
    const admin = getSupabaseAdminClient();

    // 1. Fetch Tender
    const { data: tender } = await admin
      .from('tenders')
      .select('id, tender_number, title, status')
      .eq('id', tenderId)
      .maybeSingle();

    if (!tender) return null;

    // 2. Fetch award decision
    const { data: dec } = await admin
      .from('award_decisions')
      .select(`
        *,
        organization:organizations (
          id,
          legal_name
        ),
        bid:bids (
          id,
          bid_number,
          bid_amount,
          submission_notes
        )
      `)
      .eq('tender_id', tenderId)
      .maybeSingle();

    if (!dec || dec.decision_status !== AwardDecisionStatus.APPROVED) {
      return {
        awarded: false,
        tenderId,
        tenderTitle: tender.title,
        tenderNumber: tender.tender_number,
        message: 'Award decision has not been finalized yet for this tender.'
      };
    }

    const winningOrg = Array.isArray(dec.organization) ? dec.organization[0] : dec.organization;
    const winningBid = Array.isArray(dec.bid) ? dec.bid[0] : dec.bid;

    let winningAmount: number | null = null;
    if (winningBid?.bid_amount) {
      winningAmount = Number(winningBid.bid_amount);
    } else if (winningBid?.submission_notes) {
      const m = winningBid.submission_notes.match(/\[Bid Amount:\s*(?:INR\s*)?([0-9,.]+)/i);
      if (m && m[1]) winningAmount = parseFloat(m[1].replace(/,/g, ''));
    }

    // 3. Fetch user's own bid for this tender
    const myOrgId = user.organization?.id;
    let myBidInfo: any = null;

    if (myOrgId) {
      const { data: myBid } = await admin
        .from('bids')
        .select(`
          id,
          bid_number,
          status,
          bid_amount,
          submission_notes,
          verification_runs (
            id,
            compliance_score,
            risk_level,
            is_latest
          )
        `)
        .eq('tender_id', tenderId)
        .eq('bidder_organization_id', myOrgId)
        .maybeSingle();

      if (myBid) {
        let myAmount: number | null = null;
        if (myBid.bid_amount) {
          myAmount = Number(myBid.bid_amount);
        } else if (myBid.submission_notes) {
          const m = myBid.submission_notes.match(/\[Bid Amount:\s*(?:INR\s*)?([0-9,.]+)/i);
          if (m && m[1]) myAmount = parseFloat(m[1].replace(/,/g, ''));
        }

        const latestRun = (myBid.verification_runs || []).find((r: any) => r.is_latest) || myBid.verification_runs?.[0];

        myBidInfo = {
          bidNumber: myBid.bid_number,
          status: myBid.status,
          bidAmount: myAmount,
          complianceScore: latestRun ? Number(latestRun.compliance_score) : null,
          riskLevel: latestRun ? latestRun.risk_level : null
        };
      }
    }

    const isWinner = myOrgId && dec.selected_bidder_organization_id === myOrgId;

    return {
      awarded: true,
      tenderId,
      tenderTitle: tender.title,
      tenderNumber: tender.tender_number,
      winningBidderName: winningOrg?.legal_name || 'Selected Entity',
      isCurrentUserWinner: Boolean(isWinner),
      isMyBidWinner: Boolean(isWinner),
      awardedAmount: winningAmount,
      winningBidAmount: winningAmount,
      complianceScore: Number(dec.selected_compliance_score),
      decisionReason: dec.decision_reason,
      justificationText: dec.justification_text,
      decidedAt: dec.decided_at,
      awardedAt: dec.decided_at,
      comparison: {
        winning: {
          score: Number(dec.selected_compliance_score),
          riskLevel: dec.selected_risk_level,
          entityName: winningOrg?.legal_name || 'Selected Entity'
        },
        myBid: myBidInfo
      }
    };
  }

  /**
   * Explicitly revoke an awarded tender decision and reopen for re-evaluation.
   * Mandates statutory procurement justification and records an immutable audit event.
   */
  static async revokeAwardDecision(
    user: UserProfile,
    tenderId: string,
    justification: string
  ): Promise<{ message: string; tenderId: string; revokedAt: string }> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    if (!justification || justification.trim().length < 20) {
      throw new AppError(
        'Mandatory statutory requirement: You must provide a comprehensive justification (minimum 20 characters) explaining the legal, technical, or procedural basis for revoking a finalized contract award.',
        400,
        'JUSTIFICATION_INSUFFICIENT'
      );
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch tender and existing decision
    const { data: tender, error: tErr } = await admin
      .from('tenders')
      .select('id, tender_number, title, status')
      .eq('id', tenderId)
      .maybeSingle();

    if (tErr || !tender) {
      throw new AppError('Tender record not found', 404, 'TENDER_NOT_FOUND');
    }

    if (tender.status !== TenderStatus.AWARDED) {
      throw new AppError('Only tenders in AWARDED status can be revoked or reopened.', 400, 'TENDER_NOT_AWARDED');
    }

    const { data: existingDecision } = await admin
      .from('award_decisions')
      .select('*')
      .eq('tender_id', tenderId)
      .maybeSingle();

    // 2. Revert tender status to UNDER_EVALUATION
    const revertedStatus = TenderStatus.UNDER_EVALUATION;
    await admin.from('tenders').update({ status: revertedStatus }).eq('id', tenderId);

    // 3. Mark award decision as revoked / draft
    if (existingDecision) {
      await admin.from('award_decisions').update({
        decision_status: AwardDecisionStatus.DRAFT,
        clarification_required: true,
        clarification_text: `[AWARD REVOKED BY ${user.fullName || user.email} ON ${new Date().toISOString()}]: ${justification}`
      }).eq('id', existingDecision.id);
    }

    // 4. Record critical audit event
    await admin.from('audit_events').insert({
      event_type: 'AWARD_DECISION_REVOKED',
      entity_type: 'TENDER',
      entity_id: tenderId,
      actor_user_id: user.id,
      actor_role: user.role,
      action: 'REVOKE_AWARD',
      details: {
        tenderNumber: tender.tender_number,
        revokedBy: user.email,
        justification,
        previousDecisionId: existingDecision?.id || null,
        revertedToStatus: revertedStatus
      }
    });

    // 5. Notify participating bidders
    const { data: allBids } = await admin
      .from('bids')
      .select('id, bid_number, submitted_by_user_id')
      .eq('tender_id', tenderId);

    if (allBids && allBids.length > 0) {
      for (const b of allBids) {
        if (!b.submitted_by_user_id) continue;
        await NotificationsService.createNotification({
          recipientUserId: b.submitted_by_user_id,
          type: NotificationType.SYSTEM_ALERT,
          title: `Contract Award Reopened: Tender ${tender.tender_number}`,
          message: `The finalized award determination for tender '${tender.title}' (${tender.tender_number}) has been officially reopened for review under statutory oversight. Status has reverted to ${revertedStatus}.`,
          entityType: 'TENDER',
          entityId: tenderId
        });
      }
    }

    return {
      message: 'Award decision successfully revoked and tender reopened for re-evaluation.',
      tenderId,
      revokedAt: new Date().toISOString()
    };
  }
}
