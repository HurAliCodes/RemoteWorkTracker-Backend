import express from 'express';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';
import {
  generatePayrollController,
  getPayrollByIdController,
  getUserPayrollController,
  listPayrollController,
} from './payroll.controller';

const router = express.Router();

router.post('/generate', apiRateLimiter, generatePayrollController);
router.get('/', listPayrollController);
router.get('/user/:userId', getUserPayrollController);
router.get('/:id', getPayrollByIdController);

export default router;
