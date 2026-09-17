import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole } from '@e-pramaan/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AccessRestrictedPage } from '../../pages/AccessRestrictedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-gov-navy/20 border-t-gov-navy rounded-full animate-spin" />
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Verifying Identity & Security Credentials...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessRestrictedPage />;
  }

  return <>{children}</>;
};
