import { Router } from 'express';
import { systemConfigController } from '../controllers/systemConfigController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', systemConfigController.list);
router.patch('/:id', systemConfigController.update);

export default router;
