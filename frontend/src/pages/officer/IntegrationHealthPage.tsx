import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Server
} from 'lucide-react';
import { IntegrationSourceHealth, IntegrationStatus } from '@e-pramaan/shared';
import { Wave3Api } from '../../services/wave3';

export const IntegrationHealthPage: React.FC = () => {
  const [sources, setSources] = useState<IntegrationSourceHealth[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await Wave3Api.getIntegrationHealth();
      setSources(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch source gateway status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case IntegrationStatus.PRODUCTION_CONNECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> PRODUCTION CONNECTED
          </span>
        );
      case IntegrationStatus.SANDBOX:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
            <Server className="h-3.5 w-3.5 text-blue-600" /> SANDBOX ENVIRONMENT
          </span>
        );
      case IntegrationStatus.ACCESS_PENDING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> ACCESS PENDING
          </span>
        );
      case IntegrationStatus.UNAVAILABLE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
            <XCircle className="h-3.5 w-3.5 text-slate-500" /> UNAVAILABLE
          </span>
        );
      case IntegrationStatus.ERROR:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> CONNECTION ERROR
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-700" />
            <h1 className="text-xl font-bold text-slate-900 font-serif">Sovereign Source Gateways & Integration Health</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verification connectivity status across statutory Government of India departmental registries.
          </p>
        </div>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-slate-700 shadow-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Health Status
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Advisory Banner */}
      <div className="p-4 bg-indigo-50 border-l-4 border-indigo-600 rounded text-xs text-indigo-950 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-indigo-700" />
          Zero-Tolerance Honesty Protocol
        </div>
        <p>
          e-Pramaan strictly presents verified, honest integration states. Gateways without live government API credentials display <span className="font-semibold">ACCESS_PENDING</span> or <span className="font-semibold">UNAVAILABLE</span> rather than mock or simulated verifications.
        </p>
      </div>

      {/* Gateways Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">Configured Departmental Gateways</span>
          <span className="text-xs text-slate-500 font-medium">{sources.length} Active Gateways</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-xs">Checking departmental API endpoints...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sources.map((src) => (
              <div key={src.sourceId} className="p-5 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                      {src.sourceId}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{src.sourceName}</h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl">{src.description}</p>
                  <span className="text-[11px] text-slate-400 font-medium">Domain: {src.category}</span>
                </div>

                <div className="flex flex-col md:items-end gap-1 flex-shrink-0">
                  {getStatusBadge(src.status)}
                  <span className="text-[10px] text-slate-400 font-mono">
                    Can Execute Direct Verification: {src.canVerify ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
