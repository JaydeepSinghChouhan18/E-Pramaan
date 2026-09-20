import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

import {
  TenderListItem,
  TenderDetail,
  TenderStatus,
  VerificationStatus,
  BidDocument
} from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { BidsApi } from '../../services/bids';

export const SelfCheckPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('tenderId');

  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(preselectedId || '');
  const [tenderDetail, setTenderDetail] = useState<TenderDetail | null>(null);
  const [vaultDocs, setVaultDocs] = useState<BidDocument[]>([]);
  const [matchedDocs, setMatchedDocs] = useState<Record<string, string>>({}); // reqId -> docId
  const [evaluating, setEvaluating] = useState(false);
  const [evaluated, setEvaluated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load published tenders and vault documents
  useEffect(() => {
    async function loadInitial() {
      try {
        const [tendersRes, docs] = await Promise.all([
          TendersApi.listTenders({ status: TenderStatus.PUBLISHED, pageSize: 50 }),
          BidsApi.getMyDocuments().catch(() => [])
        ]);
        setTenders(tendersRes.items || []);
        setVaultDocs(docs);
        if (!selectedTenderId && tendersRes.items.length > 0) {
          setSelectedTenderId(tendersRes.items[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize pre-check simulator');
      }
    }
    loadInitial();
  }, []);

  // 2. Load target tender details
  useEffect(() => {
    if (!selectedTenderId) return;
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        setEvaluated(false);
        const data = await TendersApi.getTenderById(selectedTenderId);
        setTenderDetail(data);

        // Auto-match vault docs to requirements
        const autoMap: Record<string, string> = {};
        for (const req of data.requirements || []) {
          const reqCode = (req.code || '').toLowerCase();
          const reqName = (req.name || '').toLowerCase();

          const found = vaultDocs.find(d => {
            const dName = (d.documentName || '').toLowerCase();
            const dCode = (d.requirementCode || '').toLowerCase();
            if (dCode && dCode === reqCode) return true;
            if (reqCode.includes('pan') && dName.includes('pan')) return true;
            if (reqCode.includes('gst') && (dName.includes('gst') || dName.includes('tax'))) return true;
            if (reqCode.includes('msme') && (dName.includes('msme') || dName.includes('udyam'))) return true;
            if ((reqCode.includes('cin') || reqName.includes('incorporation')) && (dName.includes('incorporation') || dName.includes('mca'))) return true;
            if ((reqCode.includes('turnover') || reqName.includes('financial')) && (dName.includes('turnover') || dName.includes('audit'))) return true;
            return false;
          });

          if (found) {
            autoMap[req.id] = found.id;
          }
        }
        setMatchedDocs(autoMap);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch tender criteria');
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [selectedTenderId, vaultDocs]);

  // Handle document selection change
  const handleSelectDoc = (reqId: string, docId: string) => {
    setMatchedDocs(prev => ({
      ...prev,
      [reqId]: docId
    }));
    setEvaluated(false);
  };

  // Run Advisory Pre-Check Evaluation
  const handleRunEvaluation = () => {
    setEvaluating(true);
    setTimeout(() => {
      setEvaluating(false);
      setEvaluated(true);
    }, 600);
  };

  // Evaluation Metrics
  const evaluationResults = useMemo(() => {
    if (!tenderDetail) return null;

    const reqs = tenderDetail.requirements || [];
    const totalCount = reqs.length;
    const mandatoryReqs = reqs.filter(r => r.isMandatory);
    const mandatoryCount = mandatoryReqs.length;

    let satisfiedMandatory = 0;
    let satisfiedOptional = 0;
    const itemStatuses: Record<string, { status: VerificationStatus; note: string }> = {};

    for (const req of reqs) {
      const docId = matchedDocs[req.id];
      const hasDoc = Boolean(docId);

      if (hasDoc) {
        if (req.isMandatory) satisfiedMandatory++;
        else satisfiedOptional++;
        itemStatuses[req.id] = {
          status: VerificationStatus.VERIFIED,
          note: 'Verifiable evidence attached from Document Vault.'
        };
      } else {
        itemStatuses[req.id] = {
          status: req.isMandatory ? VerificationStatus.NON_COMPLIANT : VerificationStatus.PENDING_VERIFICATION,
          note: req.isMandatory
            ? 'Mandatory criteria lacking verifiable credential attachment.'
            : 'Optional evaluation metric (unattached).'
        };
      }
    }

    const complianceScore = mandatoryCount > 0
      ? Math.round((satisfiedMandatory / mandatoryCount) * 100)
      : 100;

    const isReady = satisfiedMandatory === mandatoryCount;

    return {
      totalCount,
      mandatoryCount,
      satisfiedMandatory,
      complianceScore,
      isReady,
      itemStatuses
    };
  }, [tenderDetail, matchedDocs]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-gov-navy" />
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Bidder Pre-Submission Self-Check Simulator
            </h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Simulate compliance evaluation, map credentials from your Document Vault, and resolve deficiencies before official bid submission.
          </p>
        </div>

        <Link
          to="/bidder/documents"
          className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition shrink-0"
        >
          <HardDrive className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
          Manage Vault ({vaultDocs.length} Docs)
        </Link>
      </div>

      {/* Step 1: Select Target Published Tender */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="selectTender">
          1. Select Published Tender Notice:
        </label>
        <select
          id="selectTender"
          value={selectedTenderId}
          onChange={(e) => setSelectedTenderId(e.target.value)}
          className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white font-medium text-slate-800"
        >
          {tenders.map((t) => (
            <option key={t.id} value={t.id}>
              {t.tenderNumber} — {t.title} (Deadline: {new Date(t.submissionDeadline).toLocaleDateString()})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading tender criteria and matching vault documents...</div>
      ) : tenderDetail ? (
        <div className="space-y-6">
          {/* Step 2 & 3: Match Vault Documents & Requirements Checklist */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. Map Vault Credentials to Requirements ({tenderDetail.requirements.length})
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Match each mandatory requirement with a statutory credential from your vault.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunEvaluation}
                disabled={evaluating}
                className="inline-flex items-center px-4 py-2 bg-gov-navy hover:bg-gov-navyLight text-white rounded text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Screening Evidence...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                    Run Advisory Pre-Check
                  </>
                )}
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {tenderDetail.requirements.map((req) => {
                const selectedDocId = matchedDocs[req.id] || '';
                const evalInfo = evaluated && evaluationResults ? evaluationResults.itemStatuses[req.id] : null;

                return (
                  <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {req.code}
                        </span>
                        <span className="font-bold text-slate-900">{req.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          req.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.isMandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </div>

                      {req.description && <p className="text-slate-500">{req.description}</p>}

                      {evalInfo && (
                        <div className={`text-[11px] p-2 rounded mt-1.5 flex items-center space-x-1.5 ${
                          evalInfo.status === VerificationStatus.VERIFIED
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {evalInfo.status === VerificationStatus.VERIFIED ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>{evalInfo.note}</span>
                        </div>
                      )}
                    </div>

                    {/* Vault Document Selector */}
                    <div className="w-full md:w-64 flex flex-col space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Attached Vault Evidence</label>
                      <select
                        value={selectedDocId}
                        onChange={(e) => handleSelectDoc(req.id, e.target.value)}
                        className={`text-xs py-1.5 px-2.5 rounded border focus:ring-1 focus:ring-gov-navy ${
                          selectedDocId ? 'bg-white border-slate-300 text-slate-800 font-semibold' : 'bg-rose-50/50 border-rose-200 text-slate-500'
                        }`}
                      >
                        <option value="">-- No Vault Document Attached --</option>
                        {vaultDocs.map((vd) => (
                          <option key={vd.id} value={vd.id}>
                            {vd.documentName} (v{(vd as any).version || 1})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4 & 5: Advisory Evaluation Results */}
          {evaluated && evaluationResults && (
            <div className={`p-6 rounded-lg border shadow-sm space-y-4 ${
              evaluationResults.isReady ? 'bg-emerald-50/80 border-emerald-300' : 'bg-amber-50/80 border-amber-300'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    {evaluationResults.isReady ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    )}
                    <h3 className="text-base font-bold text-slate-900">
                      {evaluationResults.isReady ? 'Pre-Submission Check Passed' : 'Submission Deficiencies Identified'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {evaluationResults.isReady
                      ? 'All mandatory statutory criteria are covered by attached vault documents. Your application is qualified for official evaluation.'
                      : `Missing ${evaluationResults.mandatoryCount - evaluationResults.satisfiedMandatory} mandatory statutory document(s). Upload them to your vault before applying.`}
                  </p>
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Advisory Score</span>
                    <span className={`text-2xl font-black ${
                      evaluationResults.complianceScore >= 80 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {evaluationResults.complianceScore}/100
                    </span>
                  </div>
                  <Link
                    to={`/bidder/tenders/${tenderDetail.id}/apply`}
                    className="inline-flex items-center px-4 py-2.5 bg-gov-navy hover:bg-gov-navyLight text-white rounded text-xs font-bold shadow-xs transition"
                  >
                    Proceed to Apply <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/80 p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Total Criteria</span>
                  <span className="font-bold text-slate-800 text-sm">{evaluationResults.totalCount}</span>
                </div>
                <div className="bg-white/80 p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Mandatory Thresholds</span>
                  <span className="font-bold text-slate-800 text-sm">{evaluationResults.mandatoryCount}</span>
                </div>
                <div className="bg-white/80 p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Satisfied Mandatory</span>
                  <span className="font-bold text-emerald-700 text-sm">{evaluationResults.satisfiedMandatory}</span>
                </div>
                <div className="bg-white/80 p-3 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold block">Deficient Items</span>
                  <span className="font-bold text-rose-700 text-sm">{evaluationResults.mandatoryCount - evaluationResults.satisfiedMandatory}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
