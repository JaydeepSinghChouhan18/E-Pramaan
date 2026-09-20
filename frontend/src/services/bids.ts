import { api } from './api';
import {
  BidDetail,
  BidListItem,
  BidDocument,
  BidStatus,
  CreateBidPayload,
  AttachDocumentPayload,
  SubmitBidPayload,
  PaginatedResponse
} from '@e-pramaan/shared';

export interface ListBidsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BidStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class BidsApi {
  /**
   * Create a new draft bid application for a published tender.
   */
  static async createDraftBid(payload: CreateBidPayload): Promise<BidDetail> {
    const res = await api.post<BidDetail>('/bids', payload);
    if (!res.data) throw new Error(res.message || 'Failed to create draft bid');
    return res.data;
  }

  /**
   * List the bidder's submitted and draft applications.
   */
  static async getMyBids(params: ListBidsParams = {}): Promise<PaginatedResponse<BidListItem>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const endpoint = `/bids/my-bids?${query.toString()}`;
    const res = await api.get<PaginatedResponse<BidListItem>>(endpoint);
    return res.data || { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 };
  }

  /**
   * Centralized repository of all uploaded documents for the bidder.
   */
  static async getMyDocuments(): Promise<BidDocument[]> {
    const res = await api.get<BidDocument[]>('/bids/my-documents');
    return res.data || [];
  }

  /**
   * Get complete bid details with documents and compliance matrix.
   */
  static async getBidById(id: string): Promise<BidDetail> {
    const res = await api.get<BidDetail>(`/bids/${id}`);
    if (!res.data) throw new Error(res.message || 'Bid application not found');
    return res.data;
  }

  /**
   * Attach a document to a draft bid.
   */
  static async attachDocument(bidId: string, payload: AttachDocumentPayload): Promise<BidDocument> {
    const res = await api.post<BidDocument>(`/bids/${bidId}/documents`, payload);
    if (!res.data) throw new Error(res.message || 'Failed to attach document');
    return res.data;
  }

  /**
   * Upload actual document file (PDF/Image) with server-side SHA-256 and OCR/Text extraction.
   */
  static async uploadDocument(
    bidId: string,
    formData: FormData
  ): Promise<BidDocument> {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const response = await fetch(`${apiUrl}/bids/${bidId}/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to upload document');
    }
    return json.data;
  }

  /**
   * Get direct URL for document file preview or download.
   */
  static getDocumentFileUrl(bidId: string, documentId: string): string {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const token = localStorage.getItem('token');
    return `${apiUrl}/bids/${bidId}/documents/${documentId}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  /**
   * Get secure direct view URL (signed or backend stream) for document preview.
   */
  static async getDocumentViewUrl(bidId: string, documentId: string): Promise<{ url: string; expiresIn: number; sha256Hash?: string; mimeType?: string }> {
    const res = await api.get<{ url: string; expiresIn: number; sha256Hash?: string; mimeType?: string }>(`/bids/${bidId}/documents/${documentId}/view-url`);
    return res.data || { url: this.getDocumentFileUrl(bidId, documentId), expiresIn: 3600 };
  }

  /**
   * Remove an attached document from a draft bid.
   */
  static async removeDocument(bidId: string, documentId: string): Promise<void> {
    await api.request(`/bids/${bidId}/documents/${documentId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Final submission of the bid application.
   */
  static async submitBid(bidId: string, payload: SubmitBidPayload): Promise<BidDetail> {
    const res = await api.post<BidDetail>(`/bids/${bidId}/submit`, payload);
    if (!res.data) throw new Error(res.message || 'Failed to submit bid');
    return res.data;
  }

  /**
   * Withdraw a submitted bid before evaluation.
   */
  static async withdrawBid(bidId: string): Promise<BidDetail> {
    const res = await api.post<BidDetail>(`/bids/${bidId}/withdraw`, {});
    if (!res.data) throw new Error(res.message || 'Failed to withdraw bid');
    return res.data;
  }

  /**
   * Officer: List submitted bids for a specific tender.
   */
  static async listBidsForTender(tenderId: string): Promise<BidListItem[]> {
    const res = await api.get<BidListItem[]>(`/bids/tender/${tenderId}`);
    return res.data || [];
  }

  /**
   * Officer: Mark bid status as UNDER_REVIEW.
   */
  static async transitionReviewStatus(bidId: string): Promise<BidDetail> {
    const res = await api.post<BidDetail>(`/bids/${bidId}/review`, {});
    if (!res.data) throw new Error(res.message || 'Failed to start bid review');
    return res.data;
  }
}
