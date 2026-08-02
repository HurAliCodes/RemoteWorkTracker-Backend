import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { getDashboardSummaryController } from './dashboard.controller';

const router = Router();

router.get('/summary', authenticateJWT, requirePortalToken, getDashboardSummaryController);

export default router;
