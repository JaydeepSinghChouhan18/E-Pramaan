import {
  UserProfile,
  UserRole,
  GlobalSearchResponse,
  SearchResultItem
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { config } from '../../config/env.js';

export class SearchService {
  static async searchGlobal(
    user: UserProfile,
    query: string,
    limit: number = 20
  ): Promise<GlobalSearchResponse> {
    const q = query.trim();
    if (!q || !config.hasSupabaseConfigured()) {
      return { query: q, total: 0, results: [] };
    }

    const admin = getSupabaseAdminClient();
    const isOfficer = [UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR].includes(user.role);
    const results: SearchResultItem[] = [];

    // 1. Tenders Search (Officers see all tenders; Bidders see published/active tenders)
    let tenderBuilder = admin
      .from('tenders')
      .select('id, tender_number, title, status, created_at')
      .or(`tender_number.ilike.%${q}%,title.ilike.%${q}%`)
      .limit(10);

    if (!isOfficer) {
      tenderBuilder = tenderBuilder.in('status', ['PUBLISHED', 'ACTIVE', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARDED']);
    }

    const { data: tenders } = await tenderBuilder;
    if (tenders) {
      for (const t of tenders) {
        results.push({
          id: t.id,
          title: `Tender ${t.tender_number}`,
          subtitle: t.title,
          entityType: 'TENDER',
          status: t.status,
          url: isOfficer ? `/officer/tenders/${t.id}` : `/bidder/tenders/${t.id}`,
          timestamp: t.created_at
        });
      }
    }

    // 2. Bids Search (Officers see bids on tenders; Bidders see ONLY their own applications)
    let bidBuilder = admin
      .from('bids')
      .select('id, bid_number, status, tender:tenders(id, tender_number, title), organization:organizations(name), created_at')
      .ilike('bid_number', `%${q}%`)
      .limit(10);

    if (!isOfficer) {
      if (user.organization?.id) {
        bidBuilder = bidBuilder.eq('bidder_organization_id', user.organization.id);
      } else {
        bidBuilder = bidBuilder.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    const { data: bids } = await bidBuilder;
    if (bids) {
      for (const b of bids) {
        results.push({
          id: b.id,
          title: `Bid ${b.bid_number}`,
          subtitle: `Tender: ${(b as any).tender?.tender_number || 'Tender'} — ${(b as any).organization?.name || 'Vendor'}`,
          entityType: 'BID',
          status: b.status,
          url: isOfficer ? `/officer/bids/review` : `/bidder/applications/${b.id}`,
          timestamp: b.created_at
        });
      }
    }

    // 3. Investigations (Officers ONLY)
    if (isOfficer) {
      const { data: investigations } = await admin
        .from('investigations')
        .select('id, case_number, title, status, priority, created_at')
        .or(`case_number.ilike.%${q}%,title.ilike.%${q}%`)
        .limit(5);

      if (investigations) {
        for (const inv of investigations) {
          results.push({
            id: inv.id,
            title: `Investigation ${inv.case_number}`,
            subtitle: inv.title,
            entityType: 'INVESTIGATION',
            status: `${inv.status} (${inv.priority})`,
            url: `/officer/risk`,
            timestamp: inv.created_at
          });
        }
      }
    }

    // 4. Awards Search (Officers see all decisions; Bidders see APPROVED public awards)
    let awardBuilder = admin
      .from('award_decisions')
      .select('id, tender:tenders(id, tender_number, title), decision_status, created_at')
      .limit(5);

    if (!isOfficer) {
      awardBuilder = awardBuilder.eq('decision_status', 'APPROVED');
    }

    const { data: awards } = await awardBuilder;
    if (awards) {
      for (const a of awards) {
        const tenderObj = (a as any).tender;
        if (tenderObj && (tenderObj.tender_number?.toLowerCase().includes(q.toLowerCase()) || tenderObj.title?.toLowerCase().includes(q.toLowerCase()))) {
          results.push({
            id: a.id,
            title: `Award Decision on ${tenderObj.tender_number}`,
            subtitle: tenderObj.title,
            entityType: 'AWARD',
            status: a.decision_status,
            url: isOfficer ? `/officer/awards` : `/bidder/tenders/${tenderObj.id}`,
            timestamp: a.created_at
          });
        }
      }
    }

    return {
      query: q,
      total: results.length,
      results: results.slice(0, limit)
    };
  }
}
