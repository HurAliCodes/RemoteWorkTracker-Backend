import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
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

router.use(authenticateJWT);
router.post('/employee-data', syncEmployeeDataController);
router.post('/task-data', syncTaskDataController);
router.post('/report', generateAnalyticsReportController);
router.post('/report/enqueue', enqueueAnalyticsReportController);
router.post('/report/replay', replayAnalyticsReportController);
router.get('/report/dlq', inspectDlqController);
router.post('/report/dlq/replay', replayDlqController);
router.get('/reports/:employeeId', getWeeklyReportsController);

export default router;
