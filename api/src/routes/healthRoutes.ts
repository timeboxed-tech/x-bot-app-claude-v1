import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/', healthController.check);
router.get('/ping', healthController.ping);

export default router;
