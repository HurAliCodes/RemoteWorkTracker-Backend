import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { aiHeavyRateLimiter } from '../../middleware/rateLimit.middleware';
import {
	getAiPerformanceRankingController,
	getAnalyticsOverviewController,
	getPortalAiWeeklyReportsController,
	getProductivityAnalyticsController,
	getTeamPerformanceAnalyticsController,
	postGeneratePortalAiReportController,
} from './analytics.controller';

const router = Router();

router.use(authenticateJWT, requirePortalToken);
router.get('/overview', getAnalyticsOverviewController);
router.post('/ai-report/generate', aiHeavyRateLimiter, postGeneratePortalAiReportController);
router.get('/ai-reports/:employeeId', getPortalAiWeeklyReportsController);
router.get('/productivity', getProductivityAnalyticsController);
router.get('/team-performance', getTeamPerformanceAnalyticsController);
router.get('/ai-performance-ranking', getAiPerformanceRankingController);

export default router;
