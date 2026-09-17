import {
  VerificationRun,
  BidderVerificationSummary,
  RunStatus,
  UserProfile,
  UserRole,
  VerificationStatus,
  Discrepancy
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';
import { DocumentIntelligenceService } from './documentIntelligence.js';
import { GovernmentVerificationGateway } from './governmentGateway.js';
import { AIGateway } from './aiGateway.js';
import { ComplianceRulesEngine } from './complianceEngine.js';

export class ComplianceService {
  /**
   * Start or execute a new verification run for a submitted bid application.
   */
  static async runVerification(user: UserProfile, bidId: string): Promise<VerificationRun> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch bid details with tender requirements and documents
    const { data: bid, error: bidErr } = await admin
      .from('bids')
      .select(`
        *,
        tender:tenders (
          id,
          tender_number,
          procuring_organization_id,
          created_by,
          minimum_company_age_years,
          tender_requirements (*)
        ),
        bidder_organization:organizations (
          id,
          legal_name,
          identifier
        ),
        bid_documents (*)
      `)
      .eq('id', bidId)
      .maybeSingle();

    if (bidErr || !bid) {
      throw new AppError('Bid application not found.', 404, 'BID_NOT_FOUND');
    }

    // Authorization: Only authorized officers, admins, or auditors can execute a verification run
    const isProcuringOfficer = user.role === UserRole.OFFICER && (
      (user.organization?.id && bid.tender?.procuring_organization_id === user.organization.id) ||
      bid.tender?.created_by === user.id
    );
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isProcuringOfficer && !isAdmin) {
      throw new AppError('Only authorized procurement officers may trigger formal bid verification.', 403, 'FORBIDDEN');
    }

    // 2. Mark previous verification runs as is_latest = false
    await admin
      .from('verification_runs')
      .update({ is_latest: false })
      .eq('bid_id', bidId);

    // 3. Document Intelligence pipeline on attached documents
    const docs = bid.bid_documents || [];
    const processedDocuments = [];

    for (const doc of docs) {
      const extraction = await DocumentIntelligenceService.extractEvidenceFromDocument({
        id: doc.id,
        documentName: doc.document_name,
        mimeType: doc.mime_type,
        fileSize: Number(doc.file_size || 0),
        sha256Hash: doc.sha256_hash,
        metadata: doc.metadata,
        storagePath: doc.storage_path
      });

      // Persist extracted evidence record
      await admin.from('extracted_evidence').insert({
        bid_document_id: doc.id,
        bid_id: bidId,
        provider: extraction.provider,
        status: extraction.status,
        fields: extraction.fields,
        raw_snippet: extraction.rawSnippet
      });

      // Update document verification status and sha256_hash in database
      const updateDocData: Record<string, any> = { verification_status: VerificationStatus.VERIFIED };
      if (extraction.sha256Hash && !doc.sha256_hash) {
        updateDocData.sha256_hash = extraction.sha256Hash;
      }
      await admin
        .from('bid_documents')
        .update(updateDocData)
        .eq('id', doc.id);

      processedDocuments.push({
        id: doc.id,
        tenderRequirementId: doc.tender_requirement_id,
        documentName: doc.document_name,
        mimeType: doc.mime_type,
        fileSize: Number(doc.file_size || 0),
        verificationStatus: VerificationStatus.VERIFIED,
        extractedFields: extraction.fields
      });
    }

    // 4. Deterministic Compliance Evaluation
    const requirements = (bid.tender?.tender_requirements || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      category: r.category,
      isMandatory: r.is_mandatory,
      isApplicable: r.is_applicable,
      weight: Number(r.weight || 0),
      minimumThreshold: r.minimum_threshold ? Number(r.minimum_threshold) : null,
      configuration: r.configuration
    }));

    const evaluationResult = ComplianceRulesEngine.evaluate({
      tender: {
        id: bid.tender_id,
        minimumCompanyAgeYears: bid.tender?.minimum_company_age_years
      },
      requirements,
      documents: processedDocuments,
      bidderOrganization: bid.bidder_organization
    });

    // 5. Query Government Gateways connectivity status
    const sourcesStatus = await GovernmentVerificationGateway.getAllSourcesStatus();

    // 6. Evidence-grounded AI Recommendation
    const aiRecommendation = await AIGateway.generateComplianceInsights(
      bid.bid_number,
      evaluationResult.evaluations,
      evaluationResult.discrepancies
    );

    // 7. Insert Verification Run Record
    const runInsert = {
      bid_id: bidId,
      tender_id: bid.tender_id,
      run_status: RunStatus.COMPLETED,
      verification_status: evaluationResult.overallVerificationStatus,
      compliance_score: evaluationResult.complianceScore,
      risk_assessment: evaluationResult.riskAssessment,
      ai_recommendation: aiRecommendation,
      sources_status: sourcesStatus,
      executed_by: user.id,
      executed_role: user.role,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      is_latest: true
    };

    const { data: run, error: runErr } = await admin
      .from('verification_runs')
      .insert(runInsert)
      .select()
      .single();

    if (runErr || !run) {
      throw new AppError('Failed to record verification run.', 500, 'DB_ERROR', runErr);
    }

    // 8. Insert Requirement Evaluations
    for (const ev of evaluationResult.evaluations) {
      await admin.from('requirement_evaluations').insert({
        verification_run_id: run.id,
        tender_requirement_id: ev.tenderRequirementId,
        verification_status: ev.verificationStatus,
        compliance_status: ev.complianceStatus,
        score_awarded: ev.scoreAwarded,
        max_score: ev.maxScore,
        evidence_found: ev.evidenceFound,
        document_references: ev.documentReferences,
        extracted_fields: ev.extractedFields,
        reasons: ev.reasons
      });
      ev.verificationRunId = run.id;
    }

    // 9. Insert Discrepancies
    for (const disc of evaluationResult.discrepancies) {
      await admin.from('discrepancies').insert({
        verification_run_id: run.id,
        bid_id: bidId,
        code: disc.code,
        title: disc.title,
        description: disc.description,
        severity: disc.severity,
        affected_requirement_ids: disc.affectedRequirementIds,
        affected_document_ids: disc.affectedDocumentIds,
        expected_value: disc.expectedValue ? String(disc.expectedValue) : null,
        actual_value: disc.actualValue ? String(disc.actualValue) : null
      });
    }

    return {
      id: run.id,
      bidId: run.bid_id,
      tenderId: run.tender_id,
      bidNumber: bid.bid_number,
      runStatus: run.run_status,
      verificationStatus: run.verification_status,
      complianceScore: run.compliance_score,
      riskAssessment: run.risk_assessment,
      aiRecommendation: run.ai_recommendation,
      evaluations: evaluationResult.evaluations,
      discrepancies: evaluationResult.discrepancies,
      sourcesStatus: run.sources_status,
      executedByUserId: run.executed_by,
      executedByRole: run.executed_role,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      isLatest: run.is_latest
    };
  }

  /**
   * Get latest verification run for a bid.
   */
  static async getLatestVerificationRun(user: UserProfile, bidId: string): Promise<VerificationRun | null> {
    if (!config.hasSupabaseConfigured()) return null;

    const admin = getSupabaseAdminClient();

    // Check bid and authorization
    const { data: bid, error: bidErr } = await admin
      .from('bids')
      .select('id, bid_number, tender_id, bidder_organization_id, tender:tenders(procuring_organization_id, created_by)')
      .eq('id', bidId)
      .maybeSingle();

    if (bidErr || !bid) {
      throw new AppError('Bid not found.', 404, 'BID_NOT_FOUND');
    }

    const tenderObj = Array.isArray(bid.tender) ? bid.tender[0] : bid.tender;
    const isBidderOwner = user.organization?.id && bid.bidder_organization_id === user.organization.id;
    const isOfficer = user.role === UserRole.OFFICER && (
      (user.organization?.id && tenderObj?.procuring_organization_id === user.organization.id) ||
      tenderObj?.created_by === user.id
    );
    const isAdminOrAuditor = user.role === UserRole.ADMIN || user.role === UserRole.AUDITOR;

    if (!isBidderOwner && !isOfficer && !isAdminOrAuditor) {
      throw new AppError('Not authorized to access verification results for this bid.', 403, 'FORBIDDEN');
    }


    // Fetch latest run
    const { data: run, error: runErr } = await admin
      .from('verification_runs')
      .select('*')
      .eq('bid_id', bidId)
      .eq('is_latest', true)
      .maybeSingle();

    if (runErr || !run) {
      return null;
    }

    // Fetch evaluations and discrepancies
    const { data: rawEvals } = await admin
      .from('requirement_evaluations')
      .select(`
        *,
        tender_requirement:tender_requirements (
          code,
          name,
          category,
          is_mandatory,
          is_applicable
        )
      `)
      .eq('verification_run_id', run.id);

    const { data: rawDiscs } = await admin
      .from('discrepancies')
      .select('*')
      .eq('verification_run_id', run.id);

    const evaluations = (rawEvals || []).map((e: any) => {
      const req = Array.isArray(e.tender_requirement) ? e.tender_requirement[0] : e.tender_requirement;
      const matchingDiscs = (rawDiscs || []).filter((d: any) =>
        Array.isArray(d.affected_requirement_ids) && d.affected_requirement_ids.includes(e.tender_requirement_id)
      );

      return {
        id: e.id,
        verificationRunId: e.verification_run_id,
        tenderRequirementId: e.tender_requirement_id,
        requirementCode: req?.code || 'N/A',
        requirementName: req?.name || 'Requirement',
        category: req?.category || 'OTHER',
        isMandatory: req?.is_mandatory ?? true,
        isApplicable: req?.is_applicable ?? true,
        verificationStatus: e.verification_status,
        complianceStatus: e.compliance_status,
        weight: Number(e.max_score || 0),
        scoreAwarded: Number(e.score_awarded || 0),
        maxScore: Number(e.max_score || 0),
        evidenceFound: Boolean(e.evidence_found),
        documentReferences: e.document_references || [],
        extractedFields: e.extracted_fields || {},
        reasons: e.reasons || [],
        discrepancies: matchingDiscs.map((d: any) => ({
          id: d.id,
          code: d.code,
          title: d.title,
          description: d.description,
          severity: d.severity,
          affectedRequirementIds: d.affected_requirement_ids || [],
          affectedDocumentIds: d.affected_document_ids || [],
          expectedValue: d.expected_value,
          actualValue: d.actual_value,
          detectedAt: d.detected_at
        })),
        evaluatedAt: e.evaluated_at
      };
    });

    const discrepancies: Discrepancy[] = (rawDiscs || []).map((d: any) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      description: d.description,
      severity: d.severity,
      affectedRequirementIds: d.affected_requirement_ids || [],
      affectedDocumentIds: d.affected_document_ids || [],
      expectedValue: d.expected_value,
      actualValue: d.actual_value,
      detectedAt: d.detected_at
    }));

    return {
      id: run.id,
      bidId: run.bid_id,
      tenderId: run.tender_id,
      bidNumber: bid.bid_number,
      runStatus: run.run_status,
      verificationStatus: run.verification_status,
      complianceScore: run.compliance_score,
      riskAssessment: run.risk_assessment,
      aiRecommendation: run.ai_recommendation,
      evaluations,
      discrepancies,
      sourcesStatus: run.sources_status || [],
      executedByUserId: run.executed_by,
      executedByRole: run.executed_role,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      isLatest: run.is_latest
    };
  }

  /**
   * Bidder view: Get privacy-safe verification summary for own bid.
   * Enforces that sensitive officer investigation information is NOT exposed.
   */
  static async getBidderVerificationSummary(user: UserProfile, bidId: string): Promise<BidderVerificationSummary | null> {
    const fullRun = await this.getLatestVerificationRun(user, bidId);
    if (!fullRun) return null;

    return {
      runId: fullRun.id,
      bidNumber: fullRun.bidNumber,
      verificationStatus: fullRun.verificationStatus,
      mandatoryComplied: fullRun.complianceScore.mandatoryComplied,
      evaluations: fullRun.evaluations.map(e => ({
        requirementCode: e.requirementCode,
        requirementName: e.requirementName,
        category: e.category,
        isMandatory: e.isMandatory,
        isApplicable: e.isApplicable,
        verificationStatus: e.verificationStatus,
        complianceStatus: e.complianceStatus,
        reasons: e.reasons,
        evidenceAttached: e.evidenceFound,
        discrepanciesCount: e.discrepancies.length
      })),
      discrepancies: fullRun.discrepancies.map(d => ({
        code: d.code,
        title: d.title,
        description: d.description,
        severity: d.severity
      })),
      completedAt: fullRun.completedAt
    };
  }
}
