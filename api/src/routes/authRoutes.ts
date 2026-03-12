import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/magic-link — send magic link email
router.post('/magic-link', authController.sendMagicLink);

// GET /api/auth/verify — verify magic link token
router.get('/verify', authController.verifyToken);

// GET /api/auth/me — get current user
router.get('/me', requireAuth, authController.getMe);

// POST /api/auth/logout — logout
router.post('/logout', authController.logout);

export default router;
