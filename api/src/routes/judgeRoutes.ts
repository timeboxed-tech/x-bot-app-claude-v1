import { Router } from 'express';
import { judgeController } from '../controllers/judgeController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', judgeController.list);
router.post('/', judgeController.create);
router.patch('/:id', judgeController.update);
router.patch('/:id/archive', judgeController.archive);
router.patch('/:id/reactivate', judgeController.reactivate);
router.delete('/:id', judgeController.remove);

export default router;
