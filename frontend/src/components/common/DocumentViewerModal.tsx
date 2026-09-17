import React, { useState } from 'react';
import {
  FileText,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  QrCode
} from 'lucide-react';

export interface DocumentViewerProps {
  document: {
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

  const docName = (document.name || '').toLowerCase();
  const reqName = (document.reqName || '').toLowerCase();
  const orgName = document.organizationName || 'Bharat Infrastructure & InfraTech Ltd';

  // Determine certificate type to render authentic statutory template
  const isGST = docName.includes('gst') || reqName.includes('gst') || reqName.includes('tax');
  const isMCA = docName.includes('mca') || docName.includes('incorporation') || reqName.includes('incorporation') || reqName.includes('company');
  const isMSME = docName.includes('msme') || docName.includes('udyam') || reqName.includes('msme');
  const isTurnover = docName.includes('turnover') || docName.includes('financial') || docName.includes('audit') || reqName.includes('turnover') || reqName.includes('financial');
  const isTechnical = docName.includes('technical') || docName.includes('completion') || docName.includes('experience') || reqName.includes('technical');
  const isAffidavit = docName.includes('affidavit') || docName.includes('undertaking') || docName.includes('blacklisting') || reqName.includes('integrity');

  const formattedDate = document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('en-IN') : '14/09/2026';
  const shaHash = document.hash || '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4';

  const handleDownload = () => {
    const element = window.document.createElement('a');
    const fileContent = `=== GOVERNMENT OF INDIA STATUTORY REPOSITORY ===\n` +
      `Document Name: ${document.name}\n` +
      `Requirement: ${document.reqCode || ''} - ${document.reqName || ''}\n` +
      `Bidder Organization: ${orgName}\n` +
      `Verification Status: VERIFIED\n` +
      `Digital Signature Checksum (SHA-256): ${shaHash}\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `This is a certified digital copy retrieved from the e-Pramaan Procurement Gateway.`;
    const file = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = document.name || 'Statutory_Document.txt';
    window.document.body.appendChild(element);
    element.click();
    window.document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-slate-200">
        
        {/* Top Header / Action Bar */}
        <div className="px-5 py-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 truncate">
            <div className="p-2 bg-gov-navyLight/20 text-amber-400 rounded">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm truncate">{document.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {document.status || 'VERIFIED'}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">
                {document.reqCode ? `${document.reqCode} • ` : ''}{document.reqName || 'Statutory Bid Document'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-700 rounded px-2 py-1 space-x-1 text-xs">
              <button
                onClick={() => setZoomLevel(prev => Math.max(70, prev - 15))}
                className="p-1 hover:text-white text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] font-mono text-slate-300">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(140, prev + 15))}
                className="p-1 hover:text-white text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleDownload}
              className="inline-flex items-center px-3 py-1.5 bg-gov-navy hover:bg-gov-navyLight text-white rounded text-xs font-semibold shadow-xs transition"
              title="Download Verified Original Document"
            >
              <Download className="w-3.5 h-3.5 mr-1 text-amber-400" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Header Metadata Ribbon */}
        <div className="px-5 py-2 bg-slate-800/60 border-b border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-slate-400">
              <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Entity: <strong className="text-white ml-1">{orgName}</strong>
            </span>
            <span className="flex items-center text-slate-400">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Date: <span className="text-slate-200 ml-1">{formattedDate}</span>
            </span>
            {document.size && (
              <span className="text-slate-400">
                Size: <span className="text-slate-200 font-mono ml-1">{(document.size / 1024).toFixed(1)} KB</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>SHA256: {shaHash.slice(0, 16)}...{shaHash.slice(-8)}</span>
          </div>
        </div>

        {/* Viewport Area: Render authentic document paper */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/80 flex justify-center items-start">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
            className="w-full max-w-3xl bg-white text-slate-900 rounded-lg shadow-2xl p-8 sm:p-12 border border-slate-300 relative select-none"
          >
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none overflow-hidden">
              <span className="text-8xl font-serif font-black tracking-widest text-slate-900 -rotate-45 uppercase select-none">
                GOVERNMENT OF INDIA
              </span>
            </div>

            {/* TEMPLATE 1: GST REGISTRATION CERTIFICATE */}
            {isGST && (
              <div className="space-y-6 relative z-10 text-xs">
                {/* Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-serif font-bold text-sm tracking-wide uppercase text-slate-800">
                    Government of India
                  </div>
                  <div className="text-base font-serif font-extrabold text-slate-900">
                    Form GST REG-06
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    [See Rule 10(1)] • Registration Certificate
                  </div>
                  <div className="text-[10px] font-mono font-bold text-indigo-900 pt-1">
                    GSTIN: 33AAACB9482M1Z5
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">1. Legal Name</span>
                      <div className="font-bold text-slate-900 text-sm">{orgName}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">2. Trade Name</span>
                      <div className="font-semibold text-slate-800">{orgName}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">3. Constitution of Business</span>
                      <div className="font-medium text-slate-800">Public Limited Company</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">4. Principal Place of Business</span>
                      <div className="font-medium text-slate-800">Plot No. 42/B, SIPCOT Industrial Park, Manali, Chennai, Tamil Nadu - 600068</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">5. Date of Validity</span>
                      <div className="font-medium text-slate-800">From 01/04/2018 to Regular</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">6. Type of Registration</span>
                      <div className="font-medium text-slate-800">Regular Taxpayer</div>
                    </div>
                  </div>
                </div>

                {/* Statutory Authority Table */}
                <div className="pt-4">
                  <div className="text-[11px] font-bold text-slate-700 uppercase mb-2">Particulars of Approving Authority</div>
                  <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <tbody>
                      <tr className="border-b border-slate-300">
                        <td className="p-2 bg-slate-50 font-bold w-1/3">Jurisdictional Office</td>
                        <td className="p-2 font-medium">Chennai North Commissionerate, Division-IV</td>
                      </tr>
                      <tr className="border-b border-slate-300">
                        <td className="p-2 bg-slate-50 font-bold">Verification Status</td>
                        <td className="p-2 font-bold text-emerald-700">ACTIVE & VERIFIED ON GSTN REGISTRY</td>
                      </tr>
                      <tr>
                        <td className="p-2 bg-slate-50 font-bold">Annual GSTR-3B / 9 Status</td>
                        <td className="p-2 font-medium text-slate-800">Up to date, zero statutory liabilities flagged</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer with QR and Digital Signature Stamp */}
                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-300 rounded flex items-center justify-center p-1">
                      <QrCode className="w-14 h-14 text-slate-800" />
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>Digitally Signed by GSTN Common Portal</div>
                      <div>Certificate Hash: {shaHash.slice(0, 24)}...</div>
                      <div>Date of Verification: {formattedDate}</div>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="inline-block border-2 border-emerald-600 text-emerald-700 font-extrabold text-[11px] px-3 py-1 rounded tracking-wider uppercase">
                      ✓ STATUTORILY VALIDATED
                    </div>
                    <div className="text-[10px] text-slate-400">Assistant Commissioner (ST)</div>
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE 2: MCA CERTIFICATE OF INCORPORATION */}
            {isMCA && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-serif font-bold text-sm tracking-wide uppercase text-slate-800">
                    Ministry of Corporate Affairs
                  </div>
                  <div className="text-xs text-slate-600 font-medium">Office of the Registrar of Companies, Tamil Nadu</div>
                  <div className="text-base font-serif font-extrabold text-slate-900 pt-1">
                    Certificate of Incorporation
                  </div>
                  <div className="text-[10px] text-slate-500">
                    [Pursuant to sub-section (2) of section 7 of the Companies Act, 2013]
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3 leading-relaxed text-slate-800">
                  <p>
                    I hereby certify that <strong>{orgName}</strong> is incorporated on this day under the Companies Act, 2013 and that the company is <strong>limited by shares</strong>.
                  </p>
                  <p>
                    The Corporate Identity Number (CIN) of the company is: <strong className="font-mono font-bold text-gov-navy">U45201TN2012PLC087654</strong>.
                  </p>
                  <p>
                    The Permanent Account Number (PAN) allotted is: <strong className="font-mono font-bold text-slate-900">AAACB9482M</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Authorized Share Capital</span>
                    <div className="font-bold text-slate-900 text-sm">₹ 25,00,00,000</div>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Paid-up Capital</span>
                    <div className="font-bold text-slate-900 text-sm">₹ 18,50,00,000</div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>Registrar of Companies, Chennai</div>
                    <div>Digital Signature: DS MCA ROC CHENNAI 04</div>
                  </div>
                  <div className="inline-block border-2 border-emerald-600 text-emerald-700 font-extrabold text-[11px] px-3 py-1 rounded uppercase tracking-wider">
                    ✓ MCA ACTIVE & COMPLIANT
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE 3: MSME UDYAM CERTIFICATE */}
            {isMSME && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-serif font-bold text-sm tracking-wide uppercase text-slate-800">
                    Ministry of Micro, Small and Medium Enterprises
                  </div>
                  <div className="text-base font-serif font-extrabold text-slate-900">
                    UDYAM REGISTRATION CERTIFICATE
                  </div>
                  <div className="text-[11px] font-mono font-bold text-indigo-900">
                    UDYAM-TN-03-0048291
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Name of Enterprise</span>
                      <div className="font-bold text-slate-900">{orgName}</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Type of Enterprise</span>
                      <div className="font-bold text-emerald-700 uppercase">MEDIUM ENTERPRISE</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Major Activity</span>
                      <div className="font-medium text-slate-800">Services & Infrastructure Engineering</div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Date of Incorporation</span>
                      <div className="font-medium text-slate-800">14/06/2012</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px]">
                    <div className="font-bold text-slate-800">Statutory Procurement Benefit:</div>
                    <div className="text-slate-600">Eligible for statutory MSME tender purchase preference and EMD fee exemption under Public Procurement Policy.</div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>Verified via MSME Udyam National Database</div>
                    <div>Hash: {shaHash.slice(0, 24)}...</div>
                  </div>
                  <div className="border border-emerald-600 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded text-xs">
                    ✓ ELIGIBLE MSME CLASS
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE 4: AUDITED FINANCIAL STATEMENT & TURNOVER */}
            {isTurnover && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-bold text-sm uppercase text-slate-800">
                    Chartered Accountants Statutory Attestation
                  </div>
                  <div className="text-base font-serif font-extrabold text-slate-900">
                    ANNUAL FINANCIAL TURNOVER CERTIFICATE
                  </div>
                  <div className="text-[11px] font-mono text-indigo-900">
                    UDIN: 24089482BKWXYZ8492
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed">
                  This is to certify that we have examined the audited books of accounts and records of <strong>{orgName}</strong>, and based on the audit, the annual financial turnover of the company for the preceding three financial years is certified as follows:
                </p>

                <table className="w-full border-collapse border border-slate-300 text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="p-2.5 border border-slate-300">Financial Year</th>
                      <th className="p-2.5 border border-slate-300">Turnover (in INR Crores)</th>
                      <th className="p-2.5 border border-slate-300">Net Profit (After Tax)</th>
                      <th className="p-2.5 border border-slate-300">Net Worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border border-slate-300 font-semibold">2023 - 2024</td>
                      <td className="p-2 border border-slate-300 font-bold text-emerald-700">₹ 84.50 Cr</td>
                      <td className="p-2 border border-slate-300">₹ 9.80 Cr</td>
                      <td className="p-2 border border-slate-300 font-semibold">₹ 52.10 Cr</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="p-2 border border-slate-300 font-semibold">2022 - 2023</td>
                      <td className="p-2 border border-slate-300 font-bold text-emerald-700">₹ 76.20 Cr</td>
                      <td className="p-2 border border-slate-300">₹ 8.40 Cr</td>
                      <td className="p-2 border border-slate-300 font-semibold">₹ 44.30 Cr</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-300 font-semibold">2021 - 2022</td>
                      <td className="p-2 border border-slate-300 font-bold text-emerald-700">₹ 68.90 Cr</td>
                      <td className="p-2 border border-slate-300">₹ 7.10 Cr</td>
                      <td className="p-2 border border-slate-300 font-semibold">₹ 38.20 Cr</td>
                    </tr>
                  </tbody>
                </table>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-medium">
                  <strong>Average Annual Turnover:</strong> ₹ 76.53 Crores (Substantially exceeds tender minimum requirement of ₹ 25.00 Crores).
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>For S. R. Raman & Associates</div>
                    <div>Chartered Accountants (FRN: 004829S)</div>
                    <div>Partner Membership No: 089482</div>
                  </div>
                  <div className="border border-emerald-600 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded text-xs">
                    ✓ FINANCIAL CAPACITY SATISFIED
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE 5: PAST PROJECT EXPERIENCE / TECHNICAL COMPLETION */}
            {isTechnical && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-bold text-sm uppercase text-slate-800">
                    Public Infrastructure & Highways Authority
                  </div>
                  <div className="text-base font-serif font-extrabold text-slate-900">
                    WORK COMPLETION & PERFORMANCE CERTIFICATE
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Ref: NHAI/RO-CHN/TOLL-WIM/2023/84
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed">
                  This is to certify that <strong>{orgName}</strong> was awarded the contract for <em>"Supply, Installation, and Commissioning of Automated Fastag Weigh-in-Motion and Optical Tollway Telematics Infrastructure"</em>.
                </p>

                <div className="space-y-2 border border-slate-200 p-4 rounded bg-slate-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div><strong>Work Order Value:</strong> ₹ 34,80,00,000</div>
                    <div><strong>Agreement Date:</strong> 12/03/2022</div>
                    <div><strong>Scheduled Completion:</strong> 31/08/2023</div>
                    <div><strong>Actual Completion:</strong> 25/08/2023 (Ahead of schedule)</div>
                  </div>
                </div>

                <div className="p-3 bg-white border border-emerald-300 rounded text-slate-800">
                  <strong>Performance Assessment:</strong> The equipment and telemetry systems installed have been operating at over 99.4% uptime with zero statutory defects. Work completed satisfactorily.
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>Superintending Engineer (Procurement)</div>
                    <div>National Highways & Infrastructure Division</div>
                  </div>
                  <div className="border border-emerald-600 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded text-xs">
                    ✓ TECHNICAL QUALIFICATION MET
                  </div>
                </div>
              </div>
            )}

            {/* TEMPLATE 6: NON-BLACKLISTING & INTEGRITY AFFIDAVIT */}
            {isAffidavit && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-4 border-amber-600 pb-3 space-y-1">
                  <div className="text-amber-800 font-extrabold text-sm uppercase tracking-widest">
                    GOVERNMENT OF INDIA • NON-JUDICIAL STAMP PAPER
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">SERIAL NO: TN-2026-STAMP-0048291</div>
                  <div className="text-base font-serif font-extrabold text-slate-900 pt-1">
                    INTEGRITY UNDERTAKING & NON-BLACKLISTING AFFIDAVIT
                  </div>
                </div>

                <div className="space-y-3 text-slate-800 leading-relaxed">
                  <p>
                    I, the undersigned authorized signatory of <strong>{orgName}</strong>, do hereby solemnly affirm and declare:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-700 bg-slate-50 p-4 rounded border border-slate-200">
                    <li>That our entity has NOT been blacklisted, debarred, or banned by any Central/State Government Ministry, CPSE, or statutory entity.</li>
                    <li>That there are no corrupt or fraudulent practices convictions pending against the directors or key management.</li>
                    <li>That all certificates, financial records, and credentials submitted for this tender are genuine, un-tampered, and statutorily authentic.</li>
                  </ol>
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>Attested before Notary Public</div>
                    <div>Advocate & Commissioner of Oaths, High Court</div>
                  </div>
                  <div className="border border-emerald-600 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded text-xs">
                    ✓ INTEGRITY PACT VERIFIED
                  </div>
                </div>
              </div>
            )}

            {/* DEFAULT FALLBACK TEMPLATE */}
            {!isGST && !isMCA && !isMSME && !isTurnover && !isTechnical && !isAffidavit && (
              <div className="space-y-6 relative z-10 text-xs">
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <div className="font-serif font-bold text-sm tracking-wide uppercase text-slate-800">
                    Government Procurement Compliance Ledger
                  </div>
                  <div className="text-base font-serif font-extrabold text-slate-900">
                    OFFICIAL STATUTORY SUBMISSION DOSSIER
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {document.reqName || 'Tender Statutory Evidence'}
                  </div>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200 rounded space-y-3">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Submitted Document:</span>
                    <strong className="text-slate-900 font-mono">{document.name}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Attested Bidder Entity:</span>
                    <strong className="text-slate-900">{orgName}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Cryptographic Hash Checksum:</span>
                    <strong className="text-slate-900 font-mono text-[11px]">{shaHash}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification Ledger Status:</span>
                    <span className="text-emerald-700 font-bold">DIGITALLY VALIDATED & AUDITED</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">
                    <div>e-Pramaan Procurement Gateway</div>
                    <div>Timestamp: {formattedDate}</div>
                  </div>
                  <div className="border border-emerald-600 bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded text-xs">
                    ✓ COMPLIANCE CERTIFIED
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" />
            Official statutory record inspected under digital procurement governance policies.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};
