import React, { useState, useEffect } from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Building,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  TenderListItem,
  BidComparisonItem,
  AwardDecision,
  AwardDecisionStatus,
  RiskLevel,
  InvestigationPriority,
  InvestigationType,
} from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { AwardsApi, InvestigationsApi } from '../../services/wave2';

export const AwardsPage: React.FC = () => {
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>('');
  const [loadingTenders, setLoadingTenders] = useState<boolean>(true);
  const [bids, setBids] = useState<BidComparisonItem[]>([]);
  const [existingDecision, setExistingDecision] = useState<AwardDecision | null>(null);
  const [loadingBids, setLoadingBids] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Decision formulation state
  const [selectedBidId, setSelectedBidId] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [justificationText, setJustificationText] = useState<string>('');
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Investigation creation modal
  const [investigationTargetBid, setInvestigationTargetBid] = useState<BidComparisonItem | null>(null);
  const [invTitle, setInvTitle] = useState<string>('');
  const [invType, setInvType] = useState<InvestigationType>(InvestigationType.COMPLIANCE_DISCREPANCY);
  const [invPriority, setInvPriority] = useState<InvestigationPriority>(InvestigationPriority.MEDIUM);
  const [invSummary, setInvSummary] = useState<string>('');
  const [submittingInv, setSubmittingInv] = useState<boolean>(false);

  useEffect(() => {
    loadTenders();
  }, []);

  const loadTenders = async () => {
    try {
      setLoadingTenders(true);
      setError(null);
      const res = await TendersApi.listTenders();
      const items = res.items || [];
      setTenders(items);
      if (items.length > 0) {
        setSelectedTenderId(items[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch tenders');
    } finally {
      setLoadingTenders(false);
    }
  };

  useEffect(() => {
    if (selectedTenderId) {
      loadComparativeBids(selectedTenderId);
    } else {
      setBids([]);
      setExistingDecision(null);
    }
  }, [selectedTenderId]);

  const loadComparativeBids = async (tenderId: string) => {
    try {
      setLoadingBids(true);
      setError(null);
      setSelectedBidId('');
      setDecisionReason('');
      setJustificationText('');
      const res = await AwardsApi.getComparativeBids(tenderId);
      setBids(res.bids || []);
      setExistingDecision(res.existing_decision || null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch comparative bid data');
    } finally {
      setLoadingBids(false);
    }
  };

  const selectedBid = bids.find((b) => b.bidId === selectedBidId);

  // Determine if justification is strictly required
  const isJustificationRequired = (): { required: boolean; reasons: string[] } => {
    if (!selectedBid) return { required: false, reasons: [] };
    const reasons: string[] = [];

    const higherScoringBids = bids.filter(
      (b) => b.bidId !== selectedBid.bidId && b.complianceScore > selectedBid.complianceScore
    );
    if (higherScoringBids.length > 0) {
      const topScore = Math.max(...higherScoringBids.map((b) => b.complianceScore));
      reasons.push(
        `Selected bidder compliance score (${selectedBid.complianceScore}) is lower than higher-scoring contender(s) (highest: ${topScore}).`
      );
    }

    const riskRank = {
      [RiskLevel.LOW]: 1,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.HIGH]: 3,
      [RiskLevel.CRITICAL]: 4,
    };
    const selectedRiskRank = riskRank[selectedBid.riskLevel] || 2;
    const lowerRiskBids = bids.filter(
      (b) => b.bidId !== selectedBid.bidId && (riskRank[b.riskLevel] || 2) < selectedRiskRank
    );
    if (lowerRiskBids.length > 0) {
      reasons.push(
        `Selected bidder risk level (${selectedBid.riskLevel}) is elevated compared to available lower-risk contender(s).`
      );
    }

    if (!selectedBid.mandatoryComplied) {
      reasons.push(`Selected bidder has NOT satisfied all mandatory criteria.`);
    }

    return { required: reasons.length > 0, reasons };
  };

  const handleRecordDecision = async (status: AwardDecisionStatus) => {
    if (!selectedBidId) return;
    const check = isJustificationRequired();
    if (status === AwardDecisionStatus.APPROVED && check.required && !justificationText.trim()) {
      setError('Statutory requirement: You must provide detailed justification text before approving an award over higher-scoring or lower-risk bidders.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await AwardsApi.recordDecision(selectedTenderId, {
        tenderId: selectedTenderId,
        selectedBidId: selectedBidId,
        decisionStatus: status,
        decisionReason: decisionReason,
        justificationText: check.required ? justificationText : undefined,
      });

      setActionSuccess(`Award decision successfully recorded with status: ${status}`);
      setConfirmModalOpen(false);
      await loadComparativeBids(selectedTenderId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to record award decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigationTargetBid) return;

    try {
      setSubmittingInv(true);
      setError(null);
      await InvestigationsApi.createInvestigation({
        bidId: investigationTargetBid.bidId,
        title: invTitle,
        description: invSummary,
        investigationType: invType,
        priority: invPriority,
        evidenceReferences: [
          {
            type: 'AWARD_COMPARATIVE_REVIEW',
            referenceId: investigationTargetBid.bidId,
            title: `Flagged from award comparison. Score: ${investigationTargetBid.complianceScore}, Risk: ${investigationTargetBid.riskLevel}`,
          },
        ],
      });

      setActionSuccess(`Investigation case "${invTitle}" initiated successfully.`);
      setInvestigationTargetBid(null);
      setInvTitle('');
      setInvSummary('');
      await loadComparativeBids(selectedTenderId);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to initiate investigation');
    } finally {
      setSubmittingInv(false);
    }
  };

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.LOW:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">LOW</span>;
      case RiskLevel.MEDIUM:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">MEDIUM</span>;
      case RiskLevel.HIGH:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">HIGH</span>;
      case RiskLevel.CRITICAL:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">CRITICAL</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{level}</span>;
    }
  };

  const justificationCheck = isJustificationRequired();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-indigo-700" />
            <h1 className="text-2xl font-bold text-slate-900 font-serif">Procurement Award & Comparative Decision</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Comparative technical evaluation, objective risk benchmarks, and auditable officer award determination.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTenderId}
            onChange={(e) => setSelectedTenderId(e.target.value)}
            disabled={loadingTenders}
            className="text-sm border border-slate-300 rounded-md py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium text-slate-800 shadow-sm min-w-[260px]"
          >
            {tenders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tenderNumber} — {t.title.slice(0, 32)}...
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedTenderId && loadComparativeBids(selectedTenderId)}
            className="p-2 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh comparative bid data"
          >
            <RefreshCw className={`h-4 w-4 ${loadingBids ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-700 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Existing Decision Alert if already awarded */}
      {existingDecision && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-md">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-indigo-950 text-base">Recorded Award Determination</h3>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    existingDecision.decisionStatus === AwardDecisionStatus.APPROVED
                      ? 'bg-emerald-100 text-emerald-800'
                      : existingDecision.decisionStatus === AwardDecisionStatus.DRAFT
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {existingDecision.decisionStatus}
                  </span>
                </div>
                <p className="text-xs text-indigo-800 mt-1">
                  Selected Bid ID: <span className="font-semibold">{existingDecision.selectedBidId}</span> • Recorded on {new Date(existingDecision.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {existingDecision.justificationText && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-900 rounded border border-amber-300">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" /> Mandatory Justification Registered
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Determination Summary:</span>
              <p className="text-slate-800 mt-0.5 font-normal">{existingDecision.decisionReason || 'Standard award sanction.'}</p>
            </div>
            {existingDecision.justificationText && (
              <div>
                <span className="text-amber-800 font-medium">Statutory Justification for Exception:</span>
                <p className="text-slate-800 mt-0.5 italic">{existingDecision.justificationText}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparative Bid Matrix */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-800">Submitted Contenders & Technical Ranking</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ranked objectively based on deterministic compliance scoring, statutory requirement fulfillment, and verified evidence.
            </p>
          </div>
          <span className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 font-medium">
            {bids.length} Qualified / Submitted Bid(s)
          </span>
        </div>

        {loadingBids ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm">Loading comparative evaluation matrix...</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Info className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium">No submitted bids eligible for comparative evaluation on this tender.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Select</th>
                  <th className="py-3 px-4">Bidder / Organization</th>
                  <th className="py-3 px-4 text-center">Compliance Score</th>
                  <th className="py-3 px-4 text-center">Risk Assessment</th>
                  <th className="py-3 px-4 text-center">Mandatory Criteria</th>
                  <th className="py-3 px-4 text-center">Discrepancies</th>
                  <th className="py-3 px-4 text-center">Active Cases</th>
                  <th className="py-3 px-4 text-right">Officer Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {bids.map((b) => {
                  const isSelected = selectedBidId === b.bidId;
                  const isAwardWinner = existingDecision?.selectedBidId === b.bidId;

                  return (
                    <tr
                      key={b.bidId}
                      onClick={() => setSelectedBidId(b.bidId)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${
                        isSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : ''
                      } ${isAwardWinner ? 'bg-emerald-50/60' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="radio"
                          name="selected_bid"
                          checked={isSelected}
                          onChange={() => setSelectedBidId(b.bidId)}
                          className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {b.bidderOrganizationName}
                              {isAwardWinner && (
                                <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                                  AWARDED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              Bid Number: {b.bidNumber}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <span className={`text-base font-bold ${
                            b.complianceScore >= 80 ? 'text-emerald-700' : b.complianceScore >= 60 ? 'text-amber-700' : 'text-rose-700'
                          }`}>
                            {b.complianceScore}
                          </span>
                          <span className="text-xs text-slate-400">/100</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getRiskBadge(b.riskLevel)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {b.mandatoryComplied ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Fulfilled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Deficient
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {b.discrepanciesCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            {b.discrepanciesCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {b.openInvestigationsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 animate-pulse">
                            {b.openInvestigationsCount}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvestigationTargetBid(b);
                            setInvTitle(`Investigation: Discrepancy check for ${b.bidderOrganizationName}`);
                          }}
                          className="text-xs text-amber-700 hover:text-amber-900 font-medium px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition"
                        >
                          Flag Case
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Formulation Workspace */}
      {selectedBid && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-serif">Officer Award Formulation</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Designated Selected Bidder: <span className="font-semibold text-indigo-700">{selectedBid.bidderOrganizationName}</span> (Score: {selectedBid.complianceScore}, Risk: {selectedBid.riskLevel})
              </p>
            </div>
            {justificationCheck.required && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Statutory Justification Mandatory
              </span>
            )}
          </div>

          {justificationCheck.required && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                CVC / CAG Statutory Compliance Rule Triggered
              </div>
              <p>
                You are formulating an award selection for a bidder with an exception profile:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {justificationCheck.reasons.map((r, idx) => (
                  <li key={idx} className="font-medium text-amber-950">{r}</li>
                ))}
              </ul>
              <p className="italic text-amber-800">
                Under government procurement guidelines, you must document comprehensive legal, technical, or commercial rationale justifying this determination before sanctioning an approved award.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Decision Determination Summary / Findings <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="State the commercial and technical qualification basis for selecting this contender..."
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500 font-normal text-slate-900"
              />
            </div>

            {justificationCheck.required && (
              <div>
                <label className="block text-xs font-bold uppercase text-amber-800 mb-1">
                  Mandatory Statutory Justification for Exception <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={justificationText}
                  onChange={(e) => setJustificationText(e.target.value)}
                  placeholder="Provide explicit reasons why higher-scoring or lower-risk alternatives were not awarded (e.g., specific domain certifications, lower total life-cycle cost, non-responsive technical alternatives)..."
                  rows={4}
                  className="w-full text-sm border border-amber-300 bg-amber-50/30 rounded-md p-3 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleRecordDecision(AwardDecisionStatus.DRAFT)}
                disabled={submitting || !decisionReason.trim()}
                className="px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={
                  submitting ||
                  !decisionReason.trim() ||
                  (justificationCheck.required && !justificationText.trim())
                }
                className="px-5 py-2 bg-indigo-700 text-white rounded-md text-xs font-bold hover:bg-indigo-800 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Award className="h-4 w-4" />
                Finalize & Sanction Award
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedBid && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-indigo-700">
              <Award className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 font-serif">Confirm Procurement Award</h3>
            </div>
            <p className="text-xs text-slate-600">
              You are about to issue the binding procurement award decision on tender{' '}
              <span className="font-semibold text-slate-800">
                {tenders.find((t) => t.id === selectedTenderId)?.tenderNumber}
              </span>.
            </p>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1.5">
              <div>
                <span className="text-slate-500">Selected Winner: </span>
                <span className="font-bold text-slate-900">{selectedBid.bidderOrganizationName}</span>
              </div>
              <div>
                <span className="text-slate-500">Compliance Benchmark: </span>
                <span className="font-bold text-slate-900">{selectedBid.complianceScore}/100</span> (Risk: {selectedBid.riskLevel})
              </div>
              {justificationCheck.required && (
                <div className="pt-2 border-t border-slate-200 text-amber-900 font-medium">
                  Statutory exception justification is attached and will be appended to the immutable audit log.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecordDecision(AwardDecisionStatus.APPROVED)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded flex items-center gap-1.5 shadow"
              >
                {submitting ? 'Recording Sanction...' : 'Confirm & Sanction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initiate Investigation Modal */}
      {investigationTargetBid && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateInvestigation} className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-bold text-slate-900">Initiate Risk & Discrepancy Case</h3>
              </div>
              <button
                type="button"
                onClick={() => setInvestigationTargetBid(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Initiating inquiry for bidder: <span className="font-bold text-slate-800">{investigationTargetBid.bidderOrganizationName}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Case Title</label>
                <input
                  type="text"
                  required
                  value={invTitle}
                  onChange={(e) => setInvTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Inquiry Category</label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value as InvestigationType)}
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  >
                    <option value={InvestigationType.COMPLIANCE_DISCREPANCY}>Compliance Discrepancy</option>
                    <option value={InvestigationType.DOCUMENT_INCONSISTENCY}>Document Inconsistency</option>
                    <option value={InvestigationType.STATUTORY_VERIFICATION}>Statutory Verification</option>
                    <option value={InvestigationType.ENTITY_RISK}>Entity Risk Indicator</option>
                    <option value={InvestigationType.BLACKLISTING_DEBARMENT}>Blacklisting / Debarment</option>
                    <option value={InvestigationType.TENDER_SPECIFIC}>Tender Specific</option>
                    <option value={InvestigationType.OTHER}>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={invPriority}
                    onChange={(e) => setInvPriority(e.target.value as InvestigationPriority)}
                    className="w-full border border-slate-300 rounded p-2 text-xs"
                  >
                    <option value={InvestigationPriority.LOW}>Low</option>
                    <option value={InvestigationPriority.MEDIUM}>Medium</option>
                    <option value={InvestigationPriority.HIGH}>High</option>
                    <option value={InvestigationPriority.CRITICAL}>Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Summary / Observations</label>
                <textarea
                  required
                  rows={3}
                  value={invSummary}
                  onChange={(e) => setInvSummary(e.target.value)}
                  placeholder="State evidence discrepancies or anomalies to be resolved..."
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setInvestigationTargetBid(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingInv}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded"
              >
                {submittingInv ? 'Creating...' : 'Open Investigation Case'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
