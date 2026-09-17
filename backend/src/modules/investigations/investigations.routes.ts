import { Router } from 'express';
import { InvestigationsController } from './investigations.controller.js';
import { requireAuthenticatedUser, requireAnyRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

router.post(
  '/',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  InvestigationsController.createInvestigation
);

router.get(
  '/',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  InvestigationsController.listInvestigations
);

router.get(
  '/:id',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  InvestigationsController.getInvestigationById
);

router.post(
  '/:id/notes',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  InvestigationsController.addNote
);

router.post(
  '/:id/status',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  InvestigationsController.updateStatus
);

export default router;
