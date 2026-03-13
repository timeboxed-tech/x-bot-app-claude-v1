import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, userController.list);
router.patch('/:id/password', authMiddleware, userController.updatePassword);

export default router;
