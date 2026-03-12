import { Router } from 'express';
import { statsController } from '../controllers/statsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All stats routes require authentication
router.use(authMiddleware);

router.get('/:id/stats', statsController.getBotStats);

export default router;
