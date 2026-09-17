import crypto from 'crypto';
import {
  InvestigationCase,
  InvestigationDetail,
  InvestigationListItem,
  InvestigationStatus,
  InvestigationPriority,
  InvestigationType,
  CreateInvestigationPayload,
  AuditEventType,
  UserProfile,
  UserRole,
  RiskLevel
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';
import { AuditService } from '../audit/audit.service.js';

export class InvestigationsService {
  /**
   * Create an investigation case originating from a verification discrepancy, risk factor, or officer flag.
   */
  static async createInvestigation(
    user: UserProfile,
    payload: CreateInvestigationPayload
  ): Promise<InvestigationDetail> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch target bid and tender info
    const { data: bid, error: bidErr } = await admin
      .from('bids')
      .select(`
        id,
        bid_number,
        tender_id,
        bidder_organization_id,
        tender:tenders (
          id,
          tender_number,
          title,
          procuring_organization_id
        ),
        bidder_organization:organizations (
          id,
          legal_name
        )
      `)
      .eq('id', payload.bidId)
      .maybeSingle();

    if (bidErr || !bid) {
      throw new AppError('Bid application not found.', 404, 'BID_NOT_FOUND');
    }

    // 2. Generate unique case reference: CASE-YYYY-XXXXXX
    const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const caseNumber = `CASE-${new Date().getFullYear()}-${hex}`;

    const insertData = {
      case_number: caseNumber,
      bid_id: payload.bidId,
      tender_id: bid.tender_id,
      bidder_organization_id: bid.bidder_organization_id,
      title: payload.title,
      description: payload.description,
      investigation_type: payload.investigationType,
      priority: payload.priority || InvestigationPriority.MEDIUM,
      status: InvestigationStatus.OPEN,
      created_by: user.id,
      assigned_to: payload.assignedToUserId || null,
      opened_at: new Date().toISOString()
    };

    const { data: caseRecord, error: insertErr } = await admin
      .from('investigations')
      .insert(insertData)
      .select()
      .single();

    if (insertErr || !caseRecord) {
      throw new AppError('Failed to create investigation case', 500, 'DB_ERROR', insertErr);
    }

    // 3. Attach evidence references if provided
    if (payload.evidenceReferences && payload.evidenceReferences.length > 0) {
      for (const ev of payload.evidenceReferences) {
        await admin.from('investigation_evidence').insert({
          investigation_id: caseRecord.id,
          type: ev.type,
          reference_id: ev.referenceId,
          title: ev.title,
          description: ev.description || null
        });
      }
    }

    // 4. Record initial timeline event
    await admin.from('investigation_events').insert({
      investigation_id: caseRecord.id,
      actor_user_id: user.id,
      event_type: 'CREATED',
      description: `Investigation opened with priority ${payload.priority} regarding ${payload.investigationType}.`,
      metadata: { initialPriority: payload.priority, type: payload.investigationType }
    });

    // 5. Append-only system audit log
    await AuditService.logEvent({
      eventType: AuditEventType.INVESTIGATION_CREATED,
      entityType: 'INVESTIGATION',
      entityId: caseRecord.id,
      tenderId: bid.tender_id,
      bidId: payload.bidId,
      actorUserId: user.id,
      actorRole: user.role,
      description: `Opened case ${caseNumber}: "${payload.title}"`,
      reason: payload.description
    });

    return this.getInvestigationById(user, caseRecord.id);
  }

  /**
   * List all investigations with filters for officer/auditor workspace.
   */
  static async listInvestigations(
    _user: UserProfile,
    filters: {
      status?: InvestigationStatus;
      priority?: InvestigationPriority;
      type?: InvestigationType;
      tenderId?: string;
    }
  ): Promise<InvestigationListItem[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();
    let query = admin
      .from('investigations')
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
        bidder_organization:organizations (
          id,
          legal_name
        ),
        assigned_user:users!investigations_assigned_to_fkey (
          id,
          full_name
        )
      `)
      .order('opened_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.type) query = query.eq('investigation_type', filters.type);
    if (filters.tenderId) query = query.eq('tender_id', filters.tenderId);

    const { data, error } = await query;
    if (error) {
      throw new AppError('Failed to query investigations', 500, 'DB_ERROR', error);
    }

    return (data || []).map((row: any) => {
      const tender = Array.isArray(row.tender) ? row.tender[0] : row.tender;
      const bid = Array.isArray(row.bid) ? row.bid[0] : row.bid;
      const org = Array.isArray(row.bidder_organization) ? row.bidder_organization[0] : row.bidder_organization;
      const assigned = Array.isArray(row.assigned_user) ? row.assigned_user[0] : row.assigned_user;

      return {
        id: row.id,
        caseNumber: row.case_number,
        bidId: row.bid_id,
        bidNumber: bid?.bid_number || 'N/A',
        tenderId: row.tender_id,
        tenderNumber: tender?.tender_number || 'N/A',
        tenderTitle: tender?.title || 'N/A',
        bidderOrganizationId: row.bidder_organization_id,
        bidderOrganizationName: org?.legal_name || 'Anonymous Bidder',
        title: row.title,
        investigationType: row.investigation_type as InvestigationType,
        priority: row.priority as InvestigationPriority,
        status: row.status as InvestigationStatus,
        riskLevel: row.priority === 'CRITICAL' ? RiskLevel.CRITICAL : row.priority === 'HIGH' ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        assignedToName: assigned?.full_name || null,
        openedAt: row.opened_at,
        createdAt: row.created_at
      };
    });
  }

  /**
   * Get detailed investigation dossier with evidence references, timeline events, and verification runs.
   */
  static async getInvestigationById(_user: UserProfile, id: string): Promise<InvestigationDetail> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const { data: c, error: cErr } = await admin
      .from('investigations')
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
        bidder_organization:organizations (
          id,
          legal_name
        ),
        creator:users!investigations_created_by_fkey (
          id,
          full_name
        ),
        assigned_user:users!investigations_assigned_to_fkey (
          id,
          full_name
        ),
        investigation_evidence (*),
        investigation_events (
          *,
          actor:users (
            id,
            full_name,
            role
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (cErr || !c) {
      throw new AppError('Investigation case not found.', 404, 'NOT_FOUND');
    }

    // Fetch latest verification run for the bid
    const { data: latestRun } = await admin
      .from('verification_runs')
      .select('*')
      .eq('bid_id', c.bid_id)
      .eq('is_latest', true)
      .maybeSingle();

    const { data: rawDiscs } = latestRun ? await admin
      .from('discrepancies')
      .select('*')
      .eq('verification_run_id', latestRun.id) : { data: [] };

    const tender = Array.isArray(c.tender) ? c.tender[0] : c.tender;
    const bid = Array.isArray(c.bid) ? c.bid[0] : c.bid;
    const org = Array.isArray(c.bidder_organization) ? c.bidder_organization[0] : c.bidder_organization;
    const creator = Array.isArray(c.creator) ? c.creator[0] : c.creator;
    const assigned = Array.isArray(c.assigned_user) ? c.assigned_user[0] : c.assigned_user;

    const timeline = (c.investigation_events || [])
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((e: any) => {
        const actor = Array.isArray(e.actor) ? e.actor[0] : e.actor;
        return {
          id: e.id,
          investigationId: e.investigation_id,
          actorUserId: e.actor_user_id,
          actorName: actor?.full_name || 'Officer',
          actorRole: (actor?.role || UserRole.OFFICER) as UserRole,
          eventType: e.event_type,
          description: e.description,
          metadata: e.metadata || {},
          createdAt: e.created_at
        };
      });

    const evidenceReferences = (c.investigation_evidence || []).map((ev: any) => ({
      id: ev.id,
      type: ev.type,
      referenceId: ev.reference_id,
      title: ev.title,
      description: ev.description,
      attachedAt: ev.attached_at
    }));

    const discrepancies = (rawDiscs || []).map((d: any) => ({
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
      id: c.id,
      caseNumber: c.case_number,
      bidId: c.bid_id,
      tenderId: c.tender_id,
      bidderOrganizationId: c.bidder_organization_id,
      title: c.title,
      description: c.description,
      investigationType: c.investigation_type as InvestigationType,
      priority: c.priority as InvestigationPriority,
      status: c.status as InvestigationStatus,
      createdByUserId: c.created_by,
      assignedToUserId: c.assigned_to,
      openedAt: c.opened_at,
      resolvedAt: c.resolved_at,
      resolutionSummary: c.resolution_summary,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      bidNumber: bid?.bid_number || 'N/A',
      tenderNumber: tender?.tender_number || 'N/A',
      tenderTitle: tender?.title || 'N/A',
      bidderOrganizationName: org?.legal_name || 'N/A',
      createdByName: creator?.full_name || 'Investigator',
      assignedToName: assigned?.full_name || null,
      riskAssessment: latestRun?.risk_assessment || null,
      complianceScore: latestRun?.compliance_score || null,
      discrepancies,
      evidenceReferences,
      timeline
    };
  }

  /**
   * Add investigator note to timeline.
   */
  static async addNote(user: UserProfile, id: string, noteText: string): Promise<void> {
    const admin = getSupabaseAdminClient();
    await admin.from('investigation_events').insert({
      investigation_id: id,
      actor_user_id: user.id,
      event_type: 'NOTE_ADDED',
      description: noteText,
      metadata: { addedBy: user.fullName }
    });
  }

  /**
   * Update investigation status and record resolution.
   */
  static async updateStatus(
    user: UserProfile,
    id: string,
    payload: { status: InvestigationStatus; resolutionSummary?: string }
  ): Promise<InvestigationDetail> {
    const admin = getSupabaseAdminClient();
    const updateData: Record<string, unknown> = {
      status: payload.status
    };

    if (payload.status === InvestigationStatus.RESOLVED || payload.status === InvestigationStatus.CLOSED) {
      updateData.resolved_at = new Date().toISOString();
      if (payload.resolutionSummary) {
        updateData.resolution_summary = payload.resolutionSummary;
      }
    }

    const { error: updErr } = await admin
      .from('investigations')
      .update(updateData)
      .eq('id', id);

    if (updErr) {
      throw new AppError('Failed to update investigation status', 500, 'DB_ERROR', updErr);
    }

    // Add timeline event
    await admin.from('investigation_events').insert({
      investigation_id: id,
      actor_user_id: user.id,
      event_type: 'STATUS_CHANGED',
      description: `Status changed to ${payload.status}.` + (payload.resolutionSummary ? ` Resolution: "${payload.resolutionSummary}"` : ''),
      metadata: { newStatus: payload.status }
    });

    // Append audit record
    await AuditService.logEvent({
      eventType: AuditEventType.INVESTIGATION_STATUS_CHANGED,
      entityType: 'INVESTIGATION',
      entityId: id,
      actorUserId: user.id,
      actorRole: user.role,
      description: `Investigation status changed to ${payload.status}`,
      reason: payload.resolutionSummary
    });

    return this.getInvestigationById(user, id);
  }
}
