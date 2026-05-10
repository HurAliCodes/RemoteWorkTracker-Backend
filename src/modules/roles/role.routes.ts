
import express from 'express';
import { createRoleController, getRolesController, getRoleByIdController, updateRoleController, deleteRoleController } from './role.controller';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();


router.post('/', apiRateLimiter, createRoleController);
router.patch('/:id', apiRateLimiter, updateRoleController);
router.delete('/:id', apiRateLimiter, deleteRoleController);


router.get('/', getRolesController);
router.get('/:id', getRoleByIdController);

export default router;