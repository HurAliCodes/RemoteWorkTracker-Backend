import express from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createTaskSchema,
  updateTaskSchema,
  createTaskCommentSchema,
  createTaskAttachmentSchema,
} from './tasks.validation';
import {
  createTaskController,
  getAllTasksController,
  getTaskByIdController,
  updateTaskController,
  deleteTaskController,
  createTaskCommentController,
  getTaskCommentsController,
  createTaskAttachmentController,
  getTaskAttachmentsController,
  deleteTaskAttachmentController,
} from './tasks.controller';
import { apiRateLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();

router.use(authenticateJWT, requirePortalToken);
router.post('/', apiRateLimiter, validate(createTaskSchema), createTaskController);
router.patch('/:id', apiRateLimiter, validate(updateTaskSchema), updateTaskController);
router.delete('/:id', apiRateLimiter, deleteTaskController);
router.post('/:id/comments', apiRateLimiter, validate(createTaskCommentSchema), createTaskCommentController);
router.get('/:id/attachments', getTaskAttachmentsController);
router.post('/:id/attachments', apiRateLimiter, validate(createTaskAttachmentSchema), createTaskAttachmentController);
router.delete('/:id/attachments/:attachmentId', apiRateLimiter, deleteTaskAttachmentController);
router.get('/', getAllTasksController);
router.get('/:id', getTaskByIdController);
router.get('/:id/comments', getTaskCommentsController);

export default router;
