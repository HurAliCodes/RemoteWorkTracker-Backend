import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import {
  getAgentActivityDetailController,
  getAgentAppsByDayController,
  getAgentDailyTelemetryController,
  getAgentDeskLatestController,
} from './telemetry.controller';

const router = Router();

router.get('/agent/daily', authenticateJWT, getAgentDailyTelemetryController);
router.get('/agent/activity-detail', authenticateJWT, getAgentActivityDetailController);
router.get('/agent/apps-by-day', authenticateJWT, getAgentAppsByDayController);
router.get('/agent/desk-latest', authenticateJWT, getAgentDeskLatestController);

export default router;
