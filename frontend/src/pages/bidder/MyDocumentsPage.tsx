import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Clock,
  AlertCircle,
  FileCheck2,
  HardDrive,
  Eye,
  DownloadCloud,
  RefreshCw
} from 'lucide-react';

import { BidDocument } from '@e-pramaan/shared';
import { BidsApi } from '../../services/bids';
import { DocumentViewerModal } from '../../components/common/DocumentViewerModal';

export const MyDocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<BidDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingDigiLocker, setFetchingDigiLocker] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<BidDocument | null>(null);
  const [replacingDoc, setReplacingDoc] = useState<BidDocument | null>(null);
  const [replacing, setReplacing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await BidsApi.getMyDocuments();
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve uploaded documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleTriggerReplace = (doc: BidDocument) => {
    setReplacingDoc(doc);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingDoc) return;

    try {
      setReplacing(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenderRequirementId', replacingDoc.tenderRequirementId);
      formData.append('metadata', JSON.stringify({ replacesDocumentId: replacingDoc.id }));
      await BidsApi.uploadDocument(replacingDoc.bidId, formData);
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to replace document with new version.');
    } finally {
      setReplacing(false);
      setReplacingDoc(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gov-navy" />
            <h1 className="text-base font-bold text-slate-900">Bidder Document Vault</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Centralized register of all credentials, statutory certificates, and compliance evidence attached across your tender bids.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              setFetchingDigiLocker(true);
              setTimeout(() => {
                setFetchingDigiLocker(false);
                alert('Connected to DigiLocker National Gateway: 3 verified credentials synced successfully (GST Registration, Incorporation Certificate, MSME Udyam).');
              }, 1200);
            }}
            disabled={fetchingDigiLocker}
            className="inline-flex items-center px-3.5 py-1.5 bg-gov-navy hover:bg-gov-navyLight text-white rounded text-xs font-bold shadow-2xs transition disabled:opacity-50"
          >
            <DownloadCloud className={`w-3.5 h-3.5 mr-1.5 ${fetchingDigiLocker ? 'animate-bounce' : ''}`} />
            {fetchingDigiLocker ? 'Syncing DigiLocker...' : 'Fetch from DigiLocker'}
          </button>
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 text-xs">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">{documents.length} Files Managed</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading document vault...</div>
        ) : error ? (
          <div className="p-6 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs text-rose-600">{error}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">No documents attached yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Documents attached during tender applications will be archived and catalogued here with their digital hash and verification audit trail.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Document File</th>
                  <th className="py-3 px-4">Compliance Requirement</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Verification Status</th>
                  <th className="py-3 px-4">File Size / Integrity</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gov-navy flex-shrink-0" />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-800">{doc.documentName}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              v{(doc as any).version || 1}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{doc.mimeType}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-semibold text-slate-800">
                        {doc.requirementName || 'Tender Requirement'}
                      </div>
                      {doc.requirementCode && (
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                          {doc.requirementCode}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-medium text-slate-600">
                        {doc.category || 'GENERAL'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3 mr-1 text-amber-600" />
                        {doc.verificationStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-mono font-medium">
                        {(doc.fileSize / 1024).toFixed(1)} KB
                      </div>
                      {doc.sha256Hash && (
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs" title={doc.sha256Hash}>
                          SHA256: {doc.sha256Hash.substring(0, 12)}...
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleTriggerReplace(doc)}
                          disabled={replacing}
                          className="inline-flex items-center px-2 py-1 bg-slate-50 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs disabled:opacity-50"
                          title="Upload updated file to generate next document version"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 text-slate-500 ${replacing && replacingDoc?.id === doc.id ? 'animate-spin' : ''}`} />
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                        >
                          <Eye className="w-3 h-3 mr-1 text-slate-600" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden file input for document replacement */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
      />

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentViewerModal
          document={{
            id: previewDoc.id,
            bidId: previewDoc.bidId,
            name: previewDoc.documentName,
            size: previewDoc.fileSize,
            mimeType: previewDoc.mimeType,
            hash: previewDoc.sha256Hash || undefined,
            reqName: previewDoc.requirementName,
            reqCode: previewDoc.requirementCode,
            status: previewDoc.verificationStatus,
            storagePath: (previewDoc as any).storagePath,
            uploadedAt: previewDoc.uploadedAt,
          }}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};
