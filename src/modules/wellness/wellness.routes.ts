import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import {
  createWellnessLogController,
  getMyWellnessLogsController,
  getWellnessLogsController,
} from './wellness.controller';

const router = Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/mood', createWellnessLogController);
router.get('/', getWellnessLogsController);
router.get('/me', getMyWellnessLogsController);

export default router;
