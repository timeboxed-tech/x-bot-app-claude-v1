import { Router } from 'express';
import { postController } from '../controllers/postController.js';
import { postReviewController } from '../controllers/postReviewController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All post routes require authentication
router.use(authMiddleware);

router.get('/', postController.list);
router.get('/counts', postController.counts);
router.delete('/discarded', postController.removeAllDiscarded);
router.patch('/:id', postController.update);
router.delete('/:id', postController.remove);
router.post('/:id/publish', postController.publish);
router.post('/:id/tweak', postController.tweak);
router.post('/:id/accept-tweak', postController.acceptTweak);

// Review routes
router.post('/:id/review', postReviewController.review);
router.get('/:id/reviews', postReviewController.list);
router.delete('/:id/reviews/:reviewId', postReviewController.remove);

export default router;
