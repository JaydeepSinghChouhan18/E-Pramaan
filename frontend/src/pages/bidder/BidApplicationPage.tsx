import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Clock,
  UploadCloud,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  FileText
} from 'lucide-react';
import { BidDetail, BidDocument, TenderDetail, BidderVerificationSummary } from '@e-pramaan/shared';
import { BidsApi } from '../../services/bids';
import { TendersApi } from '../../services/tenders';
import { ComplianceApi } from '../../services/compliance';
import { useAuth } from '../../contexts/AuthContext';


export const BidApplicationPage: React.FC = () => {
  const { tenderId, bidId } = useParams<{ tenderId?: string; bidId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bid, setBid] = useState<BidDetail | null>(null);
  const [tender, setTender] = useState<TenderDetail | null>(null);

  // Upload state per requirement
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Final submission state
  const [bidAmount, setBidAmount] = useState<string>('');
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [verificationSummary, setVerificationSummary] = useState<BidderVerificationSummary | null>(null);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let activeBid: BidDetail | null = null;

      if (bidId) {
        // Direct bid link
        activeBid = await BidsApi.getBidById(bidId);
        setBid(activeBid);
        if (activeBid.tender) {
          setTender(activeBid.tender);
        }
        // Load verification summary if not in draft
        if (activeBid.status !== 'DRAFT') {
          ComplianceApi.getBidderSummary(bidId)
            .then(res => setVerificationSummary(res))
            .catch(() => setVerificationSummary(null));
        }
      } else if (tenderId) {
        // Find existing application or fetch tender to initialize
        const tenderData = await TendersApi.getTenderById(tenderId);
        setTender(tenderData);

        // Check if bidder already has a bid for this tender
        const myBids = await BidsApi.getMyBids({ pageSize: 50 });
        const existing = myBids.items.find(b => b.tenderId === tenderId && b.status !== 'WITHDRAWN');

        if (existing) {
          activeBid = await BidsApi.getBidById(existing.id);
          setBid(activeBid);
          if (activeBid.status !== 'DRAFT') {
            ComplianceApi.getBidderSummary(existing.id)
              .then(res => setVerificationSummary(res))
              .catch(() => setVerificationSummary(null));
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize bid application.');
    } finally {
      setLoading(false);
    }
  }, [bidId, tenderId]);


  useEffect(() => {
    initData();
  }, [initData]);

  // Handle starting a new draft bid
  const handleStartApplication = async () => {
    if (!tender) return;
    try {
      setLoading(true);
      setError(null);
      const newBid = await BidsApi.createDraftBid({ tenderId: tender.id });
      setBid(newBid);
      navigate('/bidder/applications/' + newBid.id, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize bid draft.');
    } finally {
      setLoading(false);
    }
  };

  // Simulate file upload and attach document metadata with sha256 calculation
  const handleFileUpload = async (reqId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !bid) return;

    const file = files[0];
    setUploadingReqId(reqId);
    setUploadError(null);

    try {
      // 1. Try real multipart upload to backend for server-side SHA-256 and OCR extraction
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenderRequirementId', reqId);
      formData.append('metadata', JSON.stringify({
        originalName: file.name,
        lastModified: file.lastModified
      }));

      try {
        await BidsApi.uploadDocument(bid.id, formData);
      } catch (uploadErr) {
        // Fallback to metadata attachment with client SHA-256 calculation
        console.warn('Multipart upload fallback:', uploadErr);
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await BidsApi.attachDocument(bid.id, {
          tenderRequirementId: reqId,
          documentName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/pdf',
          sha256Hash: hashHex,
          metadata: {
            originalName: file.name,
            lastModified: file.lastModified
          }
        });
      }

      // Refresh bid data
      const refreshed = await BidsApi.getBidById(bid.id);
      setBid(refreshed);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to attach document.');
    } finally {
      setUploadingReqId(null);
      event.target.value = '';
    }
  };

  // Remove document
  const handleRemoveDocument = async (docId: string) => {
    if (!bid || !window.confirm('Are you sure you want to remove this document?')) return;
    try {
      await BidsApi.removeDocument(bid.id, docId);
      const refreshed = await BidsApi.getBidById(bid.id);
      setBid(refreshed);
    } catch (err: any) {
      alert(err.message || 'Failed to remove document.');
    }
  };

  // Submit Bid
  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bid) return;

    try {
      setSubmitting(true);
      setError(null);

      const parsedAmount = bidAmount.trim() ? parseFloat(bidAmount.replace(/,/g, '')) : undefined;
      const submitted = await BidsApi.submitBid(bid.id, {
        confirmation: declarationConfirmed,
        bidAmount: parsedAmount,
        submissionNotes: submissionNotes || undefined
      });

      setBid(submitted);
      setSubmitSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Bid submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading bid application workspace...</div>;
  }

  if (error && !bid && !tender) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white rounded-lg border border-slate-200 shadow-sm text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">Application Initialization Error</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <Link to="/bidder/tenders" className="inline-block text-xs font-semibold text-gov-navy hover:underline">
          Return to Public Tenders
        </Link>
      </div>
    );
  }

  // Pre-application Screen (if user navigated to /apply but has not created a draft yet)
  if (!bid && tender) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="pb-3 border-b border-slate-200">
          <Link to={'/bidder/tenders/' + tender.id} className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-gov-navy">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tender Specifications
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {tender.tenderNumber}
            </span>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              PUBLISHED & OPEN
            </span>
          </div>

          <h1 className="text-lg font-bold text-slate-900">{tender.title}</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            You are initiating a formal bid response on behalf of <strong>{user?.organization?.legalName || 'your registered organization'}</strong>.
            Ensure you have all mandatory statutory and technical credentials available for digital submission.
          </p>

          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-800">Submission Guidelines:</div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>All mandatory compliance items require attached verifiable documentation.</li>
              <li>Once submitted, your bid is locked and securely made available to the procuring officer.</li>
              <li>Uploaded documents will enter <strong>PENDING_VERIFICATION</strong> status for automated registry cross-checks.</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartApplication}
              className="px-5 py-2.5 bg-gov-navy text-white text-xs font-bold rounded-md hover:bg-gov-navyLight shadow-sm"
            >
              Start Bid Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!bid) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header breadcrumb */}
      <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
        <Link to="/bidder/applications" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-gov-navy">
          <ArrowLeft className="w-4 h-4 mr-1" /> My Applications
        </Link>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">Application Number:</span>
          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {bid.bidNumber}
          </span>
        </div>
      </div>

      {/* Success banner after submission */}
      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-1">
          <div className="font-bold text-emerald-900 flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            Bid Application Submitted Successfully
          </div>
          <p className="text-emerald-700">
            Your bid has been recorded with timestamp <strong>{new Date(bid.submittedAt || '').toLocaleString()}</strong>.
            Your submitted documents are queued for verification.
          </p>
        </div>
      )}

      {/* Top Application Overview Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {bid.tender?.tenderNumber}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                bid.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                bid.status === 'UNDER_REVIEW' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                bid.status === 'WITHDRAWN' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                STATUS: {bid.status}
              </span>
            </div>
            <h1 className="text-base font-bold text-slate-900 pt-1">{bid.tender?.title}</h1>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Submission Deadline</div>
            <div className="text-xs font-bold text-slate-800 flex items-center justify-end">
              <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
              {bid.tender ? new Date(bid.tender.submissionDeadline).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Bidder & Procuring info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Applying Organization</div>
            <div className="font-bold text-slate-900 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1 text-slate-500" />
              {bid.bidderOrganization?.legalName}
            </div>
            {bid.bidderOrganization?.identifier && (
              <div className="text-slate-500 text-[11px]">Identifier: {bid.bidderOrganization.identifier}</div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Procuring Organization</div>
            <div className="font-bold text-slate-900">
              {bid.tender?.procuringOrganization?.legalName || 'Government Procurement Agency'}
            </div>
            <div className="text-slate-500 text-[11px]">
              Submission Ref: {bid.bidNumber}
            </div>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Step 2: Requirement Documents Matrix */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Compliance Requirements & Evidence Checklist ({bid.requirementsMap?.length || 0})
          </h2>
          <p className="text-xs text-slate-500">
            Upload corresponding verification documents for each requirement. Mandatory requirements must have evidence attached before submission.
          </p>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
          {bid.requirementsMap?.map(({ requirement: req, documents, isSatisfied }) => (
            <div key={req.id} className="p-4 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-gov-navy bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {req.code}
                    </span>
                    <span className="font-bold text-slate-900">{req.name}</span>
                    {req.isMandatory ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        Optional
                      </span>
                    )}
                  </div>
                  {req.description && <p className="text-slate-500">{req.description}</p>}
                </div>

                <div className="flex items-center space-x-2">
                  {isSatisfied ? (
                    <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Evidence Attached
                    </span>
                  ) : req.isMandatory ? (
                    <span className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-bold">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Pending Upload
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Not Provided</span>
                  )}
                </div>
              </div>

              {/* Requirement details */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded flex flex-wrap gap-2">
                <span><strong>Category:</strong> {req.category}</span>
                <span>•</span>
                <span><strong>Accepted Evidence:</strong> {req.evidenceTypes.join(', ') || 'Attestation / PDF'}</span>
                <span>•</span>
                <span><strong>Verification Authority:</strong> {req.verificationSources.join(', ') || 'Registry Check'}</span>
              </div>

              {/* Attached Documents for this requirement */}
              {documents.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Attached Documents:</div>
                  <div className="space-y-1.5">
                    {documents.map((doc: BidDocument) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center space-x-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-gov-navy flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">{doc.documentName}</span>
                            <span className="text-slate-400 text-[10px] ml-2">
                              ({(doc.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            PENDING_VERIFICATION
                          </span>
                          {bid.canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(doc.id)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Dropzone / Button (only if editable) */}
              {bid.canEdit && (
                <div className="pt-1">
                  <label className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-gov-navy" />
                    {uploadingReqId === req.id ? 'Attaching Document...' : 'Attach Document / Certificate'}
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploadingReqId !== null}
                      onChange={(e) => handleFileUpload(req.id, e)}
                    />
                  </label>
                  {/* DigiLocker Demo simulation button */}
                  <button
                    type="button"
                    onClick={() => {
                      // Simulate quick fetch from DigiLocker for demo
                      BidsApi.attachDocument(bid.id, {
                        tenderRequirementId: req.id,
                        documentName: `DigiLocker_${req.code}_Verified_Cert.pdf`,
                        fileSize: 142050,
                        mimeType: 'application/pdf',
                        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                        metadata: {
                          source: 'DIGILOCKER_VERIFIED_DOC_VAULT',
                          verifiedIssuer: 'UIDAI_OR_MINISTRY_RECORDS'
                        }
                      }).then(() => BidsApi.getBidById(bid.id)).then(refreshed => setBid(refreshed));
                    }}
                    className="inline-flex items-center ml-2 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded text-xs font-semibold text-indigo-700 hover:bg-indigo-100 shadow-xs"
                    title="Simulate instant fetching verified credential from DigiLocker"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    Fetch from DigiLocker (Demo)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: Final Review & Submission Section */}
      {bid.canEdit ? (
        <form onSubmit={handleSubmitBid} className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Review & Final Submission
          </h2>

          {/* Missing mandatory alert */}
          {bid.missingMandatoryRequirements.length > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center">
                <AlertCircle className="w-4 h-4 mr-1 text-amber-700" />
                Missing Mandatory Documents ({bid.missingMandatoryRequirements.length})
              </div>
              <p className="text-amber-800">
                You must attach valid evidence for the following mandatory items before submitting:
              </p>
              <ul className="list-disc list-inside font-medium text-amber-900">
                {bid.missingMandatoryRequirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600 flex-shrink-0" />
              All mandatory tender requirements have attached documentation. Your bid is eligible for submission.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Financial Bid Amount (INR) *</span>
              {tender?.estimatedValue && (
                <span className="text-[11px] text-slate-500 font-normal">
                  Tender Estimate: ₹{tender.estimatedValue.toLocaleString('en-IN')}
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-500 pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="e.g. 118000000"
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded focus:border-gov-navy focus:outline-none font-semibold text-slate-800"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Total lump-sum inclusive of all statutory duties, taxes, and cess as per GFR Rule 149.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">Optional Submission Notes / Remarks</label>
            <textarea
              rows={3}
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Any comments, remarks, or reference numbers for the evaluation committee..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded focus:border-gov-navy focus:outline-none"
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={declarationConfirmed}
                onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gov-navy focus:ring-gov-navy"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                I hereby solemnly declare and affirm that all certificates, tax documents, and declarations uploaded herein are genuine and authentic. I acknowledge that any falsification constitutes a disqualification under the General Financial Rules (GFR).
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Once submitted, your bid cannot be edited.
            </span>
            <button
              type="submit"
              disabled={!bid.canSubmit || !declarationConfirmed || submitting}
              className={`inline-flex items-center px-6 py-2.5 text-xs font-bold rounded-md shadow-sm text-white ${
                bid.canSubmit && declarationConfirmed && !submitting
                  ? 'bg-gov-navy hover:bg-gov-navyLight'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? 'Submitting Bid Application...' : 'Submit Final Bid Application'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-gov-navy" />
              <span>Submission Locked</span>
            </div>
            <p className="text-xs text-slate-600">
              This application is in <strong>{bid.status}</strong> status. Attached documents and responses are locked for official procurement evaluation.
            </p>
          </div>

          {/* Bidder Phase 5 Verification Status */}
          {verificationSummary && (
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 uppercase text-xs">
                  Automated Verification Screening Results
                </h3>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                  verificationSummary.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  verificationSummary.verificationStatus === 'DISCREPANCY' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  STATUS: {verificationSummary.verificationStatus}
                </span>
              </div>

              {verificationSummary.discrepancies.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded space-y-1.5">
                  <div className="font-bold text-rose-800">Identified Discrepancies:</div>
                  {verificationSummary.discrepancies.map((d, i) => (
                    <div key={i} className="text-slate-700 font-medium">
                      • <strong>{d.title}</strong>: {d.description}
                    </div>
                  ))}
                </div>
              )}

              <div className="divide-y divide-slate-100 border border-slate-200 rounded">
                {verificationSummary.evaluations.map((ev, i) => (
                  <div key={i} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{ev.requirementCode}</span>
                      <span className="font-semibold text-slate-900 ml-2">{ev.requirementName}</span>
                      {ev.reasons.length > 0 && (
                        <div className="text-slate-500 text-[11px] pt-0.5">{ev.reasons[0]}</div>
                      )}
                    </div>
                    <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {ev.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
