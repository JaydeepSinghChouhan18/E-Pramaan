import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

import {
  TenderListItem,
  TenderDetail,
  TenderStatus,
  VerificationStatus,
  BidderVerificationSummary,
  BidListItem
} from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { BidsApi } from '../../services/bids';
import { ComplianceApi } from '../../services/compliance';
import { StatusBadge } from '../../components/common/StatusBadge';

export const SelfCheckPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('tenderId');

  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(preselectedId || '');
  const [tenderDetail, setTenderDetail] = useState<TenderDetail | null>(null);
  const [existingBid, setExistingBid] = useState<BidListItem | null>(null);
  const [verificationSummary, setVerificationSummary] = useState<BidderVerificationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load published tenders for selection
  useEffect(() => {
    async function loadPublished() {
      try {
        const res = await TendersApi.listTenders({
          status: TenderStatus.PUBLISHED,
          pageSize: 50
        });
        setTenders(res.items);
        if (!selectedTenderId && res.items.length > 0) {
          setSelectedTenderId(res.items[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load tenders');
      }
    }
    loadPublished();
  }, []);

  // Load details and existing bid status of selected tender
  useEffect(() => {
    if (!selectedTenderId) return;
    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        setExistingBid(null);
        setVerificationSummary(null);

        const [data, myBids] = await Promise.all([
          TendersApi.getTenderById(selectedTenderId),
          BidsApi.getMyBids({ pageSize: 50 }).catch(() => ({ items: [] }))
        ]);
        setTenderDetail(data);

        const applied = myBids.items.find(b => b.tenderId === selectedTenderId && b.status !== 'WITHDRAWN');
        if (applied) {
          setExistingBid(applied);
          if (applied.status !== 'DRAFT') {
            ComplianceApi.getBidderSummary(applied.id)
              .then(s => setVerificationSummary(s))
              .catch(() => setVerificationSummary(null));
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch tender requirements');
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [selectedTenderId]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bidder Pre-Submission Self-Check Simulator</h1>
        <p className="text-xs text-slate-500">
          Verify your organization's criteria applicability and required documentation before formal bid submission
        </p>
      </div>

      {/* Tender Selector */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <label className="block text-xs font-semibold text-slate-700" htmlFor="selectTender">
          Select Target Published Tender:
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
        <div className="p-8 text-center text-xs text-slate-500">Loading structured criteria...</div>
      ) : tenderDetail ? (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-gov-navy">{tenderDetail.tenderNumber}</span>
                <h2 className="text-sm font-bold text-slate-900 mt-1">{tenderDetail.title}</h2>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Requirements</span>
                  <div className="text-base font-bold text-gov-navy">{tenderDetail.requirements.length}</div>
                </div>
                {existingBid ? (
                  <Link
                    to={`/bidder/applications/${existingBid.id}`}
                    className="inline-flex items-center px-3.5 py-1.5 bg-gov-navy text-white rounded text-xs font-bold shadow-xs hover:bg-gov-navyLight"
                  >
                    View Bid Dossier ({existingBid.status}) <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                ) : (
                  <Link
                    to={`/bidder/tenders/${tenderDetail.id}/apply`}
                    className="inline-flex items-center px-3.5 py-1.5 bg-gov-navy text-white rounded text-xs font-bold shadow-xs hover:bg-gov-navyLight"
                  >
                    Start Bid Application <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                )}
              </div>
            </div>

            {verificationSummary ? (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 mr-1.5" />
                  Your Application Verification Screening
                </div>
                <p className="text-blue-800">
                  Overall status: <strong>{verificationSummary.verificationStatus}</strong>.
                  {verificationSummary.discrepancies.length > 0
                    ? ` Flagged ${verificationSummary.discrepancies.length} discrepancy item(s).`
                    : ' No critical discrepancies detected across attached evidence.'}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Diagnostic Baseline:</strong> This simulator presents the official tender criteria and required evidence. Upload evidence during formal application to trigger deterministic compliance verification.
                </span>
              </div>
            )}
          </div>

          {/* Structured Requirements List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tender Criteria Checklist & Evidence Mapping
            </div>

            <div className="divide-y divide-slate-100">
              {tenderDetail.requirements.map((req) => {
                const evalItem = verificationSummary?.evaluations.find(e => e.requirementCode === req.code);

                return (
                  <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {req.code}
                        </span>
                        <span className="font-bold text-slate-900">{req.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          req.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.isMandatory ? 'Mandatory Requirement' : 'Optional / Evaluation Metric'}
                        </span>
                      </div>

                      {req.description && <p className="text-slate-500">{req.description}</p>}

                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 pt-1">
                        <span><strong>Category:</strong> {req.category}</span> |
                        <span><strong>Evidence:</strong> {req.evidenceTypes.join(', ') || 'Formal Declaration'}</span> |
                        <span><strong>Target Registry:</strong> {req.verificationSources.join(', ') || 'Statutory Department'}</span>
                      </div>

                      {evalItem && evalItem.reasons.length > 0 && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                          <strong>Screening Note:</strong> {evalItem.reasons[0]}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Verification State</div>
                        <StatusBadge status={evalItem?.verificationStatus || VerificationStatus.PENDING_VERIFICATION} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
