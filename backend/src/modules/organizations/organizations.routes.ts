import { Router } from 'express';
import { OrganizationsController } from './organizations.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// GET /api/v1/organizations (requires authenticated user)
router.get('/', requireAuthenticatedUser, OrganizationsController.list);

export default router;
