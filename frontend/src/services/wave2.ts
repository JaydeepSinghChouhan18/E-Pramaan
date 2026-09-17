import { api } from './api';
import {
  InvestigationListItem,
  InvestigationDetail,
  CreateInvestigationPayload,
  InvestigationStatus,
  InvestigationPriority,
  InvestigationType,
  BidComparisonItem,
  AwardDecision,
  CreateAwardDecisionPayload,
  DecisionReconstruction,
  AuditEventListItem,
  AuditEventType,
  AIOverrideRecord,
} from '@e-pramaan/shared';

export class InvestigationsApi {
  static async listInvestigations(filters: {
    status?: InvestigationStatus;
    priority?: InvestigationPriority;
    type?: InvestigationType;
    tenderId?: string;
  } = {}): Promise<InvestigationListItem[]> {
    const query = new URLSearchParams();
    if (filters.status) query.set('status', filters.status);
    if (filters.priority) query.set('priority', filters.priority);
    if (filters.type) query.set('type', filters.type);
    if (filters.tenderId) query.set('tenderId', filters.tenderId);

    const qs = query.toString();
    const url = qs ? `/investigations?${qs}` : '/investigations';
    const res = await api.get<InvestigationListItem[]>(url);
    return res.data || [];
  }

  static async getInvestigationById(id: string): Promise<InvestigationDetail> {
    const res = await api.get<InvestigationDetail>(`/investigations/${id}`);
    if (!res.data) throw new Error(res.message || 'Investigation not found');
    return res.data;
  }

  static async createInvestigation(payload: CreateInvestigationPayload): Promise<InvestigationDetail> {
    const res = await api.post<InvestigationDetail>('/investigations', payload);
    if (!res.data) throw new Error(res.message || 'Failed to open investigation case');
    return res.data;
  }

  static async updateStatus(
    id: string,
    status: InvestigationStatus,
    notes?: string
  ): Promise<InvestigationDetail> {
    const res = await api.patch<InvestigationDetail>(`/investigations/${id}/status`, { status, notes });
    if (!res.data) throw new Error(res.message || 'Failed to update investigation status');
    return res.data;
  }

  static async addEvent(
    id: string,
    payload: { event_type: string; description: string; metadata?: Record<string, any> }
  ): Promise<InvestigationDetail> {
    const res = await api.post<InvestigationDetail>(`/investigations/${id}/events`, payload);
    if (!res.data) throw new Error(res.message || 'Failed to add timeline event');
    return res.data;
  }

  static async addNote(id: string, note: string): Promise<InvestigationDetail> {
    return this.addEvent(id, {
      event_type: 'NOTE_ADDED',
      description: note
    });
  }

  static async getEntityCommonality(tenderId: string): Promise<any[]> {
    const res = await api.get<any[]>(`/investigations/tender/${tenderId}/commonality`);
    return res.data || [];
  }
}

export class AwardsApi {
  static async getComparativeBids(tenderId: string): Promise<{
    tender: any;
    bids: BidComparisonItem[];
    existing_decision: AwardDecision | null;
  }> {
    const res = await api.get<{
      tender: any;
      bids: BidComparisonItem[];
      existing_decision: AwardDecision | null;
    }>(`/awards/tender/${tenderId}/comparative`);
    if (!res.data) throw new Error(res.message || 'Failed to load comparative bids');
    return res.data;
  }

  static async recordDecision(tenderId: string, payload: CreateAwardDecisionPayload): Promise<AwardDecision> {
    const res = await api.post<AwardDecision>(`/awards/tender/${tenderId}/decision`, payload);
    if (!res.data) throw new Error(res.message || 'Failed to record award decision');
    return res.data;
  }

  static async getDecisionReconstruction(decisionId: string): Promise<DecisionReconstruction> {
    const res = await api.get<DecisionReconstruction>(`/awards/decisions/${decisionId}/reconstruction`);
    if (!res.data) throw new Error(res.message || 'Failed to reconstruct award decision');
    return res.data;
  }

  static async getBidderTransparency(tenderId: string): Promise<any> {
    const res = await api.get<any>(`/awards/tender/${tenderId}/transparency`);
    return res.data;
  }
}

export class AuditApi {
  static async listAuditEvents(params: {
    tender_id?: string;
    event_type?: AuditEventType;
    limit?: number;
  } = {}): Promise<{ total: number; events: AuditEventListItem[] }> {
    const query = new URLSearchParams();
    if (params.tender_id) query.set('tender_id', params.tender_id);
    if (params.event_type) query.set('event_type', params.event_type);
    if (params.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const url = qs ? `/audit/events?${qs}` : '/audit/events';
    const res = await api.get<{ total: number; events: AuditEventListItem[] }>(url);
    return res.data || { total: 0, events: [] };
  }

  static async listAIOverrides(bidId?: string): Promise<{ total: number; overrides: AIOverrideRecord[] }> {
    const url = bidId ? `/audit/ai-overrides?bid_id=${bidId}` : '/audit/ai-overrides';
    const res = await api.get<{ total: number; overrides: AIOverrideRecord[] }>(url);
    return res.data || { total: 0, overrides: [] };
  }
}
