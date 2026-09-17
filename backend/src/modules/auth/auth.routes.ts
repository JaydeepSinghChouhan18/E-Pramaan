import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { registerSchema, loginSchema } from './auth.validation.js';
import { requireAuthenticatedUser } from '../../middlewares/auth.js';

const router = Router();

router.post('/register', validateRequest({ body: registerSchema }), AuthController.register);
router.post('/login', validateRequest({ body: loginSchema }), AuthController.login);
router.post('/logout', AuthController.logout);

export default router;
