import { Router } from 'express';
import { postController } from '../controllers/postController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All post routes require authentication
router.use(authMiddleware);

router.get('/', postController.list);
router.patch('/:id', postController.update);
router.post('/:id/tweak', postController.tweak);
router.post('/:id/accept-tweak', postController.acceptTweak);

export default router;
