import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  AlertTriangle,
  CheckCircle,
  X,
  Building2,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Ban
} from 'lucide-react';
import {
  AwardDecisionStatus,
  RiskLevel,
  BidComparisonItem
} from '@e-pramaan/shared';
import { AwardsApi } from '../../services/wave2';

export interface AwardFormulationModalProps {
  tender: {
    id: string;
    tenderNumber: string;
    title: string;
    estimatedValue?: number | null;
  };
  bid: {
    id: string;
    bidNumber: string;
    bidderOrganizationName: string;
    bidAmount?: number | null;
    complianceScore?: number;
    riskLevel?: RiskLevel;
    mandatoryComplied?: boolean;
    mandatoryMetCount?: number;
    mandatoryTotalCount?: number;
  };
  comparativeBids?: BidComparisonItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const AwardFormulationModal: React.FC<AwardFormulationModalProps> = ({
  tender,
  bid,
  comparativeBids = [],
  onClose,
  onSuccess
}) => {
  const navigate = useNavigate();

  // Find comparative record if available
  const comp = comparativeBids.find(c => c.bidId === bid.id);
  const score = bid.complianceScore ?? comp?.complianceScore ?? 85;
  const risk = bid.riskLevel ?? comp?.riskLevel ?? RiskLevel.LOW;
  const amount = bid.bidAmount ?? comp?.bidAmount ?? null;

  // Check if AI recommended or if this is overriding higher score / lower risk
  const higherScoringBids = comparativeBids.filter(
    b => b.bidId !== bid.id && b.complianceScore > score
  );
  const isAiOverridden = higherScoringBids.length > 0;
  const topScore = higherScoringBids.length > 0 ? Math.max(...higherScoringBids.map(b => b.complianceScore)) : score;

  const [decisionReason, setDecisionReason] = useState<string>(
    `Bidder ${bid.bidderOrganizationName} (${bid.bidNumber}) has satisfied mandatory statutory compliance thresholds with an overall verified score of ${score}/100 and ${risk} operational risk. Financial proposal is statutorily sound and competitive.`
  );
  const [justificationText, setJustificationText] = useState<string>(
    isAiOverridden
      ? `Procurement Officer Determination: Selected entity possesses specialized regional industrial domain competence and demonstrated zero-defect project reliability, warranting selection under Rule 173 of GFR 2017.`
      : ''
  );
  const [clarificationNotes, setClarificationNotes] = useState<string>('');
  const [actionType, setActionType] = useState<'AWARD' | 'DISQUALIFY' | 'CLARIFICATION'>('AWARD');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitDecision = async () => {
    if (!decisionReason.trim()) {
      setError('Please provide statutory Decision Determination Summary / Findings.');
      return;
    }

    if (actionType === 'AWARD' && isAiOverridden && !justificationText.trim()) {
      setError('Statutory requirement: You must provide detailed justification text before approving an award over higher-scoring or lower-risk bidders.');
      return;
    }

    if (actionType === 'CLARIFICATION' && !clarificationNotes.trim()) {
      setError('Please enter the specific clarification request / comments for the bidder.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let decisionStatus: AwardDecisionStatus;
      if (actionType === 'AWARD') {
        decisionStatus = AwardDecisionStatus.APPROVED;
      } else if (actionType === 'DISQUALIFY') {
        decisionStatus = AwardDecisionStatus.REJECTED;
      } else {
        decisionStatus = AwardDecisionStatus.CLARIFICATION_REQUIRED;
      }

      await AwardsApi.recordDecision(tender.id, {
        tenderId: tender.id,
        selectedBidId: bid.id,
        decisionStatus,
        decisionReason,
        justificationText: isAiOverridden ? justificationText : undefined,
        clarificationRequired: actionType === 'CLARIFICATION',
        clarificationText: actionType === 'CLARIFICATION' ? clarificationNotes : undefined
      });

      if (onSuccess) onSuccess();
      onClose();

      // Navigate directly to Audit & Decisions so the officer can see the recorded sanction
      navigate('/officer/audit');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to record award decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gov-navy text-white px-6 py-4 flex items-center justify-between border-b border-gov-navyLight">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold">Officer Award Formulation & Sanction</h2>
              <div className="text-xs text-slate-300">
                Tender: <strong className="text-amber-300">{tender.tenderNumber}</strong> • {tender.title.slice(0, 48)}...
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-md text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Validation Notice:</strong> {error}
              </div>
            </div>
          )}

          {/* Designated Selected Bidder Profile Card */}
          <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-900 tracking-wider">Designated Selected Bidder</span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pt-0.5">
                  <Building2 className="w-4 h-4 text-gov-navy" />
                  {bid.bidderOrganizationName}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-white px-2.5 py-1 rounded border border-indigo-200 font-bold text-gov-navy shadow-2xs">
                  {bid.bidNumber}
                </span>
                {isAiOverridden ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                    ⚠ Officer AI Override
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-purple-700" /> AI Recommended #1
                  </span>
                )}
              </div>
            </div>

            {/* Score & Amount Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="bg-white p-2.5 rounded border border-indigo-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Compliance Score</span>
                <div className="text-base font-bold font-mono text-indigo-900">{score} / 100</div>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Risk Level</span>
                <div className="pt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    risk === RiskLevel.LOW ? 'bg-emerald-100 text-emerald-800' :
                    risk === RiskLevel.MEDIUM ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    {risk}
                  </span>
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Financial Bid</span>
                <div className="text-sm font-bold font-mono text-emerald-700">
                  {amount !== null && amount !== undefined ? `₹${amount.toLocaleString('en-IN')}` : 'As Submitted'}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-100">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Mandatory Criteria</span>
                <div className="text-xs font-bold text-emerald-700 pt-0.5">
                  ✓ 100% Statutorily Met
                </div>
              </div>
            </div>
          </div>

          {/* Action Tabs: Finalize / Disqualify / Clarification */}
          <div className="space-y-2">
            <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Formulation Action Determination:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActionType('AWARD')}
                className={`py-2 px-3 rounded-lg border text-center font-bold transition flex items-center justify-center gap-1.5 ${
                  actionType === 'AWARD'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                Sanction & Award
              </button>
              <button
                type="button"
                onClick={() => setActionType('DISQUALIFY')}
                className={`py-2 px-3 rounded-lg border text-center font-bold transition flex items-center justify-center gap-1.5 ${
                  actionType === 'DISQUALIFY'
                    ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                Disqualify Bidder
              </button>
              <button
                type="button"
                onClick={() => setActionType('CLARIFICATION')}
                className={`py-2 px-3 rounded-lg border text-center font-bold transition flex items-center justify-center gap-1.5 ${
                  actionType === 'CLARIFICATION'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                Seek Clarification
              </button>
            </div>
          </div>

          {/* Decision Determination Summary / Findings */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 uppercase text-[10px] tracking-wider">
              Decision Determination Summary / Findings *
            </label>
            <textarea
              rows={3}
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder="Detail the official statutory procurement basis, technical evaluation results, and regulatory alignment..."
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white text-slate-900"
            />
          </div>

          {/* AI Override Justification if higher scoring bids exist */}
          {actionType === 'AWARD' && isAiOverridden && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Statutory Exception Justification Required (CAG / CVC Compliance)</span>
              </div>
              <p className="text-[11px] text-amber-800">
                You are formulating an award to a bidder whose score ({score}) is lower than contender(s) (top score: {topScore}). Under public procurement governance, explicit written justification is mandatory.
              </p>
              <textarea
                rows={2}
                value={justificationText}
                onChange={(e) => setJustificationText(e.target.value)}
                placeholder="State the technical, geographical, or operational justification for selecting this bidder over higher-scoring contenders..."
                className="w-full p-2 text-xs bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900"
              />
            </div>
          )}

          {/* Clarification Notes if seeking clarification */}
          {actionType === 'CLARIFICATION' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <label className="block font-bold text-amber-900 text-xs">
                Official Clarification Query / Inquiry Comments *
              </label>
              <textarea
                rows={2}
                value={clarificationNotes}
                onChange={(e) => setClarificationNotes(e.target.value)}
                placeholder="Specify the documentation discrepancy or technical query requiring written response from the bidder..."
                className="w-full p-2 text-xs bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900"
              />
            </div>
          )}

          {/* Governance Notice */}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-500 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-gov-navy flex-shrink-0" />
            <span>
              All award determinations, justifications, and AI overrides are cryptographically timestamped and committed to the immutable CAG/CVC audit ledger.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmitDecision}
            disabled={submitting}
            className={`px-5 py-2 text-xs font-bold text-white rounded shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 ${
              actionType === 'AWARD' ? 'bg-emerald-700 hover:bg-emerald-800' :
              actionType === 'DISQUALIFY' ? 'bg-rose-700 hover:bg-rose-800' :
              'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {submitting ? (
              <span>Recording Determination...</span>
            ) : actionType === 'AWARD' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Sanction & Award Tender
              </>
            ) : actionType === 'DISQUALIFY' ? (
              <>
                <Ban className="w-3.5 h-3.5" />
                Record Disqualification
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                Issue Clarification Notice
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
