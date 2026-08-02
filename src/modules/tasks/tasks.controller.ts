import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { assertResourceInCallerOrg, taskBelongsToOrg } from '../../utils/org-access';
import { AppError } from '../../utils/errors';
import {
  createTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
  deleteTaskService,
  addTaskCommentService,
  getTaskCommentsService,
  getTaskAttachmentsService,
  addTaskAttachmentService,
  deleteTaskAttachmentService,
} from './tasks.service';

function getJwtUserId(req: Request): string | undefined {
  const u = (req as AuthRequest).user;
  if (!u) return undefined;
  return u.userId as string | undefined;
}

async function requireTaskAccess(req: Request, res: Response, taskId: string) {
  const orgId = await assertResourceInCallerOrg(
    req as AuthRequest,
    res,
    taskId,
    taskBelongsToOrg,
    'Task not found'
  );
  return orgId;
}

export const createTaskController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) throw AppError.unauthorized('Unauthorized or missing organization');
    const body = req.body;
    const result = await createTaskService({
      project_id: body.project_id ?? body.projectId,
      assigned_to: body.assigned_to ?? body.assignedTo,
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      deadline: body.deadline ?? null,
      organization_id: organizationId,
    });
    return success(res, result, 'Task created successfully', 201);
  } catch (err) {
    return next(err);
  }
};

export const getAllTasksController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) throw AppError.unauthorized('Unauthorized or missing organization');
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const project_id = (req.query.project_id || req.query.projectId) as string | undefined;
    let assigned_to = (req.query.assigned_to || req.query.assignedTo) as string | undefined;

    // Ordinary employees may only list their own assignments.
    const privileged = await isManagerOrAdmin(req);
    const callerId = getJwtUserId(req);
    if (!privileged) {
      if (!callerId) throw AppError.unauthorized('Unauthorized');
      assigned_to = callerId;
    }

    const result = await getAllTasksService({
      page,
      limit,
      project_id,
      organization_id: organizationId,
      assigned_to,
    });
    return success(res, result, 'Tasks fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const getTaskByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, id))) return;
    const task = await getTaskByIdService(id);
    if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
    return success(res, task, 'Task fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const updateTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, id))) return;
    const body = req.body;
    const result = await updateTaskService(id, {
      assigned_to: body.assigned_to ?? body.assignedTo,
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      deadline: body.deadline,
    });
    return success(res, result, 'Task updated successfully');
  } catch (err) {
    return next(err);
  }
};

export const deleteTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, id))) return;
    const authReq = req as AuthRequest;
    const result = await deleteTaskService(id, {
      userId: authReq.user?.userId,
      organizationId: authReq.user?.organizationId,
    });
    return success(res, result, 'Task deleted successfully');
  } catch (err) {
    return next(err);
  }
};

export const createTaskCommentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, taskId))) return;
    const userId = getJwtUserId(req);
    if (!userId) {
      throw AppError.forbidden('User id missing from token; comments require a user session.');
    }
    const { comment } = req.body;
    const result = await addTaskCommentService(taskId, userId, comment);
    return success(res, result, 'Comment added successfully', 201);
  } catch (err) {
    return next(err);
  }
};

export const getTaskCommentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, taskId))) return;
    const rows = await getTaskCommentsService(taskId);
    return success(res, rows, 'Comments fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const getTaskAttachmentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, taskId))) return;
    const result = await getTaskAttachmentsService(taskId);
    return success(res, result, 'Attachments fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const createTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, taskId))) return;
    const file_path = req.body.file_path ?? req.body.filePath;
    const result = await addTaskAttachmentService(taskId, file_path);
    return success(res, result, 'Attachment added successfully', 201);
  } catch (err) {
    return next(err);
  }
};

export const deleteTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireTaskAccess(req, res, taskId))) return;
    const attachmentId = Array.isArray(req.params.attachmentId)
      ? req.params.attachmentId[0]
      : req.params.attachmentId;
    const result = await deleteTaskAttachmentService(taskId, attachmentId);
    return success(res, result, 'Attachment deleted successfully');
  } catch (err) {
    return next(err);
  }
};
