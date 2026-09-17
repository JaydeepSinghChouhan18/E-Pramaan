import { Router } from 'express';
import multer from 'multer';
import { BidsController } from './bids.controller.js';
import { requireAuthenticatedUser, requireRole, requireAnyRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Bidder-specific endpoints
router.post(
  '/',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.createDraftBid
);

router.get(
  '/my-bids',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.getMyBids
);

router.get(
  '/my-documents',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.getMyDocuments
);

router.post(
  '/:id/documents',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.attachDocument
);

router.post(
  '/:id/documents/upload',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  upload.single('file'),
  BidsController.uploadDocument
);

router.get(
  '/:id/documents/:documentId/file',
  requireAuthenticatedUser,
  BidsController.getDocumentFile
);

router.delete(
  '/:id/documents/:documentId',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.removeDocument
);

router.post(
  '/:id/submit',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.submitBid
);

router.post(
  '/:id/withdraw',
  requireAuthenticatedUser,
  requireRole(UserRole.BIDDER),
  BidsController.withdrawBid
);

// Officer-specific endpoints
router.get(
  '/tender/:tenderId',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN, UserRole.AUDITOR]),
  BidsController.listBidsForTender
);

router.post(
  '/:id/review',
  requireAuthenticatedUser,
  requireAnyRole([UserRole.OFFICER, UserRole.ADMIN]),
  BidsController.transitionReviewStatus
);


// Common access endpoint (authenticated with role-based checks inside service)
router.get(
  '/:id',
  requireAuthenticatedUser,
  BidsController.getBidById
);

export default router;
