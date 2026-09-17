import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// GET /api/v1/notifications
router.get('/', requireAuthenticatedUser, NotificationsController.listNotifications);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', requireAuthenticatedUser, NotificationsController.markRead);

// POST /api/v1/notifications/mark-all-read
router.post('/mark-all-read', requireAuthenticatedUser, NotificationsController.markAllRead);

export default router;
