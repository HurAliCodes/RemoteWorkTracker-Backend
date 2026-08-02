import express from 'express';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';
import {
  generatePayrollController,
  getMyPayrollController,
  getPayrollByIdController,
  getUserPayrollController,
  listPayrollController,
} from './payroll.controller';

const router = express.Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/generate', apiRateLimiter, requireOrgAdmin, generatePayrollController);
router.get('/', requireOrgAdmin, listPayrollController);
router.get('/me', getMyPayrollController);
router.get('/user/:userId', getUserPayrollController);
router.get('/:id', getPayrollByIdController);

export default router;
