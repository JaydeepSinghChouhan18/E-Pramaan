import { api } from './api';
import {
  Tender,
  TenderDetail,
  TenderListItem,
  TenderRequirement,
  TenderStatus,
  TenderLifecycleAction,
  CreateTenderPayload,
  UpdateTenderPayload,
  CreateRequirementPayload,
  UpdateRequirementPayload,
  PaginatedResponse
} from '@e-pramaan/shared';

export interface ListTendersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TenderStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class TendersApi {
  static async listTenders(params: ListTendersParams = {}): Promise<PaginatedResponse<TenderListItem>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const endpoint = `/tenders?${query.toString()}`;
    const res = await api.get<PaginatedResponse<TenderListItem>>(endpoint);
    return res.data || { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 };
  }

  static async getTenderById(id: string): Promise<TenderDetail> {
    const res = await api.get<TenderDetail>(`/tenders/${id}`);
    if (!res.data) throw new Error('Tender not found');
    return res.data;
  }

  static async createTender(payload: CreateTenderPayload): Promise<Tender> {
    const res = await api.post<Tender>('/tenders', payload);
    if (!res.data) throw new Error('Failed to create tender');
    return res.data;
  }

  static async updateTender(id: string, payload: UpdateTenderPayload): Promise<TenderDetail> {
    const res = await api.request<TenderDetail>(`/tenders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    if (!res.data) throw new Error('Failed to update tender');
    return res.data;
  }

  static async addRequirement(tenderId: string, payload: CreateRequirementPayload): Promise<TenderRequirement> {
    const res = await api.post<TenderRequirement>(`/tenders/${tenderId}/requirements`, payload);
    if (!res.data) throw new Error('Failed to add requirement');
    return res.data;
  }

  static async updateRequirement(
    tenderId: string,
    requirementId: string,
    payload: UpdateRequirementPayload
  ): Promise<TenderRequirement> {
    const res = await api.request<TenderRequirement>(`/tenders/${tenderId}/requirements/${requirementId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    if (!res.data) throw new Error('Failed to update requirement');
    return res.data;
  }

  static async deleteRequirement(tenderId: string, requirementId: string): Promise<void> {
    await api.request(`/tenders/${tenderId}/requirements/${requirementId}`, {
      method: 'DELETE'
    });
  }

  static async publishTender(id: string): Promise<TenderDetail> {
    const res = await api.post<TenderDetail>(`/tenders/${id}/publish`, {});
    if (!res.data) throw new Error('Failed to publish tender');
    return res.data;
  }

  static async transitionLifecycle(id: string, action: TenderLifecycleAction): Promise<TenderDetail> {
    const res = await api.post<TenderDetail>(`/tenders/${id}/lifecycle`, { action });
    if (!res.data) throw new Error('Failed to transition tender status');
    return res.data;
  }
}
