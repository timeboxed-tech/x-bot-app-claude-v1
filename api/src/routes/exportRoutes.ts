import { Router } from 'express';
import { exportController } from '../controllers/exportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/config', exportController.config);

export default router;
