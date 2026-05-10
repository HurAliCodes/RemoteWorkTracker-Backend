import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import {
  createWellnessLogController,
  getMyWellnessLogsController,
  getWellnessLogsController,
} from './wellness.controller';

const router = Router();

router.post('/mood', authenticateJWT, createWellnessLogController);
router.get('/', authenticateJWT, getWellnessLogsController);
router.get('/me', authenticateJWT, getMyWellnessLogsController);

export default router;
