import { Router } from 'express';
import * as xOAuthController from '../controllers/xOAuthController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/auth/x/connect?botId=... — initiate X OAuth 1.0a flow
router.get('/connect', requireAuth, xOAuthController.initiateConnect);

// GET /api/auth/x/callback — handle callback from X
router.get('/callback', xOAuthController.handleCallback);

export default router;
