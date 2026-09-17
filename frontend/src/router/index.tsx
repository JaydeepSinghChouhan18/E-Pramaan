import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useRoleContext } from '../contexts/RoleContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '@e-pramaan/shared';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';

// Officer Pages
import { OfficerDashboard } from '../pages/officer/OfficerDashboard';
import { CreateTenderPage } from '../pages/officer/CreateTenderPage';
import { AllTendersPage } from '../pages/officer/AllTendersPage';
import { TenderDetailPage } from '../pages/officer/TenderDetailPage';
import { ReviewBidsPage } from '../pages/officer/ReviewBidsPage';
import { RiskInvestigationPage } from '../pages/officer/RiskInvestigationPage';
import { AwardsPage } from '../pages/officer/AwardsPage';
import { AuditDecisionsPage } from '../pages/officer/AuditDecisionsPage';
import { AIAssistantPage } from '../pages/officer/AIAssistantPage';
import { IntegrationHealthPage } from '../pages/officer/IntegrationHealthPage';
import { HelpPage } from '../pages/help/HelpPage';

// Bidder Pages
import { BidderDashboard } from '../pages/bidder/BidderDashboard';
import { BrowseTendersPage } from '../pages/bidder/BrowseTendersPage';
import { BidderTenderDetailPage } from '../pages/bidder/BidderTenderDetailPage';
import { MyApplicationsPage } from '../pages/bidder/MyApplicationsPage';
import { MyDocumentsPage } from '../pages/bidder/MyDocumentsPage';
import { CompanyProfilePage } from '../pages/bidder/CompanyProfilePage';
import { SelfCheckPage } from '../pages/bidder/SelfCheckPage';
import { BidApplicationPage } from '../pages/bidder/BidApplicationPage';
import { AllottedBidsPage } from '../pages/bidder/AllottedBidsPage';

// Notifications Page
import { NotificationsPage } from '../pages/notifications/NotificationsPage';

const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  const { activeRole } = useRoleContext();

  const effectiveRole = user?.role || activeRole;
  return <Navigate to={effectiveRole === UserRole.BIDDER ? '/bidder/dashboard' : '/officer/dashboard'} replace />;
};

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Application Shell */}
      <Route path="/" element={<AppLayout />}>
        <Route index element={<RootRedirect />} />

        {/* Officer / Auditor / Admin Routes */}
        <Route
          path="officer"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/dashboard"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/tenders/create"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN]}>
              <CreateTenderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/tenders"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN]}>
              <AllTendersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/tenders/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <TenderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/bids/review"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN]}>
              <ReviewBidsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/risk"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <RiskInvestigationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/awards"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN]}>
              <AwardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/audit"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <AuditDecisionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/ai-assistant"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]}>
              <AIAssistantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="officer/integrations"
          element={
            <ProtectedRoute allowedRoles={[UserRole.OFFICER, UserRole.ADMIN]}>
              <IntegrationHealthPage />
            </ProtectedRoute>
          }
        />

        {/* Bidder Routes */}
        <Route
          path="bidder"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BidderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/dashboard"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BidderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/tenders"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BrowseTendersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/tenders/:id"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BidderTenderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/tenders/:tenderId/apply"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BidApplicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/applications"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/applications/:bidId"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <BidApplicationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="bidder/documents"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <MyDocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/profile"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <CompanyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/allotted-bids"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <AllottedBidsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/self-check"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <SelfCheckPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bidder/ai-assistant"
          element={
            <ProtectedRoute allowedRoles={[UserRole.BIDDER, UserRole.ADMIN]}>
              <AIAssistantPage forcedRole={UserRole.BIDDER} />
            </ProtectedRoute>
          }
        />

        {/* Common Authenticated Routes */}
        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="help" element={<HelpPage />} />

        {/* Fallback */}
        <Route path="*" element={<RootRedirect />} />
      </Route>
    </Routes>
  );
};
