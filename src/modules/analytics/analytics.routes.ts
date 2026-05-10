import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import {
	getAiPerformanceRankingController,
	getAnalyticsOverviewController,
	getPortalAiWeeklyReportsController,
	getProductivityAnalyticsController,
	getTeamPerformanceAnalyticsController,
	postGeneratePortalAiReportController,
} from './analytics.controller';

const router = Router();

router.get('/overview', authenticateJWT, getAnalyticsOverviewController);
router.post('/ai-report/generate', authenticateJWT, postGeneratePortalAiReportController);
router.get('/ai-reports/:employeeId', authenticateJWT, getPortalAiWeeklyReportsController);
router.get('/productivity', authenticateJWT, getProductivityAnalyticsController);
router.get('/team-performance', authenticateJWT, getTeamPerformanceAnalyticsController);
router.get('/ai-performance-ranking', authenticateJWT, getAiPerformanceRankingController);

export default router;
