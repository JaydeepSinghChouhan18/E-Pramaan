import { Router } from 'express';
import { AwardsController } from './awards.controller.js';
import { requireAuthenticatedUser, requireAnyRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

router.get(
  ['/tenders/:tenderId/comparison', '/tender/:tenderId/comparative'],
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  AwardsController.getTenderBidComparison
);

router.post(
  ['/tenders/:tenderId/ai-compliance-analysis', '/tender/:tenderId/ai-compliance-analysis'],
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  AwardsController.generateAiComplianceAnalysis
);

router.get(
  ['/tenders/:tenderId/decision', '/tender/:tenderId/decision'],
  requireAuthenticatedUser,
  AwardsController.getDecisionByTenderId
);

router.get(
  ['/tenders/:tenderId/transparency', '/tender/:tenderId/transparency'],
  requireAuthenticatedUser,
  AwardsController.getBidderTransparency
);

router.post(
  ['/', '/tender/:tenderId/decision'],
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  AwardsController.recordAwardDecision
);

router.post(
  ['/tenders/:tenderId/revoke', '/tenders/:tenderId/reopen'],
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  AwardsController.revokeAwardDecision
);

router.get(
  '/decisions/:decisionId/reconstruction',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  AwardsController.getDecisionReconstruction
);

export default router;
