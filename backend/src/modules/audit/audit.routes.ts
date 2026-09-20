import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuthenticatedUser, requireAnyRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

router.get(
  '/events',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  AuditController.listEvents
);

router.post(
  '/ai-overrides',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  AuditController.recordAIOverride
);

router.get(
  '/ai-overrides',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  AuditController.listAIOverrides
);

router.get(
  '/export',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  AuditController.exportAuditPackage
);

export default router;
