import { Router } from 'express';
import { exportController } from '../controllers/exportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/system-prompts', exportController.systemPrompts);
router.get('/judges', exportController.judges);
router.get('/bots', exportController.bots);

export default router;
