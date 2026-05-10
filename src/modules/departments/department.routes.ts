
import express from 'express';
import { createDepartmentController, getAllDepartmentsController, deleteDepartmentController, reassignUsersDepartmentController, getDepartmentByIdController, updateDepartmentController } from './department.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();


router.post('/', apiRateLimiter, createDepartmentController);
router.patch('/:id', apiRateLimiter, updateDepartmentController);
router.delete('/:id', apiRateLimiter, deleteDepartmentController);
router.put('/reassign-users', apiRateLimiter, authenticateJWT, reassignUsersDepartmentController);


router.get('/', authenticateJWT, getAllDepartmentsController);
router.get('/:id', getDepartmentByIdController);

export default router;
