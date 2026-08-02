import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import {
  getAgentActivityDetailController,
  getAgentAppsByDayController,
  getAgentDailyTelemetryController,
  getAgentDeskLatestController,
} from './telemetry.controller';

const router = Router();

router.use(authenticateJWT, requirePortalToken);
router.get('/agent/daily', getAgentDailyTelemetryController);
router.get('/agent/activity-detail', getAgentActivityDetailController);
router.get('/agent/apps-by-day', getAgentAppsByDayController);
router.get('/agent/desk-latest', getAgentDeskLatestController);

export default router;
