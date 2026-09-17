import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderArchive,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ExternalLink,
  Bot,
  Award,
  ShieldCheck,
  X,
  Building2,
  TrendingUp,
  Info
} from 'lucide-react';
import { BidListItem, BidStatus } from '@e-pramaan/shared';
import { BidsApi } from '../../services/bids';
import { AwardsApi } from '../../services/wave2';

export const MyApplicationsPage: React.FC = () => {
  const [bids, setBids] = useState<BidListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Transparency modal state
  const [showTransparency, setShowTransparency] = useState(false);
  const [transparencyLoading, setTransparencyLoading] = useState(false);
  const [transparencyData, setTransparencyData] = useState<any>(null);
  const [transparencyError, setTransparencyError] = useState<string | null>(null);

  const openTransparencyModal = async (tenderId: string) => {
    setShowTransparency(true);
    setTransparencyLoading(true);
    setTransparencyError(null);
    setTransparencyData(null);
    try {
      const data = await AwardsApi.getBidderTransparency(tenderId);
      setTransparencyData(data);
    } catch (err: any) {
      setTransparencyError(err.message || 'Failed to load award transparency data.');
    } finally {
      setTransparencyLoading(false);
    }
  };

  const fetchBids = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await BidsApi.getMyBids({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as BidStatus),
        search: search.trim() || undefined
      });
      setBids(res.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load submitted applications.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderArchive className="w-5 h-5 text-gov-navy" />
            <h1 className="text-base font-bold text-slate-900">My Tender Applications</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Track draft applications, submitted bids, compliance coverage, and procuring officer review status.
          </p>
        </div>

        <Link
          to="/bidder/tenders"
          className="inline-flex items-center px-4 py-2 bg-gov-navy text-white text-xs font-bold rounded-md hover:bg-gov-navyLight shadow-sm"
        >
          Browse Open Tenders
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by bid number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:border-gov-navy focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:border-gov-navy focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft Applications</option>
            <option value="SUBMITTED">Submitted Bids</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading your applications...</div>
        ) : error ? (
          <div className="p-6 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        ) : bids.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No applications found</h3>
            <p className="text-xs text-slate-500">
              You haven't initiated or submitted any tender applications matching this filter.
            </p>
            <Link
              to="/bidder/tenders"
              className="inline-block text-xs font-bold text-gov-navy hover:underline"
            >
              Explore published tenders to apply
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Bid Ref / Tender</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mandatory Compliance</th>
                  <th className="py-3 px-4">Documents</th>
                  <th className="py-3 px-4">Submission Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bids.map((bid) => {
                  const isDraft = bid.status === 'DRAFT';
                  const allSatisfied = bid.mandatorySatisfiedCount >= bid.mandatoryRequirementCount;

                  return (
                    <tr key={bid.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="font-mono font-bold text-gov-navy">{bid.bidNumber}</div>
                        <div className="font-semibold text-slate-800 line-clamp-1 max-w-sm">
                          {bid.tenderTitle}
                        </div>
                        <div className="text-[11px] text-slate-400">{bid.tenderNumber}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                          bid.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          bid.status === 'UNDER_REVIEW' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          bid.status === 'WITHDRAWN' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {bid.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          {allSatisfied ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span className="font-medium text-slate-700">
                            {bid.mandatorySatisfiedCount} of {bid.mandatoryRequirementCount} Met
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-600">
                        {bid.documentCount} attached
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center text-slate-600">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" />
                          {bid.submissionDeadline ? new Date(bid.submissionDeadline).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isDraft && (
                            <button
                              onClick={() => openTransparencyModal(bid.tenderId)}
                              className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300"
                              title="View statutory award transparency and comparative matrix"
                            >
                              <Award className="w-3 h-3 mr-1 text-amber-600" /> Why Selected?
                            </button>
                          )}
                          <Link
                            to={`/bidder/ai-assistant?tenderId=${bid.tenderId}&bidId=${bid.id}`}
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                            title="Ask AI about this application"
                          >
                            <Bot className="w-3 h-3 mr-1" /> AI
                          </Link>
                          <Link
                            to={'/bidder/applications/' + bid.id}
                            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded ${
                              isDraft
                                ? 'bg-gov-navy text-white hover:bg-gov-navyLight'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isDraft ? 'Resume Draft' : 'View Application'}
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
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

      {/* Bidder Transparency Modal */}
      {showTransparency && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Statutory Award Transparency Dossier</h3>
              </div>
              <button
                onClick={() => setShowTransparency(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {transparencyLoading ? (
                <div className="py-12 text-center text-slate-500">Loading statutory award decision...</div>
              ) : transparencyError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-700">
                  {transparencyError}
                </div>
              ) : !transparencyData || !transparencyData.awarded ? (
                <div className="text-center py-8 space-y-2">
                  <Clock className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="font-bold text-slate-800">Evaluation In Progress</h4>
                  <p className="text-slate-500 max-w-md mx-auto">
                    {transparencyData?.message || 'The procuring officer has not finalized the contract award for this tender yet. Full transparency scores will appear here once sanctioned.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Banner */}
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Sanctioned Winning Contractor</div>
                      <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-4 h-4 text-emerald-600" />
                        {transparencyData.winningBidderName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Sanctioned on {new Date(transparencyData.decidedAt).toLocaleDateString('en-IN')}
                        {transparencyData.awardedAmount && ` • Contract Value: ₹${Number(transparencyData.awardedAmount).toLocaleString('en-IN')}`}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] uppercase">
                      Award Sanctioned
                    </span>
                  </div>

                  {/* Comparative Matrix Cards */}
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-gov-navy" />
                      Comparative Evaluation Matrix
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Winning Bid Card */}
                      <div className="p-3.5 rounded-lg border-2 border-emerald-300 bg-emerald-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-800 text-[11px]">Selected Entity</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="text-xs font-semibold text-slate-800 truncate">{transparencyData.winningBidderName}</div>
                        <div className="pt-1 border-t border-emerald-200 flex justify-between items-center">
                          <span className="text-slate-500">Compliance Score:</span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">{transparencyData.comparison?.winning?.score || 100}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Statutory Risk:</span>
                          <span className="font-bold text-emerald-700">{transparencyData.comparison?.winning?.riskLevel || 'LOW'}</span>
                        </div>
                      </div>

                      {/* User's Bid Card */}
                      <div className="p-3.5 rounded-lg border border-slate-300 bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-[11px]">Your Bid Application</span>
                          <span className="text-[10px] font-mono text-slate-500">{transparencyData.comparison?.myBid?.bidNumber || 'N/A'}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 truncate">Your Organization</div>
                        <div className="pt-1 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-slate-500">Compliance Score:</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">
                            {transparencyData.comparison?.myBid?.complianceScore !== null && transparencyData.comparison?.myBid?.complianceScore !== undefined
                              ? `${transparencyData.comparison?.myBid?.complianceScore}%`
                              : 'Evaluated'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Statutory Risk:</span>
                          <span className="font-bold text-slate-700">{transparencyData.comparison?.myBid?.riskLevel || 'EVALUATED'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Officer Findings & Rationale */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">Procuring Officer Formulation Rationale</h4>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 leading-relaxed">
                      {transparencyData.decisionReason}
                      {transparencyData.justificationText && (
                        <p className="mt-2 text-slate-600 italic">"{transparencyData.justificationText}"</p>
                      )}
                    </div>
                  </div>

                  {/* GFR Redaction Guarantee */}
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-500 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>GFR Rule 173 Statutory Transparency:</strong> Disclosed in compliance with public procurement transparency standards. Direct PAN records, proprietary banking information, and internal vigilance case notes are redacted for commercial privacy.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowTransparency(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
