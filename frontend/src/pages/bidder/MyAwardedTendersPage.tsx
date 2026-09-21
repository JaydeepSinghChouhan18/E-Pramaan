import React, { useState, useEffect, useCallback } from 'react';
import { Award, CheckCircle2, Search, Calendar, IndianRupee, FileText, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TenderListItem, TenderStatus } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { AwardsApi } from '../../services/wave2';

interface MyAwardItem {
  tender: TenderListItem;
  winningBidAmount?: number | null;
  complianceScore?: number;
  awardedAt?: string;
  decisionReason?: string;
}

export const MyAwardedTendersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myAwards, setMyAwards] = useState<MyAwardItem[]>([]);
  const [search, setSearch] = useState('');

  const loadMyAwards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await TendersApi.listTenders({
        status: TenderStatus.AWARDED,
        pageSize: 50
      });

      const wins: MyAwardItem[] = [];

      for (const t of res.items || []) {
        try {
          const trans = await AwardsApi.getBidderTransparency(t.id);
          const isWinner = Boolean(trans?.isMyBidWinner ?? trans?.isCurrentUserWinner);
          if (trans && isWinner) {
            wins.push({
              tender: t,
              winningBidAmount: trans.winningBidAmount ?? trans.awardedAmount,
              complianceScore: trans.complianceScore ?? trans.comparison?.winning?.score,
              awardedAt: trans.awardedAt ?? trans.decidedAt,
              decisionReason: trans.decisionReason
            });
          }
        } catch {
          // ignore error for individual tender
        }
      }

      setMyAwards(wins);
    } catch (err: any) {
      setError(err.message || 'Failed to load awarded tenders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyAwards();
  }, [loadMyAwards]);

  const filtered = myAwards.filter(item => {
    const q = search.toLowerCase();
    return (
      item.tender.tenderNumber.toLowerCase().includes(q) ||
      item.tender.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-gov-navy" />
            <h1 className="text-lg font-bold text-slate-900">My Awarded Tenders</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Contracts and procurement opportunities officially sanctioned and awarded to your organization.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            OFFICIAL SANCTION
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search awarded contracts by tender number or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-gov-navy focus:border-gov-navy"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200 text-slate-500 text-xs">
          Loading your awarded tenders and sanction letters...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200 space-y-3">
          <Award className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 text-sm">No Awarded Tenders Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your organization has not been selected for an awarded contract yet. Keep submitting bids on active open tenders!
          </p>
          <Link
            to="/bidder/tenders"
            className="inline-flex items-center px-4 py-2 bg-gov-navy text-white text-xs font-semibold rounded hover:bg-gov-navyLight transition shadow-xs mt-2"
          >
            Browse Open Tenders
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <div
              key={item.tender.id}
              className="bg-white rounded-lg border-2 border-emerald-500/30 p-5 shadow-sm space-y-4 hover:border-emerald-500 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {item.tender.tenderNumber}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1.5 line-clamp-2">
                    {item.tender.title}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0">
                  AWARDED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Contract Amount</span>
                  <span className="font-bold text-slate-800 flex items-center">
                    <IndianRupee className="w-3 h-3 mr-0.5" />
                    {item.winningBidAmount
                      ? item.winningBidAmount.toLocaleString('en-IN')
                      : item.tender.estimatedValue != null
                      ? '₹ ' + item.tender.estimatedValue.toLocaleString('en-IN')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Compliance Score</span>
                  <span className="font-bold text-emerald-700">
                    {item.complianceScore ? `${item.complianceScore}/100` : '100/100'}
                  </span>
                </div>
                {item.awardedAt && (
                  <div className="col-span-2 text-slate-500 text-[11px] pt-1 border-t border-slate-200 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Sanction Date: {new Date(item.awardedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </div>
                )}
              </div>

              {item.decisionReason && (
                <div className="text-[11px] text-slate-600 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded">
                  <strong className="text-amber-900 block font-semibold mb-0.5">Officer Sanction Basis:</strong>
                  {item.decisionReason}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Link
                  to={`/bidder/tenders/${item.tender.id}`}
                  className="inline-flex items-center text-xs text-gov-navy font-semibold hover:underline"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" /> View Tender Notice
                </Link>
                <Link
                  to="/bidder/allotted-bids"
                  className="inline-flex items-center text-xs text-emerald-700 font-semibold hover:underline"
                >
                  Public Transparency Record <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
