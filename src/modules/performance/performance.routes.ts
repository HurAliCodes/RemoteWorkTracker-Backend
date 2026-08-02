import express from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import {
  generateController,
  listController,
  getByIdController,
  finalizeController,
} from './performance.controller';

const router = express.Router();
router.use(authenticateJWT, requirePortalToken);
router.post('/generate', requireManagerOrAdmin, generateController);
router.get('/', listController);
router.get('/:id', getByIdController);
router.patch('/:id/finalize', requireManagerOrAdmin, finalizeController);

export default router;
