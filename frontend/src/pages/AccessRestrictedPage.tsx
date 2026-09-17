import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { UserRole } from '@e-pramaan/shared';
import { useAuth } from '../contexts/AuthContext';

export const AccessRestrictedPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || UserRole.BIDDER;
  const dashboardUrl = (userRole === UserRole.BIDDER) ? '/bidder/dashboard' : '/officer/dashboard';

  return (
    <div className="min-h-[65vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm max-w-lg w-full text-center">
        <div className="inline-flex p-3 bg-rose-50 text-rose-600 rounded-full mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h1>
        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          You do not have permission to view or perform actions in this section.
          Access to this area is governed by national procurement security policies and role-based permissions.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={dashboardUrl}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm transition"
          >
            <LayoutDashboard className="w-4 h-4 mr-1.5" />
            Back to My Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-sm transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};
