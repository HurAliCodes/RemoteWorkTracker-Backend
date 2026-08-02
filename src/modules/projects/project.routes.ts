import express from 'express';
import {
  createProjectController,
  getAllProjectsController,
  getProjectByIdController,
  listProjectMembersController,
  updateProjectController,
  deleteProjectController,
  addProjectMemberController,
  removeProjectMemberController,
} from './project.controller';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();

router.use(authenticateJWT, requirePortalToken);


router.post('/', apiRateLimiter, createProjectController);
router.patch('/:id', apiRateLimiter, updateProjectController);
router.delete('/:id', apiRateLimiter, deleteProjectController);
router.post('/:id/members', apiRateLimiter, addProjectMemberController);
router.delete('/:id/members/:userId', apiRateLimiter, removeProjectMemberController);


router.get('/', getAllProjectsController);
router.get('/:id/members', listProjectMembersController);
router.get('/:id', getProjectByIdController);

export default router;
