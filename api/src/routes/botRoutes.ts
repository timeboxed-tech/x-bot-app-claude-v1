import { Router } from 'express';
import { botController } from '../controllers/botController.js';
import { botShareController } from '../controllers/botShareController.js';
import { botTipController } from '../controllers/botTipController.js';
import { botBehaviourController } from '../controllers/botBehaviourController.js';
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

// Generate draft for a specific behaviour
router.post('/:id/generate-draft/:behaviourId', botController.generateDraftForBehaviour);

// Share routes
router.post('/:id/shares', botShareController.create);
router.get('/:id/shares', botShareController.list);
router.delete('/:id/shares/:userId', botShareController.remove);

// Tip routes
router.get('/:id/tips', botTipController.list);
router.patch('/:id/tips/:tipId', botTipController.update);
router.delete('/:id/tips/:tipId', botTipController.remove);

// Behaviour routes
router.get('/:id/behaviours', botBehaviourController.list);
router.post('/:id/behaviours', botBehaviourController.create);
router.patch('/:id/behaviours/:behaviourId', botBehaviourController.update);
router.delete('/:id/behaviours/:behaviourId', botBehaviourController.remove);
router.patch('/:id/behaviours/:behaviourId/toggle', botBehaviourController.toggleActive);

// Judge assignment routes
router.get('/:id/judges', botJudgeController.list);
router.post('/:id/judges', botJudgeController.assign);
router.delete('/:id/judges/:judgeId', botJudgeController.remove);

export default router;
