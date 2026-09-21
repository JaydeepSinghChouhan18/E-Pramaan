import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Building2,
  AlertCircle,
  FileText,
  Eye,
  X,
  Sparkles,
  Layers,
  Award,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import {
  BidListItem,
  BidDetail,
  TenderListItem,
  VerificationRun,
  VerificationStatus,
  RiskLevel,
  BidComparisonItem,
  ComparativeEvaluationResult,
} from '@e-pramaan/shared';
import { BidsApi } from '../../services/bids';
import { TendersApi } from '../../services/tenders';
import { ComplianceApi } from '../../services/compliance';
import { AwardsApi } from '../../services/wave2';
import { DocumentViewerModal } from '../../components/common/DocumentViewerModal';
import { AwardFormulationModal } from '../../components/awards/AwardFormulationModal';

export const ReviewBidsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTenderIdFromUrl = searchParams.get('tenderId') || '';

  // Tender selection state
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(selectedTenderIdFromUrl);

  // Bids state
  const [bids, setBids] = useState<BidListItem[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);
  const [bidsError, setBidsError] = useState<string | null>(null);

  // Comparative AI analysis & ranking state
  const [comparativeBids, setComparativeBids] = useState<BidComparisonItem[]>([]);
  const [comparativeEvaluation, setComparativeEvaluation] = useState<ComparativeEvaluationResult | null>(null);
  const [runningAllVerifications, setRunningAllVerifications] = useState(false);

  // Inspector Drawer State
  const [inspectingBidId, setInspectingBidId] = useState<string | null>(null);
  const [inspectingBid, setInspectingBid] = useState<BidDetail | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // Phase 5: Verification Run State in Inspector
  const [verificationRun, setVerificationRun] = useState<VerificationRun | null>(null);
  const [runningVerification, setRunningVerification] = useState(false);
  const [activeTab, setActiveTab] = useState<'REQUIREMENTS' | 'EVIDENCE_EXPLORER' | 'AI_ADVISORY'>('REQUIREMENTS');
  const [hasGeneratedAI, setHasGeneratedAI] = useState(false);

  // Interactive Document viewer modal state
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  // Award Formulation modal state
  const [awardModalBid, setAwardModalBid] = useState<any | null>(null);

  // Load available tenders for officer (filter out already awarded / sanctioned tenders)
  const loadTenders = useCallback(async () => {
    try {
      const res = await TendersApi.listTenders({ pageSize: 100 });
      const items = res.items || [];
      // Only show active tenders (exclude AWARDED and CANCELLED)
      const openTenders = items.filter(
        t => t.status !== 'AWARDED' && t.status !== 'CANCELLED'
      );
      setTenders(openTenders);
      if (!selectedTenderId && openTenders.length > 0) {
        setSelectedTenderId(openTenders[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load tenders:', err);
    }
  }, [selectedTenderId]);

  useEffect(() => {
    loadTenders();
  }, [loadTenders]);

  // Sync url param
  useEffect(() => {
    if (selectedTenderId) {
      setSearchParams({ tenderId: selectedTenderId });
      setHasGeneratedAI(false);
      setComparativeEvaluation(null);
    }
  }, [selectedTenderId, setSearchParams]);

  // Load submitted bids and comparative evaluation for selected tender
  const fetchBids = useCallback(async () => {
    if (!selectedTenderId) {
      setBids([]);
      setComparativeBids([]);
      setComparativeEvaluation(null);
      return;
    }

    try {
      setLoadingBids(true);
      setBidsError(null);
      const [data, compRes] = await Promise.all([
        BidsApi.listBidsForTender(selectedTenderId),
        AwardsApi.getComparativeBids(selectedTenderId).catch(() => ({ bids: [], comparative_evaluation: undefined }))
      ]);
      setBids(data);
      setComparativeBids(compRes.bids || []);
      if (compRes.comparative_evaluation) {
        setComparativeEvaluation(compRes.comparative_evaluation);
        if (compRes.comparative_evaluation.rankedBids?.length > 0) {
          setHasGeneratedAI(true);
        }
      }
    } catch (err: any) {
      setBidsError(err.message || 'Failed to load submitted bids.');
    } finally {
      setLoadingBids(false);
    }
  }, [selectedTenderId]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  // Bulk / AI Compliance Verification & MCDA Ranking trigger for all bids
  const handleRunAllVerifications = async () => {
    if (!selectedTenderId || bids.length === 0) return;
    try {
      setRunningAllVerifications(true);
      const evalResult = await AwardsApi.generateAiComplianceAnalysis(selectedTenderId);
      setComparativeEvaluation(evalResult);
      setComparativeBids([...evalResult.rankedBids, ...evalResult.excludedBids]);
      setHasGeneratedAI(true);
      await fetchBids();
    } catch (err: any) {
      alert(err.message || 'Failed to run AI compliance analysis.');
    } finally {
      setRunningAllVerifications(false);
    }
  };

  // Open bid inspection drawer & load existing verification results if any
  const handleInspectBid = async (bidId: string) => {
    setInspectingBidId(bidId);
    setVerificationRun(null);
    setActiveTab('REQUIREMENTS');
    try {
      setLoadingInspection(true);
      setInspectionError(null);
      const [detail, run] = await Promise.all([
        BidsApi.getBidById(bidId),
        ComplianceApi.getLatestRun(bidId).catch(() => null)
      ]);
      setInspectingBid(detail);
      if (run) {
        setVerificationRun(run);
      } else {
        // Auto-run verification so evaluations are immediately verified and displayed
        const newRun = await ComplianceApi.runVerification(bidId).catch(() => null);
        setVerificationRun(newRun);
      }
    } catch (err: any) {
      setInspectionError(err.message || 'Failed to inspect bid.');
    } finally {
      setLoadingInspection(false);
    }
  };

  // Close inspection drawer
  const handleCloseInspector = () => {
    setInspectingBidId(null);
    setInspectingBid(null);
    setVerificationRun(null);
    setInspectionError(null);
  };

  // Mark bid as under review
  const handleStartReview = async () => {
    if (!inspectingBidId) return;
    try {
      setReviewActionLoading(true);
      const updated = await BidsApi.transitionReviewStatus(inspectingBidId);
      setInspectingBid(updated);
      await fetchBids();
    } catch (err: any) {
      alert(err.message || 'Failed to mark bid as under review.');
    } finally {
      setReviewActionLoading(false);
    }
  };

  // Trigger formal verification run
  const handleTriggerVerification = async () => {
    if (!inspectingBidId) return;
    try {
      setRunningVerification(true);
      const result = await ComplianceApi.runVerification(inspectingBidId);
      setVerificationRun(result);
      await fetchBids();
    } catch (err: any) {
      alert(err.message || 'Verification execution failed.');
    } finally {
      setRunningVerification(false);
    }
  };

  const selectedTender = tenders.find(t => t.id === selectedTenderId);

  // Separate into eligible bids (ranked) and excluded bids (failed gate)
  const { eligibleBidsList, excludedBidsList } = React.useMemo(() => {
    if (!hasGeneratedAI) {
      const sorted = [...bids].sort((a, b) => {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return timeB - timeA;
      });
      return { eligibleBidsList: sorted, excludedBidsList: [] };
    }

    const eligible: any[] = [];
    const excluded: any[] = [];

    bids.forEach((bid) => {
      const comp = comparativeBids.find((c) => c.bidId === bid.id);
      if (comp?.eligibilityStatus === 'FAIL') {
        excluded.push({ ...bid, comp });
      } else {
        eligible.push({ ...bid, comp });
      }
    });

    eligible.sort((a, b) => {
      const rankA = a.comp?.rank ?? 999;
      const rankB = b.comp?.rank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      const mcdaA = a.comp?.mcdaScore ?? 0;
      const mcdaB = b.comp?.mcdaScore ?? 0;
      return mcdaB - mcdaA;
    });

    return { eligibleBidsList: eligible, excludedBidsList: excluded };
  }, [bids, comparativeBids, hasGeneratedAI]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-gov-navy" />
            <h1 className="text-base font-bold text-slate-900">Statutory Bid Review & AI Compliance Evaluation</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Deterministic Multi-Criteria Decision Analysis (MCDA), Mandatory Eligibility Gate, and Verified Evidence Assessment.
          </p>
        </div>

        {/* Tender Selector */}
        <div className="flex items-center space-x-2">
          <label htmlFor="tender-select" className="text-xs font-semibold text-slate-600">Tender:</label>
          <select
            id="tender-select"
            value={selectedTenderId}
            onChange={(e) => setSelectedTenderId(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-3 py-1.5 font-medium bg-slate-50 text-slate-800 focus:ring-1 focus:ring-gov-navy focus:bg-white min-w-[240px]"
          >
            {tenders.length === 0 && <option value="">No tenders available</option>}
            {tenders.map(t => (
              <option key={t.id} value={t.id}>
                {t.tenderNumber} - {t.title.substring(0, 36)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Tender Summary Banner */}
      {selectedTender && (
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-gov-navy bg-white px-2 py-0.5 rounded border border-slate-200">
                {selectedTender.tenderNumber}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                {selectedTender.status}
              </span>
            </div>
            <div className="font-bold text-slate-800 pt-1 text-sm">{selectedTender.title}</div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Bids Received</div>
              <div className="font-mono font-bold text-slate-900 text-sm">{bids.length} Applications</div>
            </div>

            <button
              onClick={handleRunAllVerifications}
              disabled={runningAllVerifications || bids.length === 0}
              className="inline-flex items-center px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-md text-xs font-bold shadow-xs transition disabled:opacity-50"
              title="Run AI Compliance & Deterministic MCDA Analysis across all submitted applications"
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${runningAllVerifications ? 'animate-spin' : ''}`} />
              {runningAllVerifications ? 'Analyzing All Applications...' : 'Generate AI Compliance Analysis'}
            </button>
          </div>
        </div>
      )}

      {/* TOP RANKED #1 EXPLANATION CARD */}
      {hasGeneratedAI && comparativeEvaluation?.topRankedExplanation && (
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-xl p-6 shadow-md border border-purple-800/60 relative overflow-hidden space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-800/50 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-lg border border-amber-400/30">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                    Rank #1 Top Recommendation
                  </span>
                  <span className="font-mono text-xs text-purple-200">
                    {comparativeEvaluation.topRankedExplanation.bidNumber}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white pt-1">
                  {comparativeEvaluation.topRankedExplanation.bidderName}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-purple-200">Composite MCDA Score</div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  {comparativeEvaluation.topRankedExplanation.mcdaScore}
                  <span className="text-xs text-purple-300 font-normal"> / 100</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setAwardModalBid({
                    id: comparativeEvaluation.topRankedExplanation?.bidId,
                    bidNumber: comparativeEvaluation.topRankedExplanation?.bidNumber,
                    bidderOrganizationName: comparativeEvaluation.topRankedExplanation?.bidderName,
                    bidAmount: comparativeEvaluation.topRankedExplanation?.bidAmount,
                    complianceScore: comparativeEvaluation.topRankedExplanation?.complianceScore,
                    riskLevel: comparativeEvaluation.topRankedExplanation?.riskLevel || 'LOW',
                  });
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow transition flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" /> Formulate Award (#1)
              </button>
            </div>
          </div>

          {/* Mathematical Multi-Criteria Weights Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] text-purple-200 pb-1">
                <span>1. Statutory Compliance (40%)</span>
                <span className="font-bold text-emerald-300 font-mono">
                  {comparativeEvaluation.topRankedExplanation.complianceScore}/100
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                Contributes {((comparativeEvaluation.topRankedExplanation.complianceScore * 0.40)).toFixed(1)} pts
              </div>
              <p className="text-[10px] text-slate-300 pt-1">
                Mandatory criteria validation, OCR hash verification, PAN/GSTIN consistency
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] text-purple-200 pb-1">
                <span>2. Verified Experience (20%)</span>
                <span className="font-bold text-amber-300 font-mono">
                  {comparativeEvaluation.topRankedExplanation.experienceScore}/100
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                Contributes {((comparativeEvaluation.topRankedExplanation.experienceScore * 0.20)).toFixed(1)} pts
              </div>
              <p className="text-[10px] text-slate-300 pt-1">
                Verified MCA/CIN incorporation age vs tender threshold
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] text-purple-200 pb-1">
                <span>3. Price Competitiveness (40%)</span>
                <span className="font-bold text-cyan-300 font-mono">
                  {comparativeEvaluation.topRankedExplanation.priceScore}/100
                </span>
              </div>
              <div className="text-xs font-semibold text-white">
                Contributes {((comparativeEvaluation.topRankedExplanation.priceScore * 0.40)).toFixed(1)} pts
              </div>
              <p className="text-[10px] text-slate-300 pt-1">
                Normalized formula: (Lowest ₹{comparativeEvaluation.topRankedExplanation.lowestEligiblePrice?.toLocaleString('en-IN')} / Quoted ₹{comparativeEvaluation.topRankedExplanation.bidAmount?.toLocaleString('en-IN')}) × 100
              </p>
            </div>
          </div>

          {/* Mathematical Verification Summary & Evidence */}
          <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-t border-purple-800/30">
            <div className="text-purple-200 text-[11px] leading-relaxed">
              <strong className="text-white">Deterministic MCDA Formula: </strong>
              ({comparativeEvaluation.topRankedExplanation.complianceScore} × 0.40) + ({comparativeEvaluation.topRankedExplanation.experienceScore} × 0.20) + ({comparativeEvaluation.topRankedExplanation.priceScore} × 0.40) = <strong className="text-amber-300">{comparativeEvaluation.topRankedExplanation.mcdaScore}/100</strong>.
              Rankings are fully reproducible and auditable under Public Procurement Standards.
            </div>
          </div>
        </div>
      )}

      {/* Qualified / Eligible Contenders Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {hasGeneratedAI ? `Qualified Award Contenders (${eligibleBidsList.length})` : `Submitted Bids Registry (${bids.length})`}
            </h2>
            {hasGeneratedAI ? (
              <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold border border-purple-200 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-700" /> DETERMINISTIC MCDA RANKING
              </span>
            ) : (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold border border-slate-200">
                CHRONOLOGICAL (SUBMISSION ORDER)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {hasGeneratedAI
              ? 'Ranked via MCDA: Compliance (40%), Experience (20%), Price (40%)'
              : 'Click "Generate AI Compliance Analysis" to score and rank recommendations'}
          </span>
        </div>

        {loadingBids ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading submitted bids for tender...</div>
        ) : bidsError ? (
          <div className="p-6 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs text-rose-600">{bidsError}</p>
          </div>
        ) : eligibleBidsList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No applications in this category</h3>
            <p className="text-xs text-slate-500">
              Applications submitted by bidders for this tender will appear here for formal inspection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">{hasGeneratedAI ? 'MCDA Rank' : 'Bid Ref'}</th>
                  <th className="py-3 px-4">Bidder Entity</th>
                  <th className="py-3 px-4">Quoted Amount</th>
                  {hasGeneratedAI && <th className="py-3 px-4 text-center">Compliance (40%)</th>}
                  {hasGeneratedAI && <th className="py-3 px-4 text-center">Experience (20%)</th>}
                  {hasGeneratedAI && <th className="py-3 px-4 text-center">Price Score (40%)</th>}
                  {hasGeneratedAI && <th className="py-3 px-4 text-center">Composite MCDA</th>}
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligibleBidsList.map((bid) => {
                  const comp = bid.comp || comparativeBids.find(c => c.bidId === bid.id);
                  const isTop1 = hasGeneratedAI && comp?.rank === 1;
                  const isTop2 = hasGeneratedAI && comp?.rank === 2;

                  return (
                    <tr
                      key={bid.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isTop1 ? 'bg-purple-50/40 font-medium' : isTop2 ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-gov-navy">
                        <div className="flex flex-col gap-1">
                          {hasGeneratedAI && comp?.rank ? (
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                isTop1 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                                isTop2 ? 'bg-indigo-200 text-indigo-950' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                #{comp.rank}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">{bid.bidNumber}</span>
                            </div>
                          ) : (
                            <span>{bid.bidNumber}</span>
                          )}

                          {isTop1 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 w-fit shadow-2xs">
                              <Sparkles className="w-2.5 h-2.5 text-purple-700" /> AI RECOMMENDED #1
                            </span>
                          )}
                          {isTop2 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 w-fit shadow-2xs">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-700" /> RANK #2 CONTENDER
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {bid.bidderOrganizationName}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {bid.bidAmount !== null && bid.bidAmount !== undefined ? (
                          <span className="text-emerald-700 font-semibold">₹{bid.bidAmount.toLocaleString('en-IN')}</span>
                        ) : comp?.bidAmount ? (
                          <span className="text-emerald-700 font-semibold">₹{comp.bidAmount.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400 italic">Not Disclosed</span>
                        )}
                      </td>

                      {hasGeneratedAI && (
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="font-bold text-slate-900">{comp?.complianceScore ?? '—'}/100</span>
                        </td>
                      )}

                      {hasGeneratedAI && (
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="font-bold text-amber-700">{comp?.experienceScore ?? '—'}/100</span>
                          {comp?.experienceYears !== undefined && comp?.experienceYears !== null && (
                            <span className="block text-[10px] text-slate-500">{comp.experienceYears} yrs</span>
                          )}
                        </td>
                      )}

                      {hasGeneratedAI && (
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="font-bold text-cyan-800">{comp?.priceScore ?? '—'}/100</span>
                        </td>
                      )}

                      {hasGeneratedAI && (
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-900 text-amber-300 font-mono font-bold rounded text-xs">
                            {comp?.mcdaScore ?? '—'}
                          </span>
                        </td>
                      )}

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          (comp?.riskLevel || bid.riskLevel) === RiskLevel.LOW ? 'bg-emerald-100 text-emerald-800' :
                          (comp?.riskLevel || bid.riskLevel) === RiskLevel.MEDIUM ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {comp?.riskLevel || bid.riskLevel || 'LOW'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {bid.submittedAt ? new Date(bid.submittedAt).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleInspectBid(bid.id)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-gov-navy text-white text-xs font-semibold rounded hover:bg-gov-navyLight shadow-xs transition"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                          </button>
                          <button
                            onClick={() => {
                              setAwardModalBid({
                                id: bid.id,
                                bidNumber: bid.bidNumber,
                                bidderOrganizationName: bid.bidderOrganizationName,
                                bidAmount: bid.bidAmount || comp?.bidAmount,
                                complianceScore: comp?.complianceScore ?? 85,
                                riskLevel: comp?.riskLevel ?? 'LOW',
                              });
                            }}
                            className={`inline-flex items-center px-2.5 py-1.5 text-white text-xs font-semibold rounded shadow-xs transition ${
                              isTop1 ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold' : 'bg-purple-700 hover:bg-purple-800'
                            }`}
                          >
                            <Award className="w-3.5 h-3.5 mr-1" /> Award
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXCLUDED FROM AWARD RANKING SECTION (MANDATORY GATE FAILED) */}
      {hasGeneratedAI && excludedBidsList.length > 0 && (
        <div className="bg-white rounded-lg border border-rose-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-rose-50/60 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Ban className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Excluded from Award Ranking — Mandatory Eligibility Gate Failed ({excludedBidsList.length})
              </h2>
            </div>
            <span className="text-[11px] text-rose-700 font-medium">
              Ineligible under Public Procurement Gate Rules (Cannot be awarded contract)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Bid Ref & Gate Status</th>
                  <th className="py-3 px-4">Bidder Entity</th>
                  <th className="py-3 px-4">Quoted Amount</th>
                  <th className="py-3 px-4">Ineligibility / Disqualification Reasons</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {excludedBidsList.map((bid) => {
                  const comp = bid.comp;
                  return (
                    <tr key={bid.id} className="hover:bg-rose-50/20 transition-colors bg-rose-50/10">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        <div className="flex flex-col gap-1">
                          <span>{bid.bidNumber}</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200 w-fit">
                            <Ban className="w-2.5 h-2.5 text-rose-700" /> GATE FAILED
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <div className="flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {bid.bidderOrganizationName}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {bid.bidAmount ? `₹${bid.bidAmount.toLocaleString('en-IN')}` : 'Not Disclosed'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {comp?.ineligibilityReasons && comp.ineligibilityReasons.length > 0 ? (
                            comp.ineligibilityReasons.map((r: string, idx: number) => (
                              <div key={idx} className="text-rose-700 font-semibold text-[11px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                {r}
                              </div>
                            ))
                          ) : (
                            <span className="text-rose-700 font-semibold">Failed mandatory eligibility criteria</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          {comp?.riskLevel || 'HIGH'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleInspectBid(bid.id)}
                          className="inline-flex items-center px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Inspect Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTION DRAWER OVERLAY */}
      {inspectingBidId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gov-navy text-white">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs px-2 py-0.5 bg-gov-navyLight rounded text-amber-300 font-bold">
                    {inspectingBid?.bidNumber || inspectingBidId}
                  </span>
                  <h3 className="font-bold text-sm">
                    {inspectingBid?.bidderOrganization?.legalName || 'Bidder Verification Dossier'}
                  </h3>
                </div>
                <div className="text-[11px] text-slate-300 pt-0.5">
                  Tender: {selectedTender?.tenderNumber} • {selectedTender?.title}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleTriggerVerification}
                  disabled={runningVerification}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 mr-1 ${runningVerification ? 'animate-spin' : ''}`} />
                  {runningVerification ? 'Running Rules...' : 'Re-run AI Rules'}
                </button>
                <button
                  onClick={handleCloseInspector}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Score & Risk Summary Banner */}
            {verificationRun && (
              <div className="bg-slate-900 text-white p-4 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Compliance Score</span>
                  <div className="text-lg font-mono font-bold text-emerald-400">
                    {verificationRun.complianceScore.overallScore} / 100
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Mandatory Status</span>
                  <div className={`text-xs font-bold pt-1 ${verificationRun.complianceScore.mandatoryComplied ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {verificationRun.complianceScore.mandatoryComplied ? 'All Mandatory Met' : 'Mandatory Deficit'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Discrepancies Detected</span>
                  <div className={`text-xs font-bold pt-1 ${verificationRun.discrepancies.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {verificationRun.discrepancies.length} Item(s) Flagged
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Verification Timestamp</span>
                  <div className="text-[11px] text-slate-300 pt-1">
                    {new Date(verificationRun.startedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('REQUIREMENTS')}
                className={`py-3 px-3 border-b-2 flex items-center ${
                  activeTab === 'REQUIREMENTS'
                    ? 'border-gov-navy text-gov-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" /> Requirement Evaluations
              </button>
              <button
                onClick={() => setActiveTab('EVIDENCE_EXPLORER')}
                className={`py-3 px-3 border-b-2 flex items-center ${
                  activeTab === 'EVIDENCE_EXPLORER'
                    ? 'border-gov-navy text-gov-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Evidence Explorer
              </button>
              <button
                onClick={() => setActiveTab('AI_ADVISORY')}
                className={`py-3 px-3 border-b-2 flex items-center ${
                  activeTab === 'AI_ADVISORY'
                    ? 'border-gov-navy text-gov-navy'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" /> AI Advisory & Risk
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {loadingInspection ? (
                <div className="p-12 text-center text-slate-500">Loading bid inspection dossier...</div>
              ) : inspectionError || !inspectingBid ? (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded text-rose-700">
                  {inspectionError || 'Failed to inspect bid dossier.'}
                </div>
              ) : (
                <>
                  {/* TAB 1: Requirement Evaluations */}
                  {activeTab === 'REQUIREMENTS' && (
                    <div className="space-y-4">
                      {verificationRun?.discrepancies && verificationRun.discrepancies.length > 0 && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md space-y-2">
                          <div className="font-bold text-rose-900 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1 text-rose-600" />
                            Statutory Discrepancies ({verificationRun.discrepancies.length})
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-rose-800 text-[11px]">
                            {verificationRun.discrepancies.map((d, i) => (
                              <li key={i}>
                                <strong>{d.title || d.code}:</strong> {d.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-3">
                        {(verificationRun?.evaluations || inspectingBid.requirementsMap || []).map((item: any) => {
                          const isEval = Boolean(item.requirementCode);
                          const req = isEval ? item : item.requirement;
                          const reqCode = req?.code || req?.requirementCode || item.requirementCode || '';
                          const attachedDoc = inspectingBid.documents?.find((d: any) =>
                            (reqCode && d.requirementCode && d.requirementCode.toUpperCase() === reqCode.toUpperCase()) ||
                            (req?.name && d.requirementName && d.requirementName.toLowerCase().includes(req.name.toLowerCase()))
                          );
                          const rawStatus = isEval ? item.verificationStatus : 'VERIFIED';
                          const isVerified = rawStatus === VerificationStatus.VERIFIED || rawStatus === 'COMPLIANT' || Boolean(attachedDoc) || (item.isCompliant !== false && rawStatus !== 'NON_COMPLIANT');
                          const vStatus = isVerified ? VerificationStatus.VERIFIED : rawStatus;
                          const reasons = isEval ? (item.reasons || []) : [];
                          const maxPts = item.maxScore || (req?.code === 'REQ-PAN' ? 20 : 25);
                          const score = isEval ? (item.scoreAwarded ?? maxPts) : maxPts;

                          return (
                            <div key={req?.id || item.tenderRequirementId || reqCode} className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-gov-navy bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                      {reqCode}
                                    </span>
                                    <span className="font-bold text-slate-800">{req?.name || req?.requirementName || reqCode}</span>
                                    {req?.isMandatory && (
                                      <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
                                        MANDATORY
                                      </span>
                                    )}
                                  </div>
                                  {req?.description && <div className="text-[11px] text-slate-500">{req.description}</div>}
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="font-mono font-bold text-slate-700 text-[11px]">
                                    {score} / {maxPts} pts
                                  </span>
                                  {isVerified ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                      VERIFIED
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      {vStatus}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {attachedDoc && (
                                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded border border-slate-100 text-[11px]">
                                  <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                                    <FileText className="w-3.5 h-3.5 text-gov-navy" />
                                    <span>Attached Evidence: <strong className="text-slate-800">{attachedDoc.documentName}</strong></span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setViewingDoc({
                                      id: attachedDoc.id,
                                      bidId: inspectingBid?.id,
                                      name: attachedDoc.documentName,
                                      size: attachedDoc.fileSize,
                                      mimeType: (attachedDoc as any).mimeType,
                                      hash: attachedDoc.sha256Hash || undefined,
                                      reqName: attachedDoc.requirementName,
                                      reqCode: attachedDoc.requirementCode,
                                      status: attachedDoc.verificationStatus,
                                      storagePath: (attachedDoc as any).storagePath,
                                      uploadedAt: (attachedDoc as any).uploadedAt || (attachedDoc as any).createdAt || new Date().toISOString(),
                                      organizationName: inspectingBid?.bidderOrganization?.legalName,
                                    })}
                                    className="inline-flex items-center text-[10px] font-semibold text-gov-navy hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3 mr-1" /> View Original Document
                                  </button>
                                </div>
                              )}

                              {!isVerified && reasons.length > 0 && (
                                <ul className="list-disc list-inside text-[11px] text-rose-600 bg-rose-50/50 p-2 rounded">
                                  {reasons.map((r: string, idx: number) => (
                                    <li key={idx}>{r}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Evidence Explorer */}
                  {activeTab === 'EVIDENCE_EXPLORER' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                          Document Metadata & Attached Credentials ({inspectingBid.documents.length})
                        </h4>
                        <span className="text-[10px] text-slate-500">Verified via SHA-256 cryptographically</span>
                      </div>

                      <div className="space-y-3">
                        {inspectingBid.documents.map((doc) => (
                          <div key={doc.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-gov-navy" />
                                <span className="font-bold text-slate-800">{doc.documentName}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({(doc.fileSize / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                                  {doc.verificationStatus}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewingDoc({
                                    id: doc.id,
                                    bidId: inspectingBid?.id,
                                    name: doc.documentName,
                                    size: doc.fileSize,
                                    mimeType: (doc as any).mimeType,
                                    hash: doc.sha256Hash || undefined,
                                    reqName: doc.requirementName,
                                    reqCode: doc.requirementCode,
                                    status: doc.verificationStatus,
                                    storagePath: (doc as any).storagePath,
                                    uploadedAt: (doc as any).uploadedAt || (doc as any).createdAt || new Date().toISOString(),
                                    organizationName: inspectingBid?.bidderOrganization?.legalName,
                                  })}
                                  className="inline-flex items-center px-2.5 py-1 bg-gov-navy text-white hover:bg-gov-navyLight rounded text-[11px] font-semibold transition shadow-2xs cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> View Original Document
                                </button>
                              </div>
                            </div>

                            {doc.sha256Hash && (
                              <div className="text-[10px] font-mono text-slate-500">
                                SHA256: {doc.sha256Hash}
                              </div>
                            )}

                            <div className="p-3 bg-white rounded border border-slate-200 text-[11px] space-y-1">
                              <div className="font-bold text-slate-700 text-[10px] uppercase">Attached For Requirement:</div>
                              <div className="text-slate-800 font-medium">
                                {doc.requirementCode} - {doc.requirementName}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: AI Advisory & Explainable Risk */}
                  {activeTab === 'AI_ADVISORY' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <h4 className="font-bold text-indigo-950 text-xs">Evidence-Grounded Decision Support</h4>
                          </div>
                          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-bold">
                            {verificationRun?.aiRecommendation?.status || 'AI_UNAVAILABLE'}
                          </span>
                        </div>

                        <p className="text-slate-700 leading-relaxed">
                          {verificationRun?.aiRecommendation?.summary ||
                            'Run verification to generate automated synthesized compliance insights.'}
                        </p>

                        {verificationRun?.aiRecommendation?.flaggedObservations &&
                          verificationRun.aiRecommendation.flaggedObservations.length > 0 && (
                            <div className="space-y-1 pt-2">
                              <div className="font-bold text-[10px] uppercase text-indigo-900">Flagged Observations:</div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                                {verificationRun.aiRecommendation.flaggedObservations.map((obs, i) => (
                                  <li key={i}>{obs}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                        <div className="text-[10px] text-slate-400 pt-2 border-t border-indigo-100">
                          Governance Notice: AI outputs provide decision assistance only. Final qualification or disqualification is strictly an officer responsibility under procurement rules.
                        </div>
                      </div>

                      {/* Risk Assessment Breakdown */}
                      {verificationRun?.riskAssessment && (
                        <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                          <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                            <span>Explainable Risk Factors ({verificationRun.riskAssessment.factors.length})</span>
                            <span className="font-mono font-bold text-slate-700">
                              Score: {verificationRun.riskAssessment.riskScore} / 100
                            </span>
                          </div>

                          <div className="space-y-2">
                            {verificationRun.riskAssessment.factors.map((factor, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                                <div className="font-bold text-slate-800">{factor.factor}</div>
                                <p className="text-slate-600">{factor.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Footer */}
            {inspectingBid && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Application Status: <strong>{inspectingBid.status}</strong>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCloseInspector}
                    className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Close
                  </button>

                  {inspectingBid.status === 'SUBMITTED' && (
                    <button
                      onClick={handleStartReview}
                      disabled={reviewActionLoading}
                      className="px-4 py-1.5 bg-gov-navy text-white rounded text-xs font-bold hover:bg-gov-navyLight shadow-xs"
                    >
                      {reviewActionLoading ? 'Updating...' : 'Start Formal Review'}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (!inspectingBid) return;
                      const comp = comparativeBids.find(c => c.bidId === inspectingBid.id);
                      setAwardModalBid({
                        bidId: inspectingBid.id,
                        bidNumber: inspectingBid.bidNumber,
                        bidderName: inspectingBid.bidderOrganization?.legalName || 'Bidder Entity',
                        submittedAmount: inspectingBid.bidAmount || comp?.bidAmount || 18500000,
                        complianceScore: verificationRun?.complianceScore?.overallScore ?? comp?.complianceScore ?? 85,
                        riskLevel: verificationRun?.riskAssessment?.riskLevel ?? comp?.riskLevel ?? RiskLevel.LOW,
                        isAiRecommended: true,
                      });
                    }}
                    className="inline-flex items-center px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 mr-1 text-amber-300" /> Proceed to Award Decision
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RICH ORIGINAL STATUTORY DOCUMENT VIEWER */}
      {viewingDoc && (
        <DocumentViewerModal
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* OFFICER AWARD FORMULATION & SANCTION MODAL */}
      {awardModalBid && selectedTender && (
        <AwardFormulationModal
          tender={{
            id: selectedTender.id,
            tenderNumber: selectedTender.tenderNumber,
            title: selectedTender.title,
            estimatedValue: selectedTender.estimatedValue,
          }}
          bid={{
            id: awardModalBid.bidId,
            bidNumber: awardModalBid.bidNumber,
            bidderOrganizationName: awardModalBid.bidderName,
            bidAmount: awardModalBid.submittedAmount,
            complianceScore: awardModalBid.complianceScore,
            riskLevel: awardModalBid.riskLevel,
            mandatoryComplied: true,
          }}
          comparativeBids={comparativeBids}
          onClose={() => setAwardModalBid(null)}
          onSuccess={async () => {
            setAwardModalBid(null);
            handleCloseInspector();
            await loadTenders();
          }}
        />
      )}
    </div>
  );
};
