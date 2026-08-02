import express from 'express';
import { createRoleController, getRolesController, getRoleByIdController, updateRoleController, deleteRoleController } from './role.controller';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';

const router = express.Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/', apiRateLimiter, requireOrgAdmin, createRoleController);
router.patch('/:id', apiRateLimiter, requireOrgAdmin, updateRoleController);
router.delete('/:id', apiRateLimiter, requireOrgAdmin, deleteRoleController);
router.get('/', getRolesController);
router.get('/:id', getRoleByIdController);

export default router;
