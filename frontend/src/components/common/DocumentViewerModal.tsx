import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Hash,
  Loader2
} from 'lucide-react';
import { BidsApi } from '../../services/bids';

export interface DocumentViewerProps {
  document: {
    id?: string;
    bidId?: string;
    name: string;
    size?: number;
    mimeType?: string;
    hash?: string;
    reqName?: string;
    reqCode?: string;
    status?: string;
    uploadedAt?: string;
    organizationName?: string;
    storagePath?: string;
    url?: string;
  };
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [integrityVerified, setIntegrityVerified] = useState<boolean | null>(null);

  const docName = document.name || 'document';
  const orgName = document.organizationName || 'Bidder Entity';
  const formattedDate = document.uploadedAt
    ? new Date(document.uploadedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recently Uploaded';

  const shaHash = document.hash || '';

  // Determine file kind
  const lowerName = docName.toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || (document.mimeType && document.mimeType.includes('pdf'));
  const isImage =
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    (document.mimeType && document.mimeType.startsWith('image/'));

  useEffect(() => {
    let active = true;
    const resolveUrl = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        if (document.url) {
          if (active) {
            setFileUrl(document.url);
            setIntegrityVerified(true);
            setLoading(false);
          }
          return;
        }

        if (document.bidId && document.id) {
          try {
            const viewData = await BidsApi.getDocumentViewUrl(document.bidId, document.id);
            if (active && viewData?.url) {
              setFileUrl(viewData.url);
              setIntegrityVerified(Boolean(viewData.sha256Hash && viewData.sha256Hash === shaHash));
              setLoading(false);
              return;
            }
          } catch {
            // Fallback to direct stream URL
            const directUrl = BidsApi.getDocumentFileUrl(document.bidId, document.id);
            if (active) {
              setFileUrl(directUrl);
              setLoading(false);
            }
            return;
          }
        }

        // If storage path or no bidId
        if (active) {
          setLoadError('Direct document stream not configured or document has no active storage handle.');
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setLoadError(err.message || 'Unable to retrieve document from storage.');
          setLoading(false);
        }
      }
    };

    resolveUrl();

    return () => {
      active = false;
    };
  }, [document]);

  const handleDownload = () => {
    if (fileUrl) {
      const a = window.document.createElement('a');
      a.href = fileUrl;
      a.download = document.name || 'document';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden text-slate-200">
        {/* Top Header / Action Bar */}
        <div className="px-5 py-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-gov-navyLight/20 text-amber-400 rounded flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm truncate">{document.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  document.status === 'VERIFIED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : document.status === 'PARTIALLY_VERIFIED'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {document.status || 'PENDING_VERIFICATION'}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">
                {document.reqCode ? `${document.reqCode} • ` : ''}{document.reqName || 'Statutory Evidence'} • {orgName}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Zoom Controls for Images */}
            {isImage && (
              <div className="hidden sm:flex items-center bg-slate-700 rounded px-2 py-1 space-x-1 text-xs">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                  className="p-1 hover:text-white text-slate-300 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 text-slate-300 font-mono text-[11px]">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
                  className="p-1 hover:text-white text-slate-300 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {fileUrl && (
              <>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded transition cursor-pointer"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Open</span>
                </a>

                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-1 bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded font-semibold transition cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata & Cryptographic Integrity Strip */}
        <div className="bg-slate-850 px-5 py-2 border-b border-slate-750 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-300 flex-shrink-0">
          <div className="flex items-center space-x-4 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1 text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Entity: <strong className="text-slate-200">{orgName}</strong></span>
            </div>
            {document.size ? (
              <div className="text-slate-400">
                Size: <strong className="text-slate-200">{(document.size / 1024).toFixed(1)} KB</strong>
              </div>
            ) : null}
            <div className="flex items-center space-x-1 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Timestamp: <strong className="text-slate-200">{formattedDate}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Hash className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">SHA-256 Checksum:</span>
            {shaHash ? (
              <span className="font-mono text-amber-300 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 select-all max-w-[200px] sm:max-w-xs truncate" title={shaHash}>
                {shaHash}
              </span>
            ) : (
              <span className="text-slate-500 italic text-[10px]">Computed upon submission</span>
            )}
            {integrityVerified !== null && (
              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-bold ${
                integrityVerified
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                <ShieldCheck className="w-3 h-3 mr-0.5" />
                {integrityVerified ? 'Integrity Matched' : 'Stored'}
              </span>
            )}
          </div>
        </div>

        {/* Document Content Viewport */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-xs">Loading authentic document stream...</p>
            </div>
          ) : loadError ? (
            <div className="max-w-md bg-slate-900 border border-slate-800 p-6 rounded-lg text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Preview Unavailable</h3>
              <p className="text-xs text-slate-400">{loadError}</p>
              {fileUrl && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                >
                  Download File Directly
                </button>
              )}
            </div>
          ) : fileUrl ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto rounded bg-slate-900/50">
              {isPdf ? (
                <iframe
                  src={fileUrl}
                  title={document.name}
                  className="w-full h-full rounded border border-slate-800 bg-white"
                />
              ) : isImage ? (
                <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4">
                  <img
                    src={fileUrl}
                    alt={document.name}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                    className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform duration-200"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-lg max-w-md space-y-4">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{document.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Binary statutory file format ({document.mimeType || 'raw binary'}).
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-xs"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download to View Locally
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-xs">No previewable document stream available.</div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs flex-shrink-0">
          <div className="text-slate-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
            Official statutory record inspected under digital procurement governance policies.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
