import { Router } from 'express';
import * as botController from '../controllers/botController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/bots/me — get current user's bot
router.get('/me', requireAuth, botController.getMyBot);

// POST /api/bots — create bot
router.post('/', requireAuth, botController.createMyBot);

// PATCH /api/bots/:botId — update bot
router.patch('/:botId', requireAuth, botController.updateMyBot);

export default router;
