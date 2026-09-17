import {
  AuditEventType,
  AuditEventListItem,
  AIOverrideRecord,
  CreateAIOverridePayload,
  UserProfile,
  UserRole
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';

export class AuditService {
  /**
   * Append-only event logger for all system mutations, decisions, overrides, and checks.
   */
  static async logEvent(params: {
    eventType: AuditEventType;
    entityType: string;
    entityId: string;
    tenderId?: string | null;
    bidId?: string | null;
    actorUserId: string;
    actorRole: UserRole | string;
    description: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!config.hasSupabaseConfigured()) return;

    try {
      const admin = getSupabaseAdminClient();
      await admin.from('audit_events').insert({
        event_type: params.eventType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        tender_id: params.tenderId || null,
        bid_id: params.bidId || null,
        actor_user_id: params.actorUserId,
        actor_role: params.actorRole,
        description: params.description,
        reason: params.reason || null,
        metadata: params.metadata || {},
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to append audit event:', err);
    }
  }

  /**
   * Query append-only audit event trail with filters.
   */
  static async listAuditEvents(
    _user: UserProfile,
    filters: {
      tenderId?: string;
      bidId?: string;
      eventType?: AuditEventType;
      limit?: number;
    }
  ): Promise<AuditEventListItem[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();
    let query = admin
      .from('audit_events')
      .select(`
        *,
        actor:users!inner (
          id,
          full_name,
          role
        ),
        tender:tenders (
          id,
          tender_number
        ),
        bid:bids (
          id,
          bid_number
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(filters.limit || 100);

    if (filters.tenderId) query = query.eq('tender_id', filters.tenderId);
    if (filters.bidId) query = query.eq('bid_id', filters.bidId);
    if (filters.eventType) query = query.eq('event_type', filters.eventType);

    const { data, error } = await query;
    if (error) {
      throw new AppError('Failed to retrieve audit events', 500, 'DB_ERROR', error);
    }

    return (data || []).map((row: any) => {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      const tender = Array.isArray(row.tender) ? row.tender[0] : row.tender;
      const bid = Array.isArray(row.bid) ? row.bid[0] : row.bid;

      return {
        id: row.id,
        eventType: row.event_type as AuditEventType,
        entityType: row.entity_type,
        entityId: row.entity_id,
        tenderId: row.tender_id,
        tenderNumber: tender?.tender_number || null,
        bidId: row.bid_id,
        bidNumber: bid?.bid_number || null,
        actorUserId: row.actor_user_id,
        actorName: actor?.full_name || 'System Operator',
        actorRole: (actor?.role || row.actor_role) as UserRole,
        description: row.description,
        reason: row.reason,
        metadata: row.metadata || {},
        timestamp: row.timestamp
      };
    });
  }

  /**
   * Record an explicit AI recommendation override with supporting rationale and evidence.
   */
  static async recordAIOverride(user: UserProfile, payload: CreateAIOverridePayload): Promise<AIOverrideRecord> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const insertData = {
      tender_id: payload.tenderId,
      bid_id: payload.bidId,
      ai_recommendation_text: payload.aiRecommendationText,
      ai_recommendation_timestamp: payload.aiRecommendationTimestamp,
      decision_taken: payload.decisionTaken,
      override_reason: payload.overrideReason,
      supporting_evidence_refs: payload.supportingEvidenceRefs || [],
      officer_user_id: user.id
    };

    const { data, error } = await admin
      .from('ai_overrides')
      .insert(insertData)
      .select(`
        *,
        officer:users (
          id,
          full_name
        )
      `)
      .single();

    if (error || !data) {
      throw new AppError('Failed to record AI override', 500, 'DB_ERROR', error);
    }

    const officer = Array.isArray(data.officer) ? data.officer[0] : data.officer;

    // Log to audit trail
    await this.logEvent({
      eventType: AuditEventType.AI_RECOMMENDATION_OVERRIDDEN,
      entityType: 'AI_OVERRIDE',
      entityId: data.id,
      tenderId: payload.tenderId,
      bidId: payload.bidId,
      actorUserId: user.id,
      actorRole: user.role,
      description: `Officer recorded override of AI recommendation: "${payload.decisionTaken}"`,
      reason: payload.overrideReason,
      metadata: { aiTimestamp: payload.aiRecommendationTimestamp }
    });

    return {
      id: data.id,
      tenderId: data.tender_id,
      bidId: data.bid_id,
      aiRecommendationText: data.ai_recommendation_text,
      aiRecommendationTimestamp: data.ai_recommendation_timestamp,
      decisionTaken: data.decision_taken,
      overrideReason: data.override_reason,
      supportingEvidenceRefs: data.supporting_evidence_refs || [],
      officerUserId: data.officer_user_id,
      officerName: officer?.full_name || user.fullName,
      createdAt: data.created_at
    };
  }

  /**
   * Retrieve AI Overrides for a tender or bid.
   */
  static async listAIOverrides(filters: { tenderId?: string; bidId?: string }): Promise<AIOverrideRecord[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();
    let query = admin
      .from('ai_overrides')
      .select(`
        *,
        officer:users (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.tenderId) query = query.eq('tender_id', filters.tenderId);
    if (filters.bidId) query = query.eq('bid_id', filters.bidId);

    const { data, error } = await query;
    if (error) {
      throw new AppError('Failed to list AI overrides', 500, 'DB_ERROR', error);
    }

    return (data || []).map((d: any) => {
      const officer = Array.isArray(d.officer) ? d.officer[0] : d.officer;
      return {
        id: d.id,
        tenderId: d.tender_id,
        bidId: d.bid_id,
        aiRecommendationText: d.ai_recommendation_text,
        aiRecommendationTimestamp: d.ai_recommendation_timestamp,
        decisionTaken: d.decision_taken,
        overrideReason: d.override_reason,
        supportingEvidenceRefs: d.supporting_evidence_refs || [],
        officerUserId: d.officer_user_id,
        officerName: officer?.full_name || 'Procurement Officer',
        createdAt: d.created_at
      };
    });
  }
}
