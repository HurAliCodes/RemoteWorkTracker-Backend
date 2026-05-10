import logger from '../../config/logger';
import crypto from 'crypto';
import * as taskRepo from './tasks.repository';
import { buildTaskSyncSnapshot, syncTaskLifecycleToAi } from '../ai/ai.autosync';
import { isAiIntegrationConfigured } from '../ai/ai.service';
import { publishTaskEvent } from '../../utils/rabbitmq';

export interface CreateTaskInput {
  project_id: string;
  assigned_to: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  /** ISO date or YYYY-MM-DD */
  deadline?: string | null;
}

export interface UpdateTaskInput {
  assigned_to?: string;
  title?: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  deadline?: string | null;
}

/** DATE / TIMESTAMPTZ from node-pg → stable `YYYY-MM-DD` for JSON clients (table + edit forms). */
function normalizeDeadlineValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function shapeTaskRowForApi(row: taskRepo.TaskRow | null): taskRepo.TaskRow | null {
  if (!row) return null;
  return { ...row, deadline: normalizeDeadlineValue(row.deadline) };
}

export async function createTaskService(data: CreateTaskInput) {
  if (!data.title || data.title.length < 1 || data.title.length > 255) {
    throw new Error('Title must be between 1 and 255 characters.');
  }
  const project = await taskRepo.findProjectById(data.project_id);
  if (!project) throw new Error('Project not found.');
  const assignee = await taskRepo.findUserById(data.assigned_to);
  if (!assignee) throw new Error('Assignee (user) not found.');

  const task_id = crypto.randomUUID();
  const now = new Date().toISOString();
  const deadline =
    data.deadline != null && String(data.deadline).trim() !== ''
      ? String(data.deadline).trim().slice(0, 10)
      : null;

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
  logger.info('Task created', { task_id, project_id: data.project_id });
  const createdTask = await taskRepo.findTaskById(task_id);
  if (createdTask && isAiIntegrationConfigured()) {
    const project = await taskRepo.findProjectById(data.project_id);
    const tenantId = String((project?.organization_id as string | undefined) || '').trim();
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
  // Emit event for task assignment
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
  return shapeTaskRowForApi(createdTask);
}

export async function getAllTasksService(opts: { page?: number; limit?: number; project_id?: string }) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;
  const projectId = opts.project_id && opts.project_id.length > 0 ? opts.project_id : undefined;

  const totalRecords = await taskRepo.countTasks(projectId);
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const rows = await taskRepo.listTasksPaginated({ projectId, limit, offset });
  const data = rows.map((r) => shapeTaskRowForApi(r) as taskRepo.TaskRow);

  return { meta: { page, limit, totalRecords, totalPages }, data };
}

export async function getTaskByIdService(id: string) {
  const row = await taskRepo.findTaskById(id);
  return shapeTaskRowForApi(row);
}

export async function updateTaskService(id: string, data: UpdateTaskInput) {
  const existing = await taskRepo.findTaskById(id);
  if (!existing) throw new Error('Task not found.');

  if (data.title !== undefined && (data.title.length < 1 || data.title.length > 255)) {
    throw new Error('Title must be between 1 and 255 characters.');
  }
  if (data.assigned_to !== undefined) {
    const u = await taskRepo.findUserById(data.assigned_to);
    if (!u) throw new Error('Assignee (user) not found.');
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
  await taskRepo.updateTaskById(id, updates);
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
  return shapeTaskRowForApi(updatedTask);
}

export async function deleteTaskService(id: string) {
  const existing = await taskRepo.findTaskById(id);
  if (!existing) throw new Error('Task not found.');
  await taskRepo.deleteAttachmentsByTaskId(id);
  await taskRepo.deleteCommentsByTaskId(id);
  await taskRepo.deleteTaskById(id);
  logger.info('Task deleted', { task_id: id });
  return { message: 'Task deleted successfully.' };
}

export async function addTaskCommentService(taskId: string, userId: string, comment: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw new Error('Task not found.');
  const user = await taskRepo.findUserById(userId);
  if (!user) throw new Error('User not found.');

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
  // Emit event for task comment
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
  return createdComment;
}

export async function getTaskCommentsService(taskId: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw new Error('Task not found.');
  return taskRepo.listCommentsByTaskId(taskId);
}

export async function addTaskAttachmentService(taskId: string, file_path: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw new Error('Task not found.');
  if (!file_path || file_path.length > 255) throw new Error('file_path is required (max 255 characters).');

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
  // Emit event for task attachment
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
  return createdAttachment;
}

export async function deleteTaskAttachmentService(taskId: string, attachmentId: string) {
  const task = await taskRepo.findTaskById(taskId);
  if (!task) throw new Error('Task not found.');
  const row = await taskRepo.findTaskAttachmentById(attachmentId);
  if (!row || (row as { task_id: string }).task_id !== taskId) throw new Error('Attachment not found.');
  const deleted = await taskRepo.deleteTaskAttachment(taskId, attachmentId);
  if (deleted === 0) throw new Error('Attachment not found.');
  return { message: 'Attachment deleted successfully.' };
}
