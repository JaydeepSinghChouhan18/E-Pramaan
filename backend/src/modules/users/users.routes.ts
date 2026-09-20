import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { requireAuthenticatedUser, requireAnyRole } from '../../middlewares/auth.js';
import { UserRole } from '@e-pramaan/shared';

const router = Router();

// GET /api/v1/users/me
router.get('/me', requireAuthenticatedUser, UsersController.getMe);

// Admin User Management routes
router.get('/', requireAuthenticatedUser, requireAnyRole([UserRole.ADMIN]), UsersController.listUsers);
router.post('/provision', requireAuthenticatedUser, requireAnyRole([UserRole.ADMIN]), UsersController.provisionUser);

export default router;
