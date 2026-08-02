import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { aiHeavyRateLimiter } from '../../middleware/rateLimit.middleware';
import {
	enqueueAnalyticsReportController,
	generateAnalyticsReportController,
	getWeeklyReportsController,
	inspectDlqController,
	replayAnalyticsReportController,
	replayDlqController,
	syncEmployeeDataController,
	syncTaskDataController,
} from './ai.controller';

const router = Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/employee-data', syncEmployeeDataController);
router.post('/task-data', syncTaskDataController);
router.post('/report', aiHeavyRateLimiter, generateAnalyticsReportController);
router.post('/report/enqueue', aiHeavyRateLimiter, enqueueAnalyticsReportController);
router.post('/report/replay', aiHeavyRateLimiter, replayAnalyticsReportController);
router.get('/report/dlq', inspectDlqController);
router.post('/report/dlq/replay', replayDlqController);
router.get('/reports/:employeeId', getWeeklyReportsController);

export default router;
