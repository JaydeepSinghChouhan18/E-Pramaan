import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import orgRoutes from '../modules/organizations/organizations.routes.js';
import tendersRoutes from '../modules/tenders/tenders.routes.js';
import bidsRoutes from '../modules/bids/bids.routes.js';
import complianceRoutes from '../modules/compliance/compliance.routes.js';
import investigationsRoutes from '../modules/investigations/investigations.routes.js';
import awardsRoutes from '../modules/awards/awards.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import searchRoutes from '../modules/search/search.routes.js';
import { requireAuthenticatedUser } from '../middlewares/auth.js';
import { UsersController } from '../modules/users/users.controller.js';

const apiRouter = Router();

// Base health route
apiRouter.use(healthRoutes);

// Auth endpoints: /api/v1/auth/*
apiRouter.use('/auth', authRoutes);

// Protected /api/v1/me
apiRouter.get('/me', requireAuthenticatedUser, UsersController.getMe);

// Users endpoints: /api/v1/users/*
apiRouter.use('/users', usersRoutes);

// Organizations endpoints: /api/v1/organizations/*
apiRouter.use('/organizations', orgRoutes);

// Tenders & Requirements endpoints: /api/v1/tenders/*
apiRouter.use('/tenders', tendersRoutes);

// Bids & Document Submission endpoints: /api/v1/bids/*
apiRouter.use('/bids', bidsRoutes);

// Compliance & Verification Engine endpoints: /api/v1/compliance/*
apiRouter.use('/compliance', complianceRoutes);

// Risk & Investigation endpoints: /api/v1/investigations/*
apiRouter.use('/investigations', investigationsRoutes);

// Awards & Comparative Decisions endpoints: /api/v1/awards/*
apiRouter.use('/awards', awardsRoutes);

// Audit & Governance endpoints: /api/v1/audit/*
apiRouter.use('/audit', auditRoutes);

// Grounded AI Assistant & Summary endpoints: /api/v1/ai/*
apiRouter.use('/ai', aiRoutes);

// Notifications endpoints: /api/v1/notifications/*
apiRouter.use('/notifications', notificationsRoutes);

// Global Search endpoints: /api/v1/search/*
apiRouter.use('/search', searchRoutes);

export default apiRouter;



