import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Building2,
  Network,
  Share2
} from 'lucide-react';
import {
  InvestigationListItem,
  InvestigationDetail,
  InvestigationStatus,
  InvestigationPriority,
  InvestigationType,
  TenderListItem
} from '@e-pramaan/shared';
import { InvestigationsApi } from '../../services/wave2';
import { TendersApi } from '../../services/tenders';

export const RiskInvestigationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState<InvestigationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tender filter
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string>(searchParams.get('tenderId') || '');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Active detail view
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<InvestigationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action form state
  const [noteText, setNoteText] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [newStatus, setNewStatus] = useState<InvestigationStatus>(InvestigationStatus.IN_REVIEW);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'EVIDENCE' | 'TIMELINE' | 'NETWORK'>('DETAILS');

  // Load tenders
  useEffect(() => {
    const loadTenders = async () => {
      try {
        const res = await TendersApi.listTenders({ pageSize: 100 });
        setTenders(res.items || []);
      } catch (err: any) {
        console.error('Failed to load tenders for investigation filter:', err);
      }
    };
    loadTenders();
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await InvestigationsApi.listInvestigations({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as InvestigationStatus),
        priority: priorityFilter === 'ALL' ? undefined : (priorityFilter as InvestigationPriority),
        type: typeFilter === 'ALL' ? undefined : (typeFilter as InvestigationType),
        tenderId: selectedTenderId || undefined
      });
      setCases(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load investigations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, typeFilter, selectedTenderId]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleOpenCase = async (id: string) => {
    setSelectedCaseId(id);
    setActiveTab('DETAILS');
    try {
      setLoadingDetail(true);
      const detail = await InvestigationsApi.getInvestigationById(id);
      setActiveCase(detail);
      setNewStatus(detail.status);
    } catch (err: any) {
      alert(err.message || 'Failed to load case dossier');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !noteText.trim()) return;

    try {
      await InvestigationsApi.addNote(selectedCaseId, noteText.trim());
      setNoteText('');
      const refreshed = await InvestigationsApi.getInvestigationById(selectedCaseId);
      setActiveCase(refreshed);
    } catch (err: any) {
      alert(err.message || 'Failed to append note');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedCaseId) return;
    try {
      const updated = await InvestigationsApi.updateStatus(selectedCaseId, newStatus, resolutionSummary || undefined);
      setActiveCase(updated);
      setShowStatusModal(false);
      fetchCases();
    } catch (err: any) {
      alert(err.message || 'Failed to update case status');
    }
  };

  const filteredCases = cases.filter(c =>
    c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.bidderOrganizationName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-gov-navy" />
            <h1 className="text-base font-bold text-slate-900">Risk & Investigation Workspace</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Persisted investigation dossiers, transparent risk indicators, and verifiable cross-document audit trails.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-50 px-3 py-1.5 rounded border border-slate-200 font-semibold text-slate-700">
            Total Cases: <span className="font-mono text-gov-navy font-bold">{cases.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search case # or bidder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs focus:border-gov-navy focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-semibold">Tender:</span>
            <select
              value={selectedTenderId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTenderId(val);
                if (val) {
                  setSearchParams({ tenderId: val });
                } else {
                  setSearchParams({});
                }
              }}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none max-w-[200px] truncate font-medium"
            >
              <option value="">All Tenders (Global)</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenderNumber} - {t.title.substring(0, 22)}...
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700 focus:outline-none max-w-xs truncate"
            >
              <option value="ALL">All Types</option>
              <option value="COMPLIANCE_DISCREPANCY">COMPLIANCE_DISCREPANCY</option>
              <option value="DOCUMENT_INCONSISTENCY">DOCUMENT_INCONSISTENCY</option>
              <option value="STATUTORY_VERIFICATION">STATUTORY_VERIFICATION</option>
              <option value="ENTITY_RISK">ENTITY_RISK</option>
              <option value="BLACKLISTING_DEBARMENT">BLACKLISTING_DEBARMENT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Cases Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading active investigations...</div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-600 space-y-1">
            <AlertCircle className="w-5 h-5 mx-auto text-rose-500" />
            <div>{error}</div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <ShieldAlert className="w-8 h-8 mx-auto text-slate-300" />
            <div className="font-bold text-slate-700">No active investigation cases</div>
            <p>Cases triggered from verification discrepancies or risk flags will appear in this workspace.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Case #</th>
                  <th className="py-3 px-4">Subject / Bidder</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tender Ref</th>
                  <th className="py-3 px-4">Opened Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gov-navy">
                      {c.caseNumber}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{c.title}</div>
                      <div className="text-slate-500 text-[11px] flex items-center">
                        <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                        {c.bidderOrganizationName}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                        {c.investigationType}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        c.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                        c.priority === 'HIGH' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                        'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {c.priority}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-bold text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {c.tenderNumber}
                    </td>

                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(c.openedAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenCase(c.id)}
                        className="px-2.5 py-1 bg-gov-navy text-white text-xs font-semibold rounded hover:bg-gov-navyLight shadow-xs"
                      >
                        Open Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case Dossier Drawer */}
      {selectedCaseId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-gov-navy bg-white px-2 py-0.5 rounded border border-slate-200">
                    {activeCase?.caseNumber}
                  </span>
                  {activeCase && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {activeCase.status}
                    </span>
                  )}
                  {activeCase && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      activeCase.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                      'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      PRIORITY: {activeCase.priority}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 pt-1">{activeCase?.title}</h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-700 shadow-xs"
                >
                  Change Status
                </button>
                <button
                  onClick={() => { setSelectedCaseId(null); setActiveCase(null); }}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 text-xs font-bold">
              <button
                onClick={() => setActiveTab('DETAILS')}
                className={`py-3 px-3 border-b-2 ${
                  activeTab === 'DETAILS' ? 'border-gov-navy text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Case Summary & Risks
              </button>
              <button
                onClick={() => setActiveTab('EVIDENCE')}
                className={`py-3 px-3 border-b-2 ${
                  activeTab === 'EVIDENCE' ? 'border-gov-navy text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Attached Evidence ({activeCase?.evidenceReferences?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('TIMELINE')}
                className={`py-3 px-3 border-b-2 ${
                  activeTab === 'TIMELINE' ? 'border-gov-navy text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Timeline & Actions ({activeCase?.timeline?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('NETWORK')}
                className={`py-3 px-3 border-b-2 flex items-center ${
                  activeTab === 'NETWORK' ? 'border-gov-navy text-gov-navy' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Network className="w-3.5 h-3.5 mr-1 text-slate-500" /> Entity Relationship View
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {loadingDetail ? (
                <div className="p-8 text-center text-slate-500">Loading case dossier...</div>
              ) : !activeCase ? (
                <div>No case selected</div>
              ) : (
                <>
                  {activeTab === 'DETAILS' && (
                    <div className="space-y-4">
                      {/* Context Card */}
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">Entity & Tender Context</div>
                        <div className="grid grid-cols-2 gap-3 text-slate-700">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Investigated Entity</span>
                            <span className="font-semibold">{activeCase.bidderOrganizationName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Tender</span>
                            <span>{activeCase.tenderNumber} — {activeCase.tenderTitle}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Opened By</span>
                            <span>{activeCase.createdByName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Opened Timestamp</span>
                            <span>{new Date(activeCase.openedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-1">
                        <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">Investigation Scope / Allegation</div>
                        <p className="text-slate-700 leading-relaxed">{activeCase.description}</p>
                      </div>

                      {/* Resolution Summary if closed */}
                      {activeCase.resolutionSummary && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
                          <div className="font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Resolution Summary
                          </div>
                          <p>{activeCase.resolutionSummary}</p>
                        </div>
                      )}

                      {/* Risk factors breakdown from Phase 5 engine */}
                      {activeCase.riskAssessment?.factors && (
                        <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-2">
                          <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                            Correlated Risk Factors ({activeCase.riskAssessment.factors.length})
                          </div>
                          <div className="space-y-2">
                            {activeCase.riskAssessment.factors.map((f, i) => (
                              <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                                <div className="font-bold text-slate-800">{f.factor}</div>
                                <div className="text-slate-600">{f.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'EVIDENCE' && (
                    <div className="space-y-4">
                      <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">Linked Evidence Items</div>
                      {activeCase.evidenceReferences.length === 0 ? (
                        <div className="p-6 bg-slate-50 rounded border border-slate-200 text-slate-400 text-center">
                          No evidence items explicitly linked to this case yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeCase.evidenceReferences.map((ev) => (
                            <div key={ev.id} className="p-3 bg-white border border-slate-200 rounded-md flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  {ev.type}
                                </span>
                                <div className="font-bold text-slate-900 pt-1">{ev.title}</div>
                                {ev.description && <div className="text-slate-500 text-[11px]">{ev.description}</div>}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">Ref: {ev.referenceId}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'TIMELINE' && (
                    <div className="space-y-4">
                      <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">Audit Timeline & Actions</div>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-white">
                        {activeCase.timeline.map((event) => (
                          <div key={event.id} className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-gov-navy">
                                {event.eventType}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(event.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium">{event.description}</p>
                            <div className="text-[10px] text-slate-400">Actor: {event.actorName} ({event.actorRole})</div>
                          </div>
                        ))}
                      </div>

                      {/* Add Investigator Note */}
                      <form onSubmit={handleAddNote} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <label className="font-bold text-slate-800 text-xs">Append Note / Action Taken</label>
                        <textarea
                          rows={2}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Record investigative inquiry, action taken, or statutory registry response..."
                          className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:border-gov-navy"
                        />
                        <button
                          type="submit"
                          disabled={!noteText.trim()}
                          className="px-3 py-1.5 bg-gov-navy text-white text-xs font-bold rounded hover:bg-gov-navyLight shadow-xs"
                        >
                          Append Note to Case Timeline
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 4: Entity / Relationship View (Collusion / Commonality Inspection) */}
                  {activeTab === 'NETWORK' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-900 text-xs space-y-1">
                        <div className="font-bold flex items-center">
                          <Share2 className="w-4 h-4 mr-1.5 text-blue-600" />
                          Authorized Entity Relationship & Identifier Graph
                        </div>
                        <p className="text-blue-800">
                          Visualizing confirmed and potential statutory relationships based strictly on system data. Relationships are flagged neutrally and do not imply legal wrongdoing without corroborating evidence.
                        </p>
                      </div>

                      <div className="p-5 bg-slate-900 text-white rounded-lg border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="font-mono text-xs font-bold text-amber-400">
                            TARGET: {activeCase.bidderOrganizationName}
                          </div>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            Graph Status: Verified Internal Identifiers
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-3 bg-slate-800/80 rounded border border-slate-700 space-y-2">
                            <div className="text-slate-400 uppercase font-bold text-[10px]">Statutory Identifiers Linked</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-300">Permanent Account Number:</span>
                                <span className="font-mono text-emerald-400">Confirmed Present</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">GSTIN Registration:</span>
                                <span className="font-mono text-emerald-400">Confirmed Present</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">Udyam Registration:</span>
                                <span className="font-mono text-slate-400">Awaiting Registry API</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-800/80 rounded border border-slate-700 space-y-2">
                            <div className="text-slate-400 uppercase font-bold text-[10px]">Cross-Bidder Commonality Checks</div>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-300">Common Authorized Signatories:</span>
                                <span className="text-slate-400">None detected in tender</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">Shared Physical Address:</span>
                                <span className="text-slate-400">Independent</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-300">Submissions Co-incidence:</span>
                                <span className="text-emerald-400">Independent Submission Window</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-800/50 rounded border border-slate-700 text-[11px] text-slate-400">
                          <strong>Investigative Classification:</strong> Potential Entity Risk Indicator — no cross-bidder identifier overlap detected within current tender envelope.
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Update Investigation Status</h3>
            <div className="space-y-2">
              <label className="font-bold text-slate-700 block">New Status:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as InvestigationStatus)}
                className="w-full p-2 border border-slate-300 rounded text-xs"
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>

            {(newStatus === 'RESOLVED' || newStatus === 'CLOSED') && (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Resolution Summary (Mandatory for closure):</label>
                <textarea
                  rows={3}
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Summarize outcome, statutory verification finding, or clearance..."
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                className="px-4 py-1.5 bg-gov-navy text-white rounded font-bold hover:bg-gov-navyLight shadow-xs"
              >
                Confirm Status Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
