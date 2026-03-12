import { Router } from 'express';
import { botController } from '../controllers/botController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All bot routes require authentication
router.use(authMiddleware);

router.post('/', botController.create);
router.get('/', botController.list);
router.get('/:id', botController.getById);
router.patch('/:id', botController.update);

export default router;
