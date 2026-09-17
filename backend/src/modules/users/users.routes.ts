import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// GET /api/v1/users/me
router.get('/me', requireAuthenticatedUser, UsersController.getMe);

export default router;
