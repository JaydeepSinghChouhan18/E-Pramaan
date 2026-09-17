import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  ArrowUpRight,
  FolderArchive,
  FileText,
  Award
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { VerificationStatus } from '@e-pramaan/shared';

export const BidderDashboard: React.FC = () => {
  const bidderLifecycleActions = [
    { label: 'All Tenders', path: '/bidder/tenders', icon: Search, desc: 'Search open procurement invitations' },
    { label: 'My Applications', path: '/bidder/applications', icon: FolderArchive, desc: 'Track submitted tender responses' },
    { label: 'My Documents', path: '/bidder/documents', icon: FileText, desc: 'DigiLocker and verified credential vault' },
    { label: 'Self Check', path: '/bidder/self-check', icon: CheckCircle2, desc: 'Pre-check eligibility against criteria' },
    { label: 'Allotted Bids', path: '/bidder/allotted-bids', icon: Award, desc: 'View awarded public procurement results' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bidder Self-Service Portal</h1>
          <p className="text-xs text-slate-500">Manage submissions, verify credentials & check tender eligibility</p>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-2">
          <Link
            to="/bidder/self-check"
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-amber-400" />
            Pre-Check Eligibility
          </Link>
          <Link
            to="/bidder/tenders"
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-sm"
          >
            <Search className="w-4 h-4 mr-1.5" />
            Find Tenders
          </Link>
        </div>
      </div>

      {/* Vendor Lifecycle & Compliance Action Grid */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Vendor Lifecycle & Compliance Workspace
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">Fast Actions</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          {bidderLifecycleActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="p-3 rounded-lg border border-slate-200 hover:border-gov-navy hover:shadow-xs hover:bg-slate-50 transition group flex flex-col justify-between"
            >
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="w-7 h-7 rounded bg-slate-100 group-hover:bg-gov-navy group-hover:text-white flex items-center justify-center text-slate-700 transition">
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-gov-navy transition">
                  {action.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-1">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Submission</span>
              <span className="p-1 rounded bg-amber-50 text-amber-700 font-mono text-xs font-bold">Under Review</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">National Highway Tollway Support</h3>
            <p className="text-xs text-slate-600 mt-1">
              Bid Ref: BID-2026-NHAI-041. All technical documentation submitted. Evaluation underway.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <StatusBadge status={VerificationStatus.PENDING_VERIFICATION} />
            <Link to="/bidder/applications" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              View Application <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Document Vault</span>
              <span className="p-1 rounded bg-emerald-50 text-emerald-700 font-mono text-xs font-bold">Verified</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">DigiLocker & MCA Linkage</h3>
            <p className="text-xs text-slate-600 mt-1">
              Company Incorporation, PAN, and 3-Year Audited Balance Sheets securely verified.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <StatusBadge status={VerificationStatus.VERIFIED} />
            <Link to="/bidder/documents" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              View Vault <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pre-Bid Assurance</span>
              <span className="p-1 rounded bg-blue-50 text-blue-700 font-mono text-xs font-bold">Simulation</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">Self-Check Eligibility</h3>
            <p className="text-xs text-slate-600 mt-1">
              Test your documents against active tender qualifications prior to formal submission.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Zero Risk Diagnostic</span>
            <Link to="/bidder/self-check" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              Run Check <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
