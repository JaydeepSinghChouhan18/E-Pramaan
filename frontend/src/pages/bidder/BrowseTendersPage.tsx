import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Building2, ArrowUpRight, AlertCircle } from 'lucide-react';
import { TenderListItem, TenderStatus } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { BidsApi } from '../../services/bids';

export const BrowseTendersPage: React.FC = () => {
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [myAppliedTenderIds, setMyAppliedTenderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchPublishedTenders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, myBids] = await Promise.all([
        TendersApi.listTenders({
          search: search || undefined,
          status: TenderStatus.PUBLISHED,
          sortBy: 'submission_deadline',
          sortOrder: 'asc'
        }),
        BidsApi.getMyBids({ pageSize: 100 }).catch(() => ({ items: [] }))
      ]);
      setTenders(res.items);
      const applied = new Set<string>((myBids.items || []).map((b: any) => b.tenderId));
      setMyAppliedTenderIds(applied);
    } catch (err: any) {
      setError(err.message || 'Failed to search active procurement notices.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPublishedTenders();
  }, [fetchPublishedTenders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Active Public Procurement Notices</h1>
        <p className="text-xs text-slate-500">
          Browse verified government invitations for tenders, review structured criteria & assess eligibility
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative max-w-lg">
          <input
            type="text"
            placeholder="Search tender notice by keywords, tender ID, or ministry..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tenders Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading published invitations...</div>
      ) : tenders.length === 0 ? (
        <div className="p-12 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">No active published tenders match your criteria.</div>
          <div>New procurement invitations will appear here as soon as they are gazetted by procuring agencies.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenders.map((t) => (
            <div
              key={t.id}
              className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-gov-navy hover:shadow-md transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {t.tenderNumber}
                  </span>
                  {myAppliedTenderIds.has(t.id) ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      APPLIED
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OPEN FOR BIDS
                    </span>
                  )}
                </div>

                <h2 className="text-sm font-bold text-slate-900 line-clamp-2">{t.title}</h2>

                {t.procuringOrganization && (
                  <div className="text-xs text-slate-600 flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{t.procuringOrganization.legalName}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Submission Deadline</div>
                  <div className="font-semibold text-slate-800 flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-amber-600" />
                    {new Date(t.submissionDeadline).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    to={`/bidder/self-check?tenderId=${t.id}`}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                    title="Run eligibility pre-check"
                  >
                    Self-Check
                  </Link>
                  <Link
                    to={`/bidder/tenders/${t.id}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded shadow-xs"
                  >
                    {myAppliedTenderIds.has(t.id) ? 'View Details' : 'View & Apply'} <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
