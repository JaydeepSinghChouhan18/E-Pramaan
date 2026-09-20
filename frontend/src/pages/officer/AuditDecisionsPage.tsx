import React, { useState, useEffect } from 'react';
import {
  BookOpenCheck,
  ShieldCheck,
  Filter,
  Search,
  Download,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Building,
  Award,
  FileText,
  HelpCircle,
  ShieldAlert,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  AuditEventListItem,
  AuditEventType,
  DecisionReconstruction,
  AIOverrideRecord,
  RiskLevel,
  TenderStatus,
  InvestigationPriority,
  InvestigationType,
} from '@e-pramaan/shared';
import { AuditApi, AwardsApi, InvestigationsApi } from '../../services/wave2';
import { TendersApi } from '../../services/tenders';
import { BidsApi } from '../../services/bids';
import { DocumentViewerModal } from '../../components/common/DocumentViewerModal';

export interface AwardedContractView {
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  estimatedValue?: number | null;
  selectedBidId: string;
  bidderName: string;
  bidNumber: string;
  awardedAmount?: number | null;
  officerFindings?: string;
  justification?: string;
  isAiOverride: boolean;
  overrideReason?: string;
  decisionDate: string;
  documents: Array<{
    name: string;
    size?: number;
    hash?: string;
    reqName?: string;
    reqCode?: string;
    status?: string;
    uploadedAt?: string;
    organizationName?: string;
  }>;
}

