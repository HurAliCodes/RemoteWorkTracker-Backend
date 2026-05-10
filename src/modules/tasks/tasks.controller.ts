import { Request, Response, NextFunction } from 'express';
import logger from '../../config/logger';
import { success, error as errorResponse } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import {
  createTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  addTaskCommentService,
  getTaskCommentsService,
  addTaskAttachmentService,
  deleteTaskAttachmentService,
} from './tasks.service';

function getJwtUserId(req: Request): string | undefined {
  const u = (req as AuthRequest).user;
  if (!u) return undefined;
  return u.userId as string | undefined;
}

export const createTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const result = await createTaskService({
      project_id: body.project_id,
      assigned_to: body.assigned_to,
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      deadline: body.deadline ?? null,
    });
    return success(res, result, 'Task created successfully', 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create task';
    logger.error('Failed to create task', { error: message });
    const code = (err as { code?: string })?.code;
    if (code === '23503') return errorResponse(res, 'Invalid project_id or assigned_to.', 400);
    return errorResponse(res, message, 400);
  }
};

export const getAllTasksController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const project_id = req.query.project_id as string | undefined;
    const result = await getAllTasksService({ page, limit, project_id });
    return success(res, result, 'Tasks fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
    logger.error('Failed to fetch tasks', { error: message });
    return errorResponse(res, message, 400);
  }
};

export const getTaskByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const task = await getTaskByIdService(id);
    if (!task) return errorResponse(res, 'Task not found', 404);
    return success(res, task, 'Task fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch task';
    logger.error('Failed to fetch task', { error: message });
    return errorResponse(res, message, 400);
  }
};

export const updateTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body;
    const result = await updateTaskService(id, {
      assigned_to: body.assigned_to,
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      deadline: body.deadline,
    });
    return success(res, result, 'Task updated successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update task';
    logger.error('Failed to update task', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    const code = (err as { code?: string })?.code;
    if (code === '23503') return errorResponse(res, 'Invalid assigned_to.', 400);
    return errorResponse(res, message, 400);
  }
};

export const deleteTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await deleteTaskService(id);
    return success(res, result, 'Task deleted successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete task';
    logger.error('Failed to delete task', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    return errorResponse(res, message, 400);
  }
};

export const createTaskCommentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = getJwtUserId(req);
    if (!userId) {
      return errorResponse(res, 'User id missing from token; comments require a user session.', 403);
    }
    const { comment } = req.body;
    const result = await addTaskCommentService(taskId, userId, comment);
    return success(res, result, 'Comment added successfully', 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add comment';
    logger.error('Failed to add comment', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    if (message === 'User not found.') return errorResponse(res, 'User not found', 404);
    return errorResponse(res, message, 400);
  }
};

export const getTaskCommentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rows = await getTaskCommentsService(taskId);
    return success(res, rows, 'Comments fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch comments';
    logger.error('Failed to fetch comments', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    return errorResponse(res, message, 400);
  }
};

export const createTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { file_path } = req.body;
    const result = await addTaskAttachmentService(taskId, file_path);
    return success(res, result, 'Attachment added successfully', 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add attachment';
    logger.error('Failed to add attachment', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    return errorResponse(res, message, 400);
  }
};

export const deleteTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const attachmentId = Array.isArray(req.params.attachmentId)
      ? req.params.attachmentId[0]
      : req.params.attachmentId;
    const result = await deleteTaskAttachmentService(taskId, attachmentId);
    return success(res, result, 'Attachment deleted successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete attachment';
    logger.error('Failed to delete attachment', { error: message });
    if (message === 'Task not found.') return errorResponse(res, 'Task not found', 404);
    if (message === 'Attachment not found.') return errorResponse(res, 'Attachment not found', 404);
    return errorResponse(res, message, 400);
  }
};
