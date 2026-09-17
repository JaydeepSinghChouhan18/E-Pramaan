import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, Building2, AlertCircle, ArrowLeft, Trash2, Lock, Bot } from 'lucide-react';
import { TenderDetail, TenderStatus, TenderLifecycleAction } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';

export const TenderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTender = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TendersApi.getTenderById(id);
      setTender(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tender details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTender();
  }, [fetchTender]);

  const handleLifecycle = async (action: TenderLifecycleAction) => {
    if (!id) return;
    if (!confirm(`Are you sure you want to transition tender status via '${action}'?`)) return;
    try {
      setActionLoading(true);
      setError(null);
      await TendersApi.transitionLifecycle(id, action);
      await fetchTender();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRequirement = async (requirementId: string) => {
    if (!id) return;
    if (!confirm('Remove this requirement from the draft tender?')) return;
    try {
      await TendersApi.deleteRequirement(id, requirementId);
      await fetchTender();
    } catch (err: any) {
      alert(err.message || 'Failed to remove requirement');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading tender notice...</div>;
  }

  if (error || !tender) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white rounded-lg border border-slate-200 shadow-sm text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Tender Notice Unavailable</h2>
        <p className="text-xs text-slate-500">{error || 'Tender record not found.'}</p>
        <Link to="/officer/tenders" className="inline-block text-xs font-semibold text-gov-navy hover:underline">
          Return to Registry
        </Link>
      </div>
    );
  }

  const isDraft = tender.status === TenderStatus.DRAFT;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link
          to="/officer/tenders"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-gov-navy"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tender Registry
        </Link>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-400">Status:</span>
          <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
            tender.status === TenderStatus.PUBLISHED
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : tender.status === TenderStatus.DRAFT
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            {tender.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Title & Action Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {tender.tenderNumber}
            </span>
            {tender.procuringOrganization && (
              <span className="text-xs text-slate-500 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {tender.procuringOrganization.legalName}
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-2">{tender.title}</h1>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to={`/officer/ai-assistant?tenderId=${tender.id}`}
            className="px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md flex items-center gap-1.5 shadow-2xs transition"
          >
            <Bot className="w-4 h-4" />
            Ask AI About Tender
          </Link>

          {isDraft && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleLifecycle(TenderLifecycleAction.PUBLISH)}
              className="px-4 py-2 text-xs font-bold tracking-wide uppercase text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
            >
              Publish Tender
            </button>
          )}

          {tender.status === TenderStatus.PUBLISHED && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleLifecycle(TenderLifecycleAction.CLOSE)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
            >
              Close Tender
            </button>
          )}

          {tender.status === TenderStatus.CLOSED && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleLifecycle(TenderLifecycleAction.START_EVALUATION)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Begin Bid Evaluation
            </button>
          )}
        </div>
      </div>

      {/* Tender Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Submission Deadline</div>
          <div className="font-bold text-slate-900 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            {new Date(tender.submissionDeadline).toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Estimated Contract Value</div>
          <div className="font-bold text-slate-900">
            {tender.estimatedValue ? `${tender.currency} ${tender.estimatedValue.toLocaleString()}` : 'Unspecified'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Eligibility Rule (Operating Vintage)</div>
          <div className="font-bold text-slate-900">
            {tender.minimumCompanyAgeYears ? `Min ${tender.minimumCompanyAgeYears} Years Active` : 'Open'}
          </div>
        </div>
      </div>

      {/* Description */}
      {tender.description && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm text-xs space-y-2">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detailed Scope of Work</h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">{tender.description}</p>
        </div>
      )}

      {/* Configured Requirements Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Structured Compliance Requirements ({tender.requirements.length})
            </h2>
            <p className="text-xs text-slate-500">
              {isDraft
                ? 'Review or adjust compliance criteria before issuing gazette notice.'
                : 'Locked criteria verified during automated bidder pre-checks and committee clearance.'}
            </p>
          </div>
          {!isDraft && (
            <span className="text-[10px] font-semibold text-slate-500 flex items-center bg-slate-100 px-2 py-1 rounded">
              <Lock className="w-3 h-3 mr-1" /> Criteria Locked
            </span>
          )}
        </div>

        {tender.requirements.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No compliance requirements configured on this tender.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
            {tender.requirements.map((req) => (
              <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-gov-navy bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {req.code}
                    </span>
                    <span className="font-bold text-slate-900">{req.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                      req.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {req.isMandatory ? 'Mandatory' : 'Optional'}
                    </span>
                  </div>
                  {req.description && <p className="text-slate-500">{req.description}</p>}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                    <span className="font-semibold">Category:</span> {req.category} |
                    <span className="font-semibold">Type:</span> {req.requirementType} |
                    <span className="font-semibold">Evidence:</span> {req.evidenceTypes.join(', ') || 'N/A'} |
                    <span className="font-semibold">Sources:</span> {req.verificationSources.join(', ') || 'Self-Declaration'}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Weight</div>
                    <div className="font-bold text-slate-800">{req.weight}%</div>
                  </div>
                  {isDraft && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRequirement(req.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Delete requirement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
