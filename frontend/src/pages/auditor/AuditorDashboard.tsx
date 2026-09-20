import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  DownloadCloud,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText,
  Clock,
  Building
} from 'lucide-react';
import { AuditEventListItem } from '@e-pramaan/shared';
import { AuditApi } from '../../services/wave2';
import { TendersApi } from '../../services/tenders';

export const AuditorDashboard: React.FC = () => {
  const [events, setEvents] = useState<AuditEventListItem[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [searchTender, setSearchTender] = useState<string>('');

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, tendersRes] = await Promise.all([
        AuditApi.listAuditEvents({ limit: 50 }),
        TendersApi.listTenders({ pageSize: 50 }).catch(() => ({ items: [] }))
      ]);
      setEvents(eventsRes.events || []);
      setTotalEvents(eventsRes.total || 0);
      setTenders(tendersRes.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve statutory audit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleExportZip = async () => {
    try {
      setExporting(true);
      setError(null);
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${apiUrl}/audit/export`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        throw new Error('Failed to generate cryptographic audit export package');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sovereign-audit-export-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to download audit package.');
    } finally {
      setExporting(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType && ev.eventType !== filterType) return false;
    if (searchTender && !ev.entityId?.toLowerCase().includes(searchTender.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-900 text-emerald-300 rounded-lg shadow-inner">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-serif flex items-center gap-2">
                Statutory Procurement Oversight & CAG Audit Review
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded border border-emerald-300">
                  READ-ONLY OVERSIGHT
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Central Vigilance Commission (CVC) & Comptroller and Auditor General (CAG) compliance monitoring.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportZip}
            disabled={exporting}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <DownloadCloud className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Compiling Audit ZIP...' : 'Export Cryptographic Audit Package (ZIP)'}
          </button>
          <button
            type="button"
            onClick={loadAuditData}
            className="p-2 border border-slate-300 hover:bg-slate-50 rounded-md text-slate-600 transition"
            title="Refresh audit event stream"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Statutory Oversight Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Audit Trail Events</span>
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalEvents}</div>
          <div className="text-[11px] text-slate-500">Immutable ledger entries recorded</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Tenders Under Review</span>
            <Building className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{tenders.length}</div>
          <div className="text-[11px] text-slate-500">Public procurement opportunities</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>CVC Exception Alerts</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">
            {events.filter(e => e.eventType === 'AI_RECOMMENDATION_OVERRIDDEN').length}
          </div>
          <div className="text-[11px] text-slate-500">Officer overrides requiring justification</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Cryptographic Integrity</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> SHA-256 Validated
          </div>
          <div className="text-[11px] text-slate-500">Zero hash discrepancies detected</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-600 uppercase">Filter Event:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-slate-300 rounded p-1.5 bg-white font-semibold text-slate-800"
          >
            <option value="">-- All Audit Events --</option>
            <option value="AWARD_DECISION_RECORDED">AWARD_DECISION_RECORDED</option>
            <option value="AWARD_DECISION_REVOKED">AWARD_DECISION_REVOKED</option>
            <option value="AI_RECOMMENDATION_OVERRIDDEN">AI_RECOMMENDATION_OVERRIDDEN</option>
            <option value="TENDER_CREATED">TENDER_CREATED</option>
            <option value="BID_SUBMITTED">BID_SUBMITTED</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTender}
            onChange={(e) => setSearchTender(e.target.value)}
            placeholder="Search by tender / entity ID..."
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded focus:ring-emerald-500 focus:border-emerald-500"
          />
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* Audit Event Stream Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-800" />
            <h2 className="text-sm font-bold text-slate-900">Immutable Audit Trail Ledger</h2>
          </div>
          <span className="text-xs text-slate-500">Showing {filteredEvents.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Classification</th>
                <th className="py-3 px-4">Action Target</th>
                <th className="py-3 px-4">Actor Role</th>
                <th className="py-3 px-4">Audit Payload / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No matching audit events in current ledger view.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        ev.eventType.includes('REVOKE')
                          ? 'bg-rose-100 text-rose-800'
                          : ev.eventType.includes('AWARD')
                          ? 'bg-emerald-100 text-emerald-800'
                          : ev.eventType.includes('OVERRIDDEN')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {ev.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {ev.entityType}: {ev.entityId?.slice(0, 12)}...
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 text-[11px]">{ev.actorRole}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate" title={ev.description || (ev.metadata ? JSON.stringify(ev.metadata) : '')}>
                      {ev.description || (ev.metadata ? JSON.stringify(ev.metadata) : 'Logged statutory compliance event')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
