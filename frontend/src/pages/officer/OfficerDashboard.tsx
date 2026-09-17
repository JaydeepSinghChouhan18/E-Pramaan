import React from 'react';
import { Link } from 'react-router-dom';
import {
  FilePlus,
  ClipboardCheck,
  ArrowUpRight,
  BookOpenCheck,
  Files,
  ShieldAlert,
  Award,
  Bot,
  Bell,
  Sparkles
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { VerificationStatus, RiskLevel, UserRole } from '@e-pramaan/shared';
import { useAuth } from '../../contexts/AuthContext';

export const OfficerDashboard: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role || UserRole.OFFICER;
  const isAuditor = role === UserRole.AUDITOR;
  const isAdmin = role === UserRole.ADMIN;

  const dashboardTitle = isAuditor
    ? 'Auditor & Vigilance Console'
    : isAdmin
    ? 'System Administrator Command Console'
    : 'Procurement Officer Command Console';

  const dashboardSubtitle = isAuditor
    ? 'Independent Oversight, Compliance Audits & Integrity Investigations'
    : isAdmin
    ? 'National Procurement Infrastructure, System Audits & Health Monitoring'
    : 'Government Tenders, Bid Verification & Decision Lifecycle';

  // Officer lifecycle primary grid actions
  const officerLifecycleActions = [
    { label: 'Create Tender', path: '/officer/tenders/create', icon: FilePlus, desc: 'Draft new tender notice & rules' },
    { label: 'All Tenders', path: '/officer/tenders', icon: Files, desc: 'Manage registered procurement notices' },
    { label: 'Review Bids', path: '/officer/bids/review', icon: ClipboardCheck, desc: 'Inspect applications & run AI' },
    { label: 'Investigate Risk', path: '/officer/risk', icon: ShieldAlert, desc: 'Collusion & discrepancy cases' },
    { label: 'Awards', path: '/officer/awards', icon: Award, desc: 'Comparative evaluation & awards' },
    { label: 'Audit & Decisions', path: '/officer/audit', icon: BookOpenCheck, desc: 'Audit trails & decision dossier' },
    { label: 'AI Assistant', path: '/officer/ai-assistant', icon: Bot, desc: 'Grounded procurement co-pilot' },
    { label: 'Notifications', path: '/notifications', icon: Bell, desc: 'Alerts & statutory notices' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{dashboardTitle}</h1>
          <p className="text-xs text-slate-500">{dashboardSubtitle}</p>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-2">
          {!isAuditor && (
            <Link
              to="/officer/tenders/create"
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
            >
              <FilePlus className="w-4 h-4 mr-1.5" />
              Create Tender
            </Link>
          )}
          {!isAuditor ? (
            <Link
              to="/officer/bids/review"
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-sm"
            >
              <ClipboardCheck className="w-4 h-4 mr-1.5" />
              Review Submissions
            </Link>
          ) : (
            <Link
              to="/officer/audit"
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
            >
              <BookOpenCheck className="w-4 h-4 mr-1.5" />
              Audit Trail
            </Link>
          )}
        </div>
      </div>

      {/* Primary Lifecycle Action Grid */}
      {!isAuditor && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Good morning, Officer. What would you like to do?
            </h2>
            <span className="text-[10px] text-slate-400 font-medium">Core Procurement Lifecycle</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {officerLifecycleActions.map((action) => (
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
      )}

      {/* Continue Where You Left Off Spotlight Card */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-lg p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950">
              CONTINUE WHERE YOU LEFT OFF
            </span>
            <span className="text-[10px] font-mono text-slate-300">Tender #GEM-2026-T-9153</span>
          </div>
          <h3 className="text-sm font-bold text-white pt-1">
            Automated Fastag Weigh-in-Motion & Tollway Infrastructure
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl">
            3 bids submitted (Larsen Consortium, Apex Sensors, Vanguard Civil). 1 integrity case open. AI Compliance analysis ready for review and final award formulation.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <Link
            to="/officer/bids/review?tenderId=d20cb0d6-a7b8-4d42-94cc-766d4f1a010f"
            className="inline-flex items-center px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-bold shadow-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-200" />
            Review & AI Analysis
          </Link>
          <Link
            to="/officer/awards?tenderId=d20cb0d6-a7b8-4d42-94cc-766d4f1a010f"
            className="inline-flex items-center px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-md text-xs font-bold shadow-xs transition"
          >
            <Award className="w-3.5 h-3.5 mr-1.5" />
            Finalize Award
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Workflow</span>
              <span className="p-1 rounded bg-amber-50 text-amber-700 font-mono text-xs font-bold">Action Required</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">Bids Requiring Verification</h3>
            <p className="text-xs text-slate-600 mt-1">
              4 submissions under Tender #GEM-2026-B-9912 awaiting automated and committee compliance clearance.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <StatusBadge status={VerificationStatus.PENDING_VERIFICATION} />
            <Link to="/officer/bids/review" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              Inspect Bids <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Integrity Alert</span>
              <span className="p-1 rounded bg-rose-50 text-rose-700 font-mono text-xs font-bold">Investigation</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">Anomalous Bidding Pattern</h3>
            <p className="text-xs text-slate-600 mt-1">
              Shared GST/Director linkage detected between two participating entities in Municipal Supply Tender.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <StatusBadge status={RiskLevel.HIGH} />
            <Link to="/officer/risk" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              View Graph <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Compliance & Audit</span>
              <span className="p-1 rounded bg-emerald-50 text-emerald-700 font-mono text-xs font-bold">Ready</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mt-2">Final Award Justifications</h3>
            <p className="text-xs text-slate-600 mt-1">
              Automated audit trail prepared for tender #GEM-2026-A-8104. Ready for sign-off & evaluation report lock.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <StatusBadge status={VerificationStatus.VERIFIED} />
            <Link to="/officer/audit" className="text-xs font-bold text-gov-navy hover:underline flex items-center">
              Audit Logs <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
