import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, Building2, AlertCircle, ArrowLeft, ShieldCheck, Bot, Volume2, VolumeX, FileText, Download, Sparkles, CheckCircle2 } from 'lucide-react';
import { TenderDetail, BidListItem } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { BidsApi } from '../../services/bids';
import { useSpeaker } from '../../hooks/useSpeaker';
import { useRoleContext } from '../../contexts/RoleContext';

export const BidderTenderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [myBid, setMyBid] = useState<BidListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSpeaking, isSupported: speakerSupported, speak, stop: stopSpeaker } = useSpeaker();
  const { language, t } = useRoleContext();

  const fetchTender = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [data, myBidsRes] = await Promise.all([
        TendersApi.getTenderById(id),
        BidsApi.getMyBids().catch(() => ({ items: [] as BidListItem[] }))
      ]);
      setTender(data);
      const bidsList: BidListItem[] = Array.isArray(myBidsRes) ? myBidsRes : myBidsRes?.items || [];
      const matched = bidsList.find((b: BidListItem) => b.tenderId === id);
      setMyBid(matched || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tender specifications.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTender();
  }, [fetchTender]);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading tender specifications...</div>;
  }

  if (error || !tender) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white rounded-lg border border-slate-200 shadow-sm text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Tender Unavailable</h2>
        <p className="text-xs text-slate-500">{error || 'Tender record not found.'}</p>
        <Link to="/bidder/tenders" className="inline-block text-xs font-semibold text-gov-navy hover:underline">
          Return to Browse Tenders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back link */}
      <div className="pb-3 border-b border-slate-200">
        <Link
          to="/bidder/tenders"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-gov-navy"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Public Tenders
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {tender.tenderNumber}
            </span>
            {myBid && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-600" /> APPLIED ({myBid.bidNumber})
              </span>
            )}
            {tender.procuringOrganization && (
              <span className="text-xs text-slate-600 flex items-center">
                <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {tender.procuringOrganization.legalName}
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900 pt-1">{tender.title}</h1>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to={`/bidder/ai-assistant?tenderId=${tender.id}`}
            className="inline-flex items-center px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md shadow-2xs"
          >
            <Bot className="w-4 h-4 mr-1.5" /> Ask AI
          </Link>
          <Link
            to={`/bidder/self-check?tenderId=${tender.id}`}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5 text-amber-600" /> Self-Check
          </Link>
          {myBid ? (
            <Link
              to={`/bidder/applications/${myBid.id}`}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-md shadow-sm"
            >
              View Submitted Application
            </Link>
          ) : (
            <Link
              to={`/bidder/tenders/${tender.id}/apply`}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
            >
              Apply for this Tender
            </Link>
          )}
        </div>
      </div>


      {/* Key Dates & Value */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Submission Deadline</div>
          <div className="font-bold text-slate-900 flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            {new Date(tender.submissionDeadline).toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Estimated Value</div>
          <div className="font-bold text-slate-900">
            {tender.estimatedValue ? `${tender.currency} ${tender.estimatedValue.toLocaleString()}` : 'Refer tender document'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Minimum Operational Age</div>
          <div className="font-bold text-slate-900">
            {tender.minimumCompanyAgeYears ? `${tender.minimumCompanyAgeYears} Years` : 'No restriction'}
          </div>
        </div>
      </div>

      {/* Tender Document File Download (if available) */}
      {tender.tenderDocument && (
        <div className="bg-white rounded-lg border border-indigo-100 p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Official Tender Document / RFP</div>
              <div className="text-[11px] text-slate-500 font-mono">{tender.tenderDocument}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (tender.tenderDocument?.startsWith('http')) {
                window.open(tender.tenderDocument, '_blank');
              } else {
                const element = window.document.createElement('a');
                const file = new Blob(
                  [
                    `OFFICIAL TENDER NOTICE & RFP SPECIFICATION\n` +
                    `Tender Number: ${tender.tenderNumber}\n` +
                    `Title: ${tender.title}\n` +
                    `Procuring Organization: ${tender.procuringOrganization?.legalName || 'Government Procuring Entity'}\n` +
                    `Submission Deadline: ${tender.submissionDeadline}\n` +
                    `Document Reference: ${tender.tenderDocument}\n\n` +
                    `Description & Scope of Work:\n${tender.description || 'See tender terms'}\n`
                  ],
                  { type: 'text/plain;charset=utf-8' }
                );
                element.href = URL.createObjectURL(file);
                element.download = `${tender.tenderNumber}_RFP_Spec.txt`;
                window.document.body.appendChild(element);
                element.click();
                window.document.body.removeChild(element);
              }
            }}
            className="inline-flex items-center px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download RFP Spec
          </button>
        </div>
      )}

      {/* Description & Executive Summary */}
      {tender.description && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Executive Scope & Statutory Brief
            </h2>
            {speakerSupported && (
              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeaker();
                  } else {
                    speak(tender.description || '', language);
                  }
                }}
                className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold transition border ${
                  isSpeaking
                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                }`}
                title="Listen to Executive Summary"
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5 mr-1 text-amber-700" /> : <Volume2 className="w-3.5 h-3.5 mr-1 text-slate-600" />}
                {isSpeaking ? (t ? t('action.speaking') : 'Speaking...') : '🔊 Listen to Summary'}
              </button>
            )}
          </div>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">{tender.description}</p>
        </div>
      )}

      {/* Structured Requirements Breakdown */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Mandatory & Evaluation Requirements ({tender.requirements.length})
          </h2>
          <p className="text-xs text-slate-500">
            Ensure your organization has the required evidence or digital credentials ready prior to submission
          </p>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
          {tender.requirements.map((req) => (
            <div key={req.id} className="p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-gov-navy bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {req.code}
                  </span>
                  <span className="font-bold text-slate-900">{req.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  req.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {req.isMandatory ? 'Mandatory' : 'Optional / Scoring'}
                </span>
              </div>

              {req.description && <p className="text-slate-500">{req.description}</p>}

              <div className="flex flex-wrap gap-2 text-[11px] pt-1 text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                <div><strong>Category:</strong> {req.category}</div>
                <div>•</div>
                <div><strong>Evidence Required:</strong> {req.evidenceTypes.join(', ') || 'Attestation / Form'}</div>
                <div>•</div>
                <div><strong>Verification Authority:</strong> {req.verificationSources.join(', ') || 'Statutory Registry'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
