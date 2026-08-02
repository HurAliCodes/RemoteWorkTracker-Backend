import logger from '../../config/logger';
import crypto from 'crypto';
import * as taskRepo from './tasks.repository';
import { mapTaskAttachmentToApi, mapTaskCommentToApi, mapTaskToApi } from './tasks.mapper';
import { buildTaskSyncSnapshot, syncTaskLifecycleToAi } from '../ai/ai.autosync';
import { isAiIntegrationConfigured } from '../ai/ai.service';
import { publishTaskEvent } from '../../utils/rabbitmq';
import { AppError } from '../../utils/errors';

export interface CreateTaskInput {
  project_id: string;
  assigned_to: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  /** ISO date or YYYY-MM-DD */
  deadline?: string | null;
  organization_id?: string;
}

export interface UpdateTaskInput {
  assigned_to?: string;
  title?: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  deadline?: string | null;
}

/** @deprecated use mapTaskToApi */
export function shapeTaskRowForApi(row: taskRepo.TaskRow | null) {
  return mapTaskToApi(row);
}

export async function createTaskService(data: CreateTaskInput) {
  if (!data.title || data.title.length < 1 || data.title.length > 255) {
    throw AppError.badRequest('Title must be between 1 and 255 characters.');
  }
  const project = await taskRepo.findProjectById(data.project_id);
  if (!project) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
  if (data.organization_id && project.organization_id !== data.organization_id) {
    throw AppError.forbidden('Project does not belong to this organization.');
  }
  const assignee = await taskRepo.findUserById(data.assigned_to);
  if (!assignee) throw AppError.notFound('Assignee (user) not found.', 'USER_NOT_FOUND');
  if (
    data.organization_id &&
    assignee.organization_id &&
    assignee.organization_id !== data.organization_id
  ) {
    throw AppError.forbidden('Assignee does not belong to this organization.');
  }

  const task_id = crypto.randomUUID();
  const now = new Date().toISOString();
  const deadline =
    data.deadline != null && String(data.deadline).trim() !== ''
      ? String(data.deadline).trim().slice(0, 10)
      : null;

  try {
    await taskRepo.insertTask({
      task_id,
      project_id: data.project_id,
      assigned_to: data.assigned_to,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? null,
      priority: data.priority ?? null,
      deadline,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23503') throw AppError.badRequest('Invalid project_id or assigned_to.', 'FK_VIOLATION');
    throw err;
  }
  logger.info('Task created', { task_id, project_id: data.project_id });
  const createdTask = await taskRepo.findTaskById(task_id);
  if (createdTask && isAiIntegrationConfigured()) {
    const projectRow = await taskRepo.findProjectById(data.project_id);
    const tenantId = String((projectRow?.organization_id as string | undefined) || '').trim();
    if (tenantId) {
      await syncTaskLifecycleToAi(
        buildTaskSyncSnapshot({
          tenantId,
          taskId: task_id,
          employeeId: data.assigned_to,
          status: createdTask.status,
        })
      );
    }
  }
  try {
    await publishTaskEvent({
      type: 'task:assigned',
      userId: data.assigned_to,
      projectId: data.project_id,
      data: createdTask,
    });
  } catch (err) {
    logger.error('Failed to publish task:assigned event', { error: err });
  }
  return mapTaskToApi(createdTask);
}

export async function getAllTasksService(opts: {
  page?: number;
  limit?: number;
  project_id?: string;
  organization_id?: string;
  assigned_to?: string;
}) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  const projectId = opts.project_id && opts.project_id.length > 0 ? opts.project_id : undefined;
  const organizationId = opts.organization_id;
  const assignedTo = opts.assigned_to && opts.assigned_to.length > 0 ? opts.assigned_to : undefined;

  const totalRecords = await taskRepo.countTasks(projectId, organizationId, assignedTo);
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const rows = await taskRepo.listTasksPaginated({
    projectId,
    organizationId,
    assignedTo,
    limit,
    offset,
  });
  const data = rows.map((r) => mapTaskToApi(r)!);

  return { meta: { page, limit, totalRecords, totalPages }, data };
}

export async function getTaskByIdService(id: string) {
  const row = await taskRepo.findTaskById(id);
  return mapTaskToApi(row);
}

export async function updateTaskService(id: string, data: UpdateTaskInput) {
  const existing = await taskRepo.findTaskById(id);
  if (!existing) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');

  if (data.title !== undefined && (data.title.length < 1 || data.title.length > 255)) {
    throw AppError.badRequest('Title must be between 1 and 255 characters.');
  }
  if (data.assigned_to !== undefined) {
    const u = await taskRepo.findUserById(data.assigned_to);
    if (!u) throw AppError.notFound('Assignee (user) not found.', 'USER_NOT_FOUND');
  }

  const allowed = ['assigned_to', 'title', 'description', 'status', 'priority'] as const;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  if (data.deadline !== undefined) {
    const d = data.deadline;
    updates.deadline =
      d === null || String(d).trim() === '' ? null : String(d).trim().slice(0, 10);
  }
  try {
    await taskRepo.updateTaskById(id, updates);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23503') throw AppError.badRequest('Invalid assigned_to.', 'FK_VIOLATION');
    throw err;
  }
  const updatedTask = await taskRepo.findTaskById(id);
  if (updatedTask && isAiIntegrationConfigured()) {
    const assignedTo =
      typeof updatedTask.assigned_to === 'string' && updatedTask.assigned_to
        ? updatedTask.assigned_to
        : typeof existing.assigned_to === 'string'
          ? existing.assigned_to
          : '';
    const projectId =
      typeof updatedTask.project_id === 'string' && updatedTask.project_id
        ? updatedTask.project_id
        : typeof existing.project_id === 'string'
          ? existing.project_id
          : '';
    if (assignedTo && projectId) {
      const project = await taskRepo.findProjectById(projectId);
      const tenantId = String((project?.organization_id as string | undefined) || '').trim();
      if (tenantId) {
        await syncTaskLifecycleToAi(
          buildTaskSyncSnapshot({
            tenantId,
            taskId: id,
            employeeId: assignedTo,
            status: updatedTask.status,
          })
        );
      }
    }
  }
  return mapTaskToApi(updatedTask);
}

export async function deleteTaskService(
  id: string,
  actor?: { userId?: string; organizationId?: string }
) {
  const existing = await taskRepo.findTaskById(id);
  if (!existing) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  const { withTransaction } = await import('../../utils/withTransaction');
  const { writeAuditLog } = await import('../../utils/audit');
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE tasks
       SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
       WHERE task_id = $1 AND deleted_at IS NULL`,
      [id, actor?.userId ?? null]
    );
    await writeAuditLog(
      {
        entityType: 'task',
        entityId: id,
        action: 'soft_delete',
        actorUserId: actor?.userId,
        actorOrganizationId: actor?.organizationId,
      },
      client
    );
  });
  logger.info('Task soft-deleted', { task_id: id });
  return { message: 'Task deleted successfully.' };
}

export async function addTaskCommentService(taskId: string, userId: string, comment: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  const user = await taskRepo.findUserById(userId);
  if (!user) throw AppError.notFound('User not found.', 'USER_NOT_FOUND');

  const comment_id = crypto.randomUUID();
  const now = new Date().toISOString();
  await taskRepo.insertTaskComment({
    comment_id,
    task_id: taskId,
    user_id: userId,
    comment,
    created_at: now,
    updated_at: now,
  });
  const createdComment = await taskRepo.findTaskCommentById(comment_id);
  try {
    await publishTaskEvent({
      type: 'task:commented',
      userId,
      projectId: task.project_id as string | undefined,
      data: createdComment,
    });
  } catch (err) {
    logger.error('Failed to publish task:commented event', { error: err });
  }
  return createdComment ? mapTaskCommentToApi(createdComment) : createdComment;
}

export async function getTaskCommentsService(taskId: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  const rows = await taskRepo.listCommentsByTaskId(taskId);
  return rows.map(mapTaskCommentToApi);
}

export async function getTaskAttachmentsService(taskId: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  const rows = await taskRepo.listTaskAttachments(taskId);
  return rows.map(mapTaskAttachmentToApi);
}

export async function addTaskAttachmentService(taskId: string, file_path: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  if (!file_path || file_path.length > 255) {
    throw AppError.badRequest('file_path is required (max 255 characters).');
  }

  const attachment_id = crypto.randomUUID();
  const now = new Date().toISOString();
  await taskRepo.insertTaskAttachment({
    attachment_id,
    task_id: taskId,
    file_path,
    created_at: now,
    updated_at: now,
  });
  const createdAttachment = await taskRepo.findTaskAttachmentById(attachment_id);
  try {
    await publishTaskEvent({
      type: 'task:attachment:added',
      userId: task.assigned_to as string | undefined,
      projectId: task.project_id as string | undefined,
      data: createdAttachment,
    });
  } catch (err) {
    logger.error('Failed to publish task:attachment:added event', { error: err });
  }
  return createdAttachment ? mapTaskAttachmentToApi(createdAttachment) : createdAttachment;
}

export async function deleteTaskAttachmentService(taskId: string, attachmentId: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw AppError.notFound('Task not found.', 'TASK_NOT_FOUND');
  const row = await taskRepo.findTaskAttachmentById(attachmentId);
  if (!row || (row as { task_id: string }).task_id !== taskId) {
    throw AppError.notFound('Attachment not found.', 'ATTACHMENT_NOT_FOUND');
  }
  const deleted = await taskRepo.deleteTaskAttachment(taskId, attachmentId);
  if (deleted === 0) throw AppError.notFound('Attachment not found.', 'ATTACHMENT_NOT_FOUND');
  return { message: 'Attachment deleted successfully.' };
}
