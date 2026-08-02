import express from 'express';
import { createDepartmentController, getAllDepartmentsController, deleteDepartmentController, reassignUsersDepartmentController, getDepartmentByIdController, updateDepartmentController } from './department.controller';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/', apiRateLimiter, requireOrgAdmin, createDepartmentController);
router.patch('/:id', apiRateLimiter, requireOrgAdmin, updateDepartmentController);
router.delete('/:id', apiRateLimiter, requireOrgAdmin, deleteDepartmentController);
router.put('/reassign-users', apiRateLimiter, requireOrgAdmin, reassignUsersDepartmentController);
router.get('/', getAllDepartmentsController);
router.get('/:id', getDepartmentByIdController);

export default router;
