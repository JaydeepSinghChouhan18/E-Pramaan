import { Router } from 'express';
import { AIController } from './ai.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// POST /api/v1/ai/query - Ask AI Assistant (grounded in authorized tender/bid context)
router.post('/query', requireAuthenticatedUser, AIController.queryAssistant);

// GET /api/v1/ai/tenders/:tenderId/summary - Get AI summary of tender
router.get('/tenders/:tenderId/summary', requireAuthenticatedUser, AIController.getTenderSummary);

// GET /api/v1/ai/integration-health - Get honest status of government source gateways
router.get('/integration-health', requireAuthenticatedUser, AIController.getIntegrationHealth);

export default router;
