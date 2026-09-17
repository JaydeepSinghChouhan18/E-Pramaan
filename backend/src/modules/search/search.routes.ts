import { Router } from 'express';
import { SearchController } from './search.controller.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

// GET /api/v1/search?q=xyz&limit=20
router.get('/', requireAuthenticatedUser, SearchController.searchGlobal);

export default router;
