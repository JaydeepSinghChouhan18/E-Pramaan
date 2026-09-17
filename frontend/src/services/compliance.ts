import { api } from './api';
import { VerificationRun, BidderVerificationSummary } from '@e-pramaan/shared';

export class ComplianceApi {
  /**
   * Officer trigger: start a formal verification run for a submitted bid.
   */
  static async runVerification(bidId: string): Promise<VerificationRun> {
    const res = await api.post<VerificationRun>(`/compliance/bids/${bidId}/run`, {});
    if (!res.data) throw new Error(res.message || 'Failed to execute verification run');
    return res.data;
  }

  /**
   * Officer: get latest comprehensive verification run with requirement evaluations.
   */
  static async getLatestRun(bidId: string): Promise<VerificationRun> {
    const res = await api.get<VerificationRun>(`/compliance/bids/${bidId}/latest`);
    if (!res.data) throw new Error(res.message || 'Verification results not found');
    return res.data;
  }

  /**
   * Bidder view: get privacy-safe verification summary without internal officer intelligence.
   */
  static async getBidderSummary(bidId: string): Promise<BidderVerificationSummary> {
    const res = await api.get<BidderVerificationSummary>(`/compliance/bids/${bidId}/bidder-summary`);
    if (!res.data) throw new Error(res.message || 'Verification summary not available');
    return res.data;
  }
}
