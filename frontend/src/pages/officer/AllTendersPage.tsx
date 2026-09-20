import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Files, Search, Filter, Plus, ArrowUpRight, Clock, AlertCircle } from 'lucide-react';
import { TenderListItem, TenderStatus, TenderLifecycleAction } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';

export const AllTendersPage: React.FC = () => {
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTenders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await TendersApi.listTenders({
        page,
        pageSize: 15,
        search: search || undefined,
        status: statusFilter ? (statusFilter as TenderStatus) : undefined,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });
      // Show open or active tenders (or filter if selected by user)
      let displayItems = statusFilter
        ? res.items
        : res.items.filter((t) => t.status !== TenderStatus.CANCELLED && t.status !== TenderStatus.AWARDED);

      // Prioritize PUBLISHED & UNDER_EVALUATION at top, DRAFT at bottom
      displayItems = [...displayItems].sort((a, b) => {
        const getPriority = (status: TenderStatus) => {
          if (status === TenderStatus.PUBLISHED) return 1;
          if (status === TenderStatus.UNDER_EVALUATION) return 2;
          if (status === TenderStatus.CLOSED) return 3;
          if (status === TenderStatus.DRAFT) return 4;
          return 5;
        };
        return getPriority(a.status) - getPriority(b.status);
      });

      setTenders(displayItems);
      setTotalCount(displayItems.length);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve tenders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  const handleLifecycleAction = async (tenderId: string, action: TenderLifecycleAction) => {
    if (!confirm(`Are you sure you want to perform '${action}' on this tender?`)) return;
    try {
      await TendersApi.transitionLifecycle(tenderId, action);
      await fetchTenders();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const getStatusBadge = (status: TenderStatus) => {
    switch (status) {
      case TenderStatus.PUBLISHED:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case TenderStatus.DRAFT:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case TenderStatus.CLOSED:
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case TenderStatus.UNDER_EVALUATION:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case TenderStatus.AWARDED:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case TenderStatus.CANCELLED:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gov-navyLight/10 text-gov-navy rounded-lg">
            <Files className="w-6 h-6 text-gov-navy" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Procurement Tender Registry</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gov-navy text-white shadow-xs">
                {totalCount} Total Tenders
              </span>
            </div>
            <p className="text-xs text-slate-500">Official repository of active, open and evaluated procurement notices</p>
          </div>
        </div>
        <div className="mt-3 sm:mt-0">
          <Link
            to="/officer/tenders/create"
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Tender
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search tender ID or keyword..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
          >
            <option value="">Active Open Tenders (Default)</option>
            {Object.values(TenderStatus).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tenders Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading tenders repository...</div>
        ) : tenders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div>No tenders match the current criteria.</div>
            <Link
              to="/officer/tenders/create"
              className="inline-block text-xs font-bold text-gov-navy hover:underline"
            >
              Create your first tender notice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tender Ref / Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submission Deadline</th>
                  <th className="px-4 py-3">Estimated Value</th>
                  <th className="px-4 py-3">Requirements</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenders.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-gov-navy">{t.tenderNumber}</div>
                      <div className="font-medium text-slate-800 line-clamp-1 max-w-sm">{t.title}</div>
                      {t.procuringOrganization && (
                        <div className="text-[10px] text-slate-400">{t.procuringOrganization.legalName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(t.submissionDeadline).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(t.submissionDeadline).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {t.estimatedValue ? `${t.currency} ${t.estimatedValue.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800">{t.requirementCount}</span>
                      <span className="text-[10px] text-slate-400"> ({t.mandatoryRequirementCount} mandatory)</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        to={`/officer/tenders/${t.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold text-gov-navy bg-slate-100 hover:bg-slate-200"
                      >
                        View <ArrowUpRight className="w-3 h-3 ml-0.5" />
                      </Link>

                      {t.status === TenderStatus.DRAFT && (
                        <>
                          <Link
                            to={`/officer/tenders/${t.id}/edit`}
                            className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleLifecycleAction(t.id, TenderLifecycleAction.PUBLISH)}
                            className="px-2 py-1 rounded text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight cursor-pointer"
                          >
                            Publish
                          </button>
                        </>
                      )}

                      {t.status === TenderStatus.PUBLISHED && (
                        <button
                          type="button"
                          onClick={() => handleLifecycleAction(t.id, TenderLifecycleAction.CLOSE)}
                          className="px-2 py-1 rounded text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
                        >
                          Close
                        </button>
                      )}

                      {t.status === TenderStatus.CLOSED && (
                        <button
                          type="button"
                          onClick={() => handleLifecycleAction(t.id, TenderLifecycleAction.START_EVALUATION)}
                          className="px-2 py-1 rounded text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Evaluate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="space-x-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
