import { Router } from 'express';
import { ComplianceController } from './compliance.controller.js';
import { requireAuthenticatedUser, requireAnyRole, requireRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

// Officer trigger: start formal verification run
router.post(
  '/bids/:bidId/run',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  ComplianceController.runVerification
);

// Officer full inspection of verification run
router.get(
  '/bids/:bidId/latest',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  ComplianceController.getLatestRun
);

// Bidder self-check / privacy-safe summary
router.get(
  '/bids/:bidId/bidder-summary',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  ComplianceController.getBidderSummary
);

export default router;
