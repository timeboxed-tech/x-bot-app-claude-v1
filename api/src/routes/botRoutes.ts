import { Router } from 'express';
import { botController } from '../controllers/botController.js';
import { botShareController } from '../controllers/botShareController.js';
import { botTipController } from '../controllers/botTipController.js';
import { botStyleController } from '../controllers/botStyleController.js';
import { botJudgeController } from '../controllers/botJudgeController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All bot routes require authentication
router.use(authMiddleware);

router.post('/', botController.create);
router.get('/', botController.list);
router.get('/:id', botController.getById);
router.patch('/:id', botController.update);

// Generate practice drafts
router.post('/:id/generate-drafts', botController.generateDrafts);

// Share routes
router.post('/:id/shares', botShareController.create);
router.get('/:id/shares', botShareController.list);
router.delete('/:id/shares/:userId', botShareController.remove);

// Tip routes
router.get('/:id/tips', botTipController.list);
router.patch('/:id/tips/:tipId', botTipController.update);
router.delete('/:id/tips/:tipId', botTipController.remove);

// Style routes
router.get('/:id/styles', botStyleController.list);
router.post('/:id/styles', botStyleController.create);
router.patch('/:id/styles/:styleId', botStyleController.update);
router.delete('/:id/styles/:styleId', botStyleController.remove);
router.patch('/:id/styles/:styleId/toggle', botStyleController.toggleActive);

// Judge assignment routes
router.get('/:id/judges', botJudgeController.list);
router.post('/:id/judges', botJudgeController.assign);
router.delete('/:id/judges/:judgeId', botJudgeController.remove);

export default router;