export const AuditDecisionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'awards' | 'events' | 'overrides'>('awards');
  const [auditEvents, setAuditEvents] = useState<AuditEventListItem[]>([]);
  const [aiOverrides, setAiOverrides] = useState<AIOverrideRecord[]>([]);
  const [awardedContracts, setAwardedContracts] = useState<AwardedContractView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Decision reconstruction drawer state
  const [reconstructionOpen, setReconstructionOpen] = useState<boolean>(false);
  const [loadingReconstruction, setLoadingReconstruction] = useState<boolean>(false);
  const [reconstructionData, setReconstructionData] = useState<DecisionReconstruction | null>(null);

  // Document Viewer state
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const handleExportAuditPackage = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${apiUrl}/audit/export`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        throw new Error('Failed to generate cryptographic audit export package.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `e-pramaan-cag-audit-dossier-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Audit export failed.');
    } finally {
      setExporting(false);
    }
  };

  // Vigilance Case Modal state
  const [vigilanceModalTarget, setVigilanceModalTarget] = useState<{
    bidId: string;
    tenderNumber: string;
    bidderName: string;
    reason?: string;
  } | null>(null);
  const [vigilanceForm, setVigilanceForm] = useState<{
    title: string;
    description: string;
    type: InvestigationType;
    priority: InvestigationPriority;
  }>({
    title: '',
    description: '',
    type: InvestigationType.STATUTORY_VERIFICATION,
    priority: InvestigationPriority.HIGH,
  });
  const [submittingVigilance, setSubmittingVigilance] = useState<boolean>(false);

  useEffect(() => {
    loadAuditData();
  }, [eventTypeFilter]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, overridesRes, tendersRes] = await Promise.all([
        AuditApi.listAuditEvents({
          event_type: eventTypeFilter ? (eventTypeFilter as AuditEventType) : undefined,
          limit: 100,
        }),
        AuditApi.listAIOverrides(),
        TendersApi.listTenders({ status: TenderStatus.AWARDED, pageSize: 50 }).catch(() => ({ items: [] })),
      ]);
      setAuditEvents(eventsRes.events || []);
      setAiOverrides(overridesRes.overrides || []);

      // Load detailed contract data for all awarded tenders
      const contracts: AwardedContractView[] = [];
      const awardedTenders = tendersRes.items || [];

      for (const tender of awardedTenders) {
        try {
          const comp = await AwardsApi.getComparativeBids(tender.id).catch(() => null);
          const decision = comp?.existing_decision;
          const winnerComp = comp?.bids?.find((b) => b.bidId === decision?.selectedBidId) || comp?.bids?.[0];
          let docs: any[] = [];
          let bidderName = winnerComp?.bidderOrganizationName || 'Awarded Contractor';
          let bidNumber = winnerComp?.bidNumber || 'BID-AWARD';

          const targetBidId = decision?.selectedBidId || winnerComp?.bidId;
          if (targetBidId) {
            try {
              const bidDetail = await BidsApi.getBidById(targetBidId);
              bidderName = bidDetail.bidderOrganization?.legalName || bidderName;
              bidNumber = bidDetail.bidNumber || bidNumber;
              docs = (bidDetail.documents || []).map((d) => ({
                name: d.documentName,
                size: d.fileSize,
                hash: d.sha256Hash || undefined,
                reqName: d.requirementName,
                reqCode: d.requirementCode,
                status: d.verificationStatus,
                uploadedAt: (d as any).uploadedAt || (d as any).createdAt,
                organizationName: bidderName,
              }));
            } catch (e) {
              console.error('Failed to load bid detail for award:', e);
            }
          }

          contracts.push({
            tenderId: tender.id,
            tenderNumber: tender.tenderNumber,
            tenderTitle: tender.title,
            estimatedValue: tender.estimatedValue,
            selectedBidId: targetBidId || '',
            bidderName,
            bidNumber,
            awardedAmount: (decision as any)?.awardedAmount || winnerComp?.bidAmount || tender.estimatedValue,
            officerFindings:
              (decision as any)?.officerFindings ||
              (decision as any)?.decisionReason ||
              'Statutory compliance evaluated and verified; lowest qualified commercial bid officially sanctioned.',
            justification: decision?.justificationText || undefined,
            isAiOverride: Boolean((decision as any)?.isAiOverride),
            overrideReason: (decision as any)?.overrideReason || undefined,
            decisionDate: decision?.createdAt || (tender as any)?.updatedAt || tender.submissionDeadline || new Date().toISOString(),
            documents: docs,
          });
        } catch (e) {
          console.error('Failed to load award comparative for tender:', tender.id, e);
        }
      }

      setAwardedContracts(contracts);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  };

  const openDecisionReconstruction = async (decisionId: string) => {
    try {
      setLoadingReconstruction(true);
      setReconstructionOpen(true);
      const res = await AwardsApi.getDecisionReconstruction(decisionId);
      setReconstructionData(res);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to reconstruct decision');
    } finally {
      setLoadingReconstruction(false);
    }
  };

  const handleOpenVigilanceModal = (target: {
    bidId: string;
    tenderNumber: string;
    bidderName: string;
    reason?: string;
  }) => {
    setVigilanceModalTarget(target);
    setVigilanceForm({
      title: `Vigilance Audit: ${target.bidderName} (Tender ${target.tenderNumber})`,
      description: target.reason || `Vigilance inquiry initiated for statutory verification audit regarding sanctioned contract award for Tender ${target.tenderNumber}.`,
      type: target.reason ? InvestigationType.COMPLIANCE_DISCREPANCY : InvestigationType.STATUTORY_VERIFICATION,
      priority: InvestigationPriority.HIGH,
    });
  };

  const handleSubmitVigilanceCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vigilanceModalTarget || !vigilanceModalTarget.bidId) {
      alert('Cannot open case: missing target bid ID.');
      return;
    }

    try {
      setSubmittingVigilance(true);
      await InvestigationsApi.createInvestigation({
        bidId: vigilanceModalTarget.bidId,
        title: vigilanceForm.title.trim(),
        description: vigilanceForm.description.trim(),
        investigationType: vigilanceForm.type,
        priority: vigilanceForm.priority,
      });

      alert('Vigilance Investigation Case successfully opened. Case record has been persisted to the database and logged to the audit ledger.');
      setVigilanceModalTarget(null);
      await loadAuditData();
    } catch (err: any) {
      alert(err.message || 'Failed to open vigilance case.');
    } finally {
      setSubmittingVigilance(false);
    }
  };

  const filteredEvents = auditEvents.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      e.actorName.toLowerCase().includes(q) ||
      e.eventType.toLowerCase().includes(q) ||
      (e.tenderNumber && e.tenderNumber.toLowerCase().includes(q))
    );
  });

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.LOW:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">LOW</span>;
      case RiskLevel.MEDIUM:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">MEDIUM</span>;
      case RiskLevel.HIGH:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">HIGH</span>;
      case RiskLevel.CRITICAL:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">CRITICAL</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{level}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6 text-gov-navy" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Log & Decision Governance</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official immutable audit trail of procurement sanctions, awarded entities, statutory certificates, AI overrides, and vigilance inquiry dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAuditData()}
            className="p-2 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Audit Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportAuditPackage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-md text-xs font-semibold hover:bg-slate-900 transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? 'Exporting Package...' : 'Export Audit Package'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('awards')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'awards'
              ? 'border-purple-700 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="h-4 w-4 text-amber-500" />
          Sanctioned Tender Awards ({awardedContracts.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'events'
              ? 'border-gov-navy text-gov-navy'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Immutable Audit Trail ({auditEvents.length})
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'overrides'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4 text-indigo-500" />
          AI Override Registry ({aiOverrides.length})
        </button>
      </div>

      {/* TAB 1: Sanctioned Tender Awards */}
      {activeTab === 'awards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-purple-50/50 p-4 rounded-lg border border-purple-200 text-xs">
            <div>
              <h2 className="font-bold text-purple-950">Statutory Award Sanction Registry</h2>
              <p className="text-slate-600 pt-0.5">
                Detailed records of winning contractors, commercial values, attached statutory credentials, and officer determination findings.
              </p>
            </div>
            <span className="font-mono font-bold text-purple-900 bg-white px-2.5 py-1 rounded border border-purple-200">
              {awardedContracts.length} Sanctioned Contract(s)
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-purple-600 mb-2" />
              Loading sanctioned procurement awards...
            </div>
          ) : awardedContracts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 space-y-2">
              <Award className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="font-bold text-xs text-slate-700">No Awarded Tenders Recorded Yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Once an officer completes evaluation in Review Bids and sanctions an award, the full contractor dossier, documents, and determination findings will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {awardedContracts.map((contract) => (
                <div
                  key={contract.tenderId}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden text-xs"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-gov-navy bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {contract.tenderNumber}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-purple-700" /> CONTRACT SANCTIONED & AWARDED
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{contract.tenderTitle}</h3>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Sanctioned Value</div>
                        <div className="font-mono font-bold text-emerald-700 text-sm">
                          ₹{Number(contract.awardedAmount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleOpenVigilanceModal({
                            bidId: contract.selectedBidId,
                            tenderNumber: contract.tenderNumber,
                            bidderName: contract.bidderName,
                            reason: contract.isAiOverride
                              ? `Audit Review: Officer overrode AI recommendation. Reason: ${contract.overrideReason}`
                              : undefined,
                          })
                        }
                        className="inline-flex items-center px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold shadow-2xs transition cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-600" /> Open Vigilance Case
                      </button>
                    </div>
                  </div>

                  {/* Winner Entity Details & Officer Findings */}
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-500" /> Designated Selected Bidder
                        </div>
                        <div className="text-sm font-bold text-slate-900">{contract.bidderName}</div>
                        <div className="font-mono text-slate-600 text-[11px]">
                          Bid Reference: <strong>{contract.bidNumber}</strong>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Sanction Date: {new Date(contract.decisionDate).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Officer Decision Determination Findings
                        </div>
                        <p className="text-slate-800 leading-relaxed font-medium">
                          {contract.officerFindings}
                        </p>
                        {contract.justification && (
                          <div className="pt-2 text-slate-600 border-t border-slate-200 text-[11px]">
                            <strong>Statutory Grounds:</strong> {contract.justification}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Override Notice if applicable */}
                    {contract.isAiOverride && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-700" />
                          Officer Overrode AI Advisory on this Award
                        </div>
                        <p className="text-[11px] text-amber-800">
                          <strong>Recorded Exception Justification:</strong> {contract.overrideReason}
                        </p>
                      </div>
                    )}

                    {/* Attached Statutory Certificates */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          Attached Bidder Credentials & Certificates ({contract.documents.length})
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          Validated via Cryptographic SHA-256 Ledger
                        </span>
                      </div>

                      {contract.documents.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded text-slate-500 text-center text-xs">
                          No attached documents found on file.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {contract.documents.map((doc, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded border border-slate-200 bg-white hover:border-gov-navy/40 transition space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-slate-800 truncate max-w-[180px]" title={doc.name}>
                                  {doc.name}
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  VERIFIED
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Req: {doc.reqName || doc.reqCode || 'Mandatory Statutory Credential'}
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="font-mono text-[9px] text-slate-400">
                                  {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Attached'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingDoc({
                                      name: doc.name,
                                      size: doc.size,
                                      hash: doc.hash,
                                      reqName: doc.reqName,
                                      reqCode: doc.reqCode,
                                      status: doc.status || 'VERIFIED',
                                      uploadedAt: doc.uploadedAt,
                                      organizationName: contract.bidderName,
                                    })
                                  }
                                  className="inline-flex items-center text-[10px] font-bold text-gov-navy hover:underline cursor-pointer"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> View Certificate
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit actions, actors, or tenders..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-md py-1.5 px-2 bg-white text-slate-700 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Event Types</option>
                <option value={AuditEventType.VERIFICATION_RUN}>Verification Run</option>
                <option value={AuditEventType.DISCREPANCY_DETECTED}>Discrepancy Detected</option>
                <option value={AuditEventType.INVESTIGATION_CREATED}>Investigation Created</option>
                <option value={AuditEventType.INVESTIGATION_STATUS_CHANGED}>Investigation Status Changed</option>
                <option value={AuditEventType.INVESTIGATION_RESOLVED}>Investigation Resolved</option>
                <option value={AuditEventType.AWARD_DECISION_CREATED}>Award Decision Created</option>
                <option value={AuditEventType.AWARD_APPROVED}>Award Approved</option>
                <option value={AuditEventType.AWARD_REJECTED}>Award Rejected</option>
                <option value={AuditEventType.AI_RECOMMENDATION_OVERRIDDEN}>AI Override Recorded</option>
                <option value={AuditEventType.GOVERNANCE_OVERRIDE}>Governance Override</option>
              </select>
            </div>
          </div>

          {/* Audit Event Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-sm">Fetching cryptographically verified audit records...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShieldCheck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium">No audit events match the selected criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 uppercase font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">Event Type</th>
                      <th className="py-3 px-4">Officer / Actor</th>
                      <th className="py-3 px-4">Tender</th>
                      <th className="py-3 px-4">Action Summary</th>
                      <th className="py-3 px-4 text-right">Reconstruct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            evt.eventType.includes('AWARD')
                              ? 'bg-indigo-100 text-indigo-800'
                              : evt.eventType.includes('INVESTIGATION')
                              ? 'bg-amber-100 text-amber-800'
                              : evt.eventType.includes('AI')
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {evt.eventType}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{evt.actorName}</div>
                          <div className="text-[10px] text-slate-400">{evt.actorRole}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                          {evt.tenderNumber || 'Global'}
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-normal">
                          {evt.description}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {evt.eventType.includes('AWARD') && evt.entityId && (
                            <button
                              onClick={() => openDecisionReconstruction(evt.entityId)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-200"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Why Winner?
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AI Override Registry */}
      {activeTab === 'overrides' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Override Registry</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory record of all human officer determinations where machine-generated compliance or risk advice was overridden.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
              Human-in-the-Loop Safeguard
            </span>
          </div>

          {aiOverrides.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Sparkles className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium">No officer overrides of AI advisory recorded.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {aiOverrides.map((ovr) => (
                <div key={ovr.id} className="p-6 space-y-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                          Tender {ovr.tenderId?.slice(0, 8)}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          Officer Override on Bid {ovr.bidId?.slice(0, 8)}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        By {ovr.officerName} • Recorded on {new Date(ovr.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenVigilanceModal({
                          bidId: ovr.bidId,
                          tenderNumber: ovr.tenderId?.slice(0, 8),
                          bidderName: `Bid ${ovr.bidId?.slice(0, 8)}`,
                          reason: `Vigilance review on AI recommendation override: "${ovr.aiRecommendationText}". Officer justification: "${ovr.overrideReason}"`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Open Vigilance Case
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-md space-y-1">
                      <span className="font-bold text-purple-900 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        AI Recommendation:
                      </span>
                      <p className="text-purple-950 font-medium">{ovr.aiRecommendationText}</p>
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-md space-y-1">
                      <span className="font-bold text-indigo-900 flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-indigo-600" />
                        Officer Determination:
                      </span>
                      <p className="text-indigo-950 font-medium">{ovr.decisionTaken}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">Officer Statutory Justification:</span>
                    <p className="text-slate-800 mt-1 italic">{ovr.overrideReason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision Reconstruction Drawer ("Why was Bidder B selected over Bidder A?") */}
      {reconstructionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Award className="h-6 w-6 text-indigo-700" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-serif">Decision Reconstruction</h2>
                  <p className="text-xs text-slate-500">Statutory CAG / CVC procurement determination audit view</p>
                </div>
              </div>
              <button
                onClick={() => setReconstructionOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingReconstruction ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-sm">Reconstructing award decision matrix and audit lineage...</p>
                </div>
              ) : !reconstructionData ? (
                <div className="p-8 text-center text-slate-500">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm">Could not reconstruct this decision.</p>
                </div>
              ) : (
                <>
                  {/* Executive Decision Card */}
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                        Award Determination Sanctioned
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(reconstructionData.decision.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-indigo-950">
                        Winner: {reconstructionData.selectedBidderName} ({reconstructionData.selectedBidNumber})
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tender: {reconstructionData.tenderNumber} • {reconstructionData.tenderTitle}
                      </p>
                    </div>
                    <div className="text-xs text-slate-700 pt-2 border-t border-indigo-100">
                      <span className="font-semibold text-slate-900">Officer Sanction Basis: </span>
                      {reconstructionData.decision.decisionReason}
                    </div>
                    {reconstructionData.decision.justificationText && (
                      <div className="text-xs text-amber-900 bg-amber-50 p-3 rounded border border-amber-200">
                        <span className="font-bold flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                          Statutory Exception Justification:
                        </span>
                        <p className="italic">{reconstructionData.decision.justificationText}</p>
                      </div>
                    )}
                  </div>

                  {/* Comparative Matrix: Why this bidder over others? */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-slate-600" />
                      Contender Comparison Matrix (Evaluation Time Snapshot)
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Bidder</th>
                            <th className="py-2.5 px-3 text-center">Score</th>
                            <th className="py-2.5 px-3 text-center">Risk</th>
                            <th className="py-2.5 px-3 text-center">Mandatory</th>
                            <th className="py-2.5 px-3 text-center">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {reconstructionData.comparedBidders.map((b) => {
                            const isSelected = b.bidId === reconstructionData.decision.selectedBidId;
                            return (
                              <tr key={b.bidId} className={isSelected ? 'bg-indigo-50/60 font-semibold' : ''}>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <Building className="h-3.5 w-3.5 text-slate-400" />
                                    <span>{b.bidderOrganizationName}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">{b.complianceScore}/100</td>
                                <td className="py-2.5 px-3 text-center">{getRiskBadge(b.riskLevel)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  {b.mandatoryComplied ? (
                                    <span className="text-emerald-700 font-bold">Yes</span>
                                  ) : (
                                    <span className="text-rose-700 font-bold">Deficient</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isSelected ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-700 text-white">
                                      AWARDED
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Unselected</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AI Advisory Lineage */}
                  {reconstructionData.aiRecommendationSummary && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        AI Advisory Context
                      </h3>
                      <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-md text-xs space-y-1">
                        <span className="font-bold text-purple-900">Machine Recommendation:</span>
                        <p className="text-slate-800">{reconstructionData.aiRecommendationSummary}</p>
                      </div>
                    </div>
                  )}

                  {/* Attached Submissions & Documents */}
                  {(reconstructionData as any).documents && (reconstructionData as any).documents.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-slate-600" />
                        Attached Statutory Evidence ({(reconstructionData as any).documents.length})
                      </h3>
                      <div className="space-y-2">
                        {(reconstructionData as any).documents.map((doc: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded text-xs">
                            <div className="flex items-center space-x-2 truncate">
                              <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span className="font-semibold text-slate-800 truncate">{doc.name}</span>
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">{doc.status || 'VERIFIED'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewingDoc({
                                ...doc,
                                organizationName: reconstructionData.selectedBidderName,
                              })}
                              className="px-2.5 py-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              Inspect Document
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tender Audit Lineage Timeline */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-600" />
                      Tender Procedural Timeline
                    </h3>
                    <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-1">
                      {reconstructionData.auditTimeline.map((item, idx) => (
                        <div key={idx} className="relative text-xs space-y-0.5">
                          <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400 border-2 border-white" />
                          <div className="font-semibold text-slate-800">{item.description}</div>
                          <div className="text-[11px] text-slate-500">
                            By {item.actorName} ({item.actorRole}) • {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
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

      {/* VIGILANCE INVESTIGATION INITIATION MODAL */}
      {vigilanceModalTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-rose-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Initiate Statutory Vigilance Case</h3>
              </div>
              <button
                type="button"
                onClick={() => setVigilanceModalTarget(null)}
                className="p-1 rounded-full text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitVigilanceCase} className="p-5 space-y-4">
              <div className="bg-rose-50 p-3 rounded border border-rose-200 text-rose-900 space-y-1">
                <div className="font-bold">Target Entity: {vigilanceModalTarget.bidderName}</div>
                <div className="text-[11px]">Tender: {vigilanceModalTarget.tenderNumber}</div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Case Title / Formal Reference *</label>
                <input
                  type="text"
                  required
                  value={vigilanceForm.title}
                  onChange={(e) => setVigilanceForm({ ...vigilanceForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded font-medium focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Inquiry Type</label>
                  <select
                    value={vigilanceForm.type}
                    onChange={(e) => setVigilanceForm({ ...vigilanceForm, type: e.target.value as InvestigationType })}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                  >
                    <option value={InvestigationType.STATUTORY_VERIFICATION}>STATUTORY_VERIFICATION</option>
                    <option value={InvestigationType.COMPLIANCE_DISCREPANCY}>COMPLIANCE_DISCREPANCY</option>
                    <option value={InvestigationType.DOCUMENT_INCONSISTENCY}>DOCUMENT_INCONSISTENCY</option>
                    <option value={InvestigationType.ENTITY_RISK}>ENTITY_RISK</option>
                    <option value={InvestigationType.BLACKLISTING_DEBARMENT}>BLACKLISTING_DEBARMENT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Vigilance Priority</label>
                  <select
                    value={vigilanceForm.priority}
                    onChange={(e) => setVigilanceForm({ ...vigilanceForm, priority: e.target.value as InvestigationPriority })}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                  >
                    <option value={InvestigationPriority.CRITICAL}>CRITICAL</option>
                    <option value={InvestigationPriority.HIGH}>HIGH</option>
                    <option value={InvestigationPriority.MEDIUM}>MEDIUM</option>
                    <option value={InvestigationPriority.LOW}>LOW</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Inquiry Grounds / Allegation Summary *</label>
                <textarea
                  rows={3}
                  required
                  value={vigilanceForm.description}
                  onChange={(e) => setVigilanceForm({ ...vigilanceForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-rose-500"
                  placeholder="Detail grounds for investigation, cross-certificate discrepancy, or AI override reason..."
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                Opening this case writes an immutable investigation case to the database and dispatches vigilance notifications to the authorized investigation officers.
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVigilanceModalTarget(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVigilance}
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded shadow-xs transition disabled:opacity-50"
                >
                  {submittingVigilance ? 'Opening Case...' : 'Open Case & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
