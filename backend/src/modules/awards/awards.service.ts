import {
  AwardDecision,
  AwardDecisionStatus,
  BidComparisonItem,
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

export class AwardsService {
  /**
   * Comparative Bid Analysis for a tender.
   * Compares all submitted/under-review bids with their compliance scores, risk levels, and discrepancies.
   */
  static async getTenderBidComparison(_user: UserProfile, tenderId: string): Promise<BidComparisonItem[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();

    // 1. Fetch bids for tender
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
          legal_name
        ),
        bid_documents (id),
        tender:tenders (
          id,
          tender_requirements (id, is_mandatory)
        )
      `)
      .eq('tender_id', tenderId)
      .neq('status', BidStatus.DRAFT)
      .neq('status', BidStatus.WITHDRAWN);

    if (bidsErr) {
      throw new AppError('Failed to retrieve bids for comparative evaluation', 500, 'DB_ERROR', bidsErr);
    }

    const results: BidComparisonItem[] = [];

    for (const b of bids || []) {
      const org = Array.isArray(b.bidder_organization) ? b.bidder_organization[0] : b.bidder_organization;
      const tender = Array.isArray(b.tender) ? b.tender[0] : b.tender;
      const mandatoryReqs = (tender?.tender_requirements || []).filter((r: any) => r.is_mandatory);

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

      // Count discrepancies
      const { data: discs } = run ? await admin
        .from('discrepancies')
        .select('id, severity')
        .eq('verification_run_id', run.id) : { data: [] };

      const score = run?.compliance_score?.overallScore ?? 0;
      const risk = (run?.risk_assessment?.riskLevel as RiskLevel) || RiskLevel.LOW;
      const mandComplied = run?.compliance_score?.mandatoryComplied ?? false;
      const mandMet = run?.compliance_score?.mandatoryMetCount ?? 0;

      const criticalDiscs = (discs || []).filter((d: any) => d.severity === 'CRITICAL').length;

      // Parse bid amount from database column or submission notes
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

      results.push({
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
        criticalDiscrepanciesCount: criticalDiscs,
        openInvestigationsCount: openInvs || 0,
        verificationStatus: (run?.verification_status as VerificationStatus) || VerificationStatus.PENDING_VERIFICATION,
        evidenceCount: (b.bid_documents || []).length
      });
    }

    return results;
  }

  /**
   * Create or update a human award decision with mandatory justification validation.
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

    // 2. Fetch comparative bids to evaluate less-favorable profile rule
    const comparativeBids = await this.getTenderBidComparison(user, payload.tenderId);
    const selected = comparativeBids.find(b => b.bidId === payload.selectedBidId);

    if (!selected) {
      throw new AppError('Selected bid does not belong to this tender or is not eligible.', 400, 'INVALID_SELECTED_BID');
    }

    // Rule: Check if selected bidder has a lower score OR higher risk than another eligible bidder
    const betterBidderExists = comparativeBids.some(
      other => other.bidId !== selected.bidId &&
        (other.complianceScore > selected.complianceScore ||
         (selected.riskLevel === RiskLevel.HIGH && other.riskLevel === RiskLevel.LOW) ||
         (selected.riskLevel === RiskLevel.CRITICAL && other.riskLevel !== RiskLevel.CRITICAL))
    );

    if (betterBidderExists && !payload.justificationText && payload.decisionStatus === AwardDecisionStatus.APPROVED) {
      throw new AppError(
        'Selected bidder has a less favorable compliance/risk profile than another reviewed bidder. A detailed statutory procurement justification is mandatory.',
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

    // If approved, transition tender status to AWARDED and notify all participating bidders
    if (payload.decisionStatus === AwardDecisionStatus.APPROVED) {
      await admin.from('tenders').update({ status: TenderStatus.AWARDED }).eq('id', payload.tenderId);
      await admin.from('bids').update({ status: BidStatus.QUALIFIED }).eq('id', payload.selectedBidId);

      // Fetch tender details for notification text
      const { data: tenderData } = await admin
        .from('tenders')
        .select('tender_number, title')
        .eq('id', payload.tenderId)
        .maybeSingle();
      const tenderTitle = tenderData?.title || 'Tender';
      const tenderNumber = tenderData?.tender_number || '';

      // Fetch all participating bids to notify bidders
      const { data: allBids } = await admin
        .from('bids')
        .select('id, bid_number, submitted_by_user_id')
        .eq('tender_id', payload.tenderId);

      if (allBids && allBids.length > 0) {
        for (const b of allBids) {
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
      metadata: { complianceScore: selected.complianceScore, riskLevel: selected.riskLevel }
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
      awardedAmount: winningAmount,
      decisionReason: dec.decision_reason,
      justificationText: dec.justification_text,
      decidedAt: dec.decided_at,
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
