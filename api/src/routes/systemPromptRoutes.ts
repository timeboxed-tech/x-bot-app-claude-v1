import { Router } from 'express';
import { systemPromptController } from '../controllers/systemPromptController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', systemPromptController.list);
router.patch('/:id', systemPromptController.update);

export default router;
