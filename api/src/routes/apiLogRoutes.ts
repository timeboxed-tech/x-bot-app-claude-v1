import { Router } from 'express';
import { apiLogController } from '../controllers/apiLogController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.get('/', apiLogController.list);
router.get('/:id', apiLogController.getById);

export default router;
