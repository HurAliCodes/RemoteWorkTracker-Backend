import express from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin, requireManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import {
  createRuleController,
  listRulesController,
  updateRuleController,
  deleteRuleController,
  listViolationsController,
  resolveViolationController,
  acknowledgeRuleController,
} from './compliance.controller';

const router = express.Router();
router.use(authenticateJWT, requirePortalToken);
router.post('/rules', requireOrgAdmin, createRuleController);
router.get('/rules', requireOrgAdmin, listRulesController);
router.patch('/rules/:id', requireOrgAdmin, updateRuleController);
router.delete('/rules/:id', requireOrgAdmin, deleteRuleController);
router.post('/rules/:id/acknowledge', acknowledgeRuleController);
router.get('/violations', listViolationsController);
router.patch('/violations/:id/resolve', requireManagerOrAdmin, resolveViolationController);

export default router;
