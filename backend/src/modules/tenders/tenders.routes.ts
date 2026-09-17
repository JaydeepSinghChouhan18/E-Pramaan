import { Router } from 'express';
import { TendersController } from './tenders.controller.js';
import { requireAuthenticatedUser, requireRole, requireAnyRole } from '../../middlewares/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  createTenderSchema,
  updateTenderSchema,
  createRequirementSchema,
  updateRequirementSchema,
  listTendersQuerySchema,
  lifecycleActionSchema
} from './tenders.validation.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

// All tender routes require authenticated user
router.use(requireAuthenticatedUser);

// List tenders (accessible to all authenticated roles with role-based visibility)
router.get(
  '/',
  validateRequest({ query: listTendersQuerySchema }),
  TendersController.listTenders
);

// Get tender details (accessible to all authenticated roles with role-based draft protection)
router.get('/:id', TendersController.getTenderById);

// Officer & Admin only tender creation
router.post(
  '/',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  validateRequest({ body: createTenderSchema }),
  TendersController.createTender
);

// Officer & Admin tender update (DRAFT only)
router.patch(
  '/:id',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  validateRequest({ body: updateTenderSchema }),
  TendersController.updateTender
);

// Officer & Admin add requirement (DRAFT only)
router.post(
  '/:id/requirements',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  validateRequest({ body: createRequirementSchema }),
  TendersController.addRequirement
);

// Officer & Admin update requirement (DRAFT only)
router.patch(
  '/:id/requirements/:requirementId',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  validateRequest({ body: updateRequirementSchema }),
  TendersController.updateRequirement
);

// Officer & Admin delete requirement (DRAFT only)
router.delete(
  '/:id/requirements/:requirementId',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  TendersController.deleteRequirement
);

// Explicit publish endpoint
router.post(
  '/:id/publish',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  TendersController.publishTender
);

// Lifecycle transition endpoint (close, evaluate, award, cancel)
router.post(
  '/:id/lifecycle',
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  validateRequest({ body: lifecycleActionSchema }),
  TendersController.transitionLifecycle
);

export default router;
