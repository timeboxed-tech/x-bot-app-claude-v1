import { Router } from 'express';
import { jobConfigController } from '../controllers/jobConfigController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', jobConfigController.list);
router.patch('/:id', jobConfigController.update);

export default router;
