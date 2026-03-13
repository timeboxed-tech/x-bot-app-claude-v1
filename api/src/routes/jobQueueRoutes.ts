import { Router } from 'express';
import { jobQueueController } from '../controllers/jobQueueController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/stats', jobQueueController.getStats);

export default router;
