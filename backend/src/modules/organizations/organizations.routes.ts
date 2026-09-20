import { Router } from 'express';
import { OrganizationsController } from './organizations.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// GET /api/v1/organizations (requires authenticated user)
router.get('/', requireAuthenticatedUser, OrganizationsController.list);

// Current user's organization profile
router.get('/me', requireAuthenticatedUser, OrganizationsController.getMyOrganization);
router.patch('/me', requireAuthenticatedUser, OrganizationsController.updateMyOrganization);

export default router;
