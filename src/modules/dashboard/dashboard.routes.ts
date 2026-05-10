import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { getDashboardSummaryController } from './dashboard.controller';

const router = Router();

router.get('/summary', authenticateJWT, getDashboardSummaryController);

export default router;
