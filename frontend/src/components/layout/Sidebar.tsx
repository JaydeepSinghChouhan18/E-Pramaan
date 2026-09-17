import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  Files,
  ClipboardCheck,
  ShieldAlert,
  Award,
  BookOpenCheck,
  Bot,
  Search,
  FolderArchive,
  FileText,
  Building2,
  HelpCircle,
  Activity,
  Bell,
  LucideIcon
} from 'lucide-react';
import { UserRole } from '@e-pramaan/shared';
import { useRoleContext } from '../../contexts/RoleContext';
import { useAuth } from '../../contexts/AuthContext';

interface NavItem {
  labelKey: string;
  defaultLabel: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { activeRole, t } = useRoleContext();
  const { user } = useAuth();
  const effectiveRole = user?.role || activeRole;

  // 1. OFFICER Menu:
  // - Dashboard, Create Tender, All Tenders, Review Bids, Risk & Investigation, Audit & Decisions, Help
  const officerNav: NavItem[] = [
    { labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', path: '/officer/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.create_tender', defaultLabel: 'Create Tender', path: '/officer/tenders/create', icon: FilePlus },
    { labelKey: 'nav.all_tenders', defaultLabel: 'All Tenders', path: '/officer/tenders', icon: Files },
    { labelKey: 'nav.review_bids', defaultLabel: 'Review Bids', path: '/officer/bids/review', icon: ClipboardCheck },
    { labelKey: 'nav.risk_investigation', defaultLabel: 'Risk & Investigation', path: '/officer/risk', icon: ShieldAlert },
    { labelKey: 'nav.audit', defaultLabel: 'Audit & Decisions', path: '/officer/audit', icon: BookOpenCheck },
    { labelKey: 'nav.help', defaultLabel: 'Help', path: '/help', icon: HelpCircle },
  ];

  // 2. BIDDER Menu:
  // - Dashboard, Browse Tenders, My Applications, My Documents, Company Profile, Allotted Bids, Help
  const bidderNav: NavItem[] = [
    { labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', path: '/bidder/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.browse_tenders', defaultLabel: 'Browse Tenders', path: '/bidder/tenders', icon: Search },
    { labelKey: 'nav.my_applications', defaultLabel: 'My Applications', path: '/bidder/applications', icon: FolderArchive },
    { labelKey: 'nav.my_documents', defaultLabel: 'My Documents', path: '/bidder/documents', icon: FileText },
    { labelKey: 'nav.company_profile', defaultLabel: 'Company Profile', path: '/bidder/profile', icon: Building2 },
    { labelKey: 'Alloted Bids', defaultLabel: 'Alloted Bids', path: '/bidder/allotted-bids', icon: Award, badge: 'Awards' },
    { labelKey: 'nav.help', defaultLabel: 'Help', path: '/help', icon: HelpCircle },
  ];

  // 3. AUDITOR Menu:
  // - Dashboard, Risk & Investigation, Audit & Decisions, AI Assistant, Notifications, Help
  const auditorNav: NavItem[] = [
    { labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', path: '/officer/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.risk_investigation', defaultLabel: 'Risk & Investigation', path: '/officer/risk', icon: ShieldAlert },
    { labelKey: 'nav.audit', defaultLabel: 'Audit & Decisions', path: '/officer/audit', icon: BookOpenCheck },
    { labelKey: 'nav.ai_assistant', defaultLabel: 'AI Assistant', path: '/officer/ai-assistant', icon: Bot, badge: 'Advisor' },
    { labelKey: 'nav.notifications', defaultLabel: 'Notifications', path: '/notifications', icon: Bell },
    { labelKey: 'nav.help', defaultLabel: 'Help', path: '/help', icon: HelpCircle },
  ];

  // 4. ADMIN Menu:
  // - Dashboard, All Tenders, Review Bids, Risk & Investigation, Audit & Decisions, Integration Health, AI Assistant, Notifications, Help
  const adminNav: NavItem[] = [
    { labelKey: 'nav.dashboard', defaultLabel: 'Dashboard', path: '/officer/dashboard', icon: LayoutDashboard },
    { labelKey: 'nav.all_tenders', defaultLabel: 'All Tenders', path: '/officer/tenders', icon: Files },
    { labelKey: 'nav.review_bids', defaultLabel: 'Review Bids', path: '/officer/bids/review', icon: ClipboardCheck },
    { labelKey: 'nav.risk_investigation', defaultLabel: 'Risk & Investigation', path: '/officer/risk', icon: ShieldAlert },
    { labelKey: 'nav.audit', defaultLabel: 'Audit & Decisions', path: '/officer/audit', icon: BookOpenCheck },
    { labelKey: 'nav.integration_health', defaultLabel: 'Integration Health', path: '/officer/integrations', icon: Activity },
    { labelKey: 'nav.ai_assistant', defaultLabel: 'AI Assistant', path: '/officer/ai-assistant', icon: Bot, badge: 'Advisor' },
    { labelKey: 'nav.notifications', defaultLabel: 'Notifications', path: '/notifications', icon: Bell },
    { labelKey: 'nav.help', defaultLabel: 'Help', path: '/help', icon: HelpCircle },
  ];

  let currentNav = bidderNav;
  let roleLabel = 'Registered Bidder';

  if (effectiveRole === UserRole.OFFICER) {
    currentNav = officerNav;
    roleLabel = 'Procurement Officer';
  } else if (effectiveRole === UserRole.AUDITOR) {
    currentNav = auditorNav;
    roleLabel = 'Auditor / Vigilance';
  } else if (effectiveRole === UserRole.ADMIN) {
    currentNav = adminNav;
    roleLabel = 'System Administrator';
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current Workspace</div>
        <div className="text-xs font-bold text-gov-navy mt-0.5">{roleLabel}</div>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {currentNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/officer/tenders' || item.path.endsWith('/dashboard') || item.path === '/officer/tenders/create'}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-gov-navy text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <div className="flex items-center space-x-2.5">
              <item.icon className="w-4 h-4" />
              <span>{t(item.labelKey) || item.defaultLabel}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase tracking-wider">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 m-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-500">
        <div className="font-semibold text-slate-700 mb-1 flex items-center space-x-1">
          <span>Security Protocol</span>
        </div>
        <div>All transactions are logged with tamper-evident audit identifiers.</div>
      </div>
    </aside>
  );
};
