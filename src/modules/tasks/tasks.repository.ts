import pool from '../../config/db';

export type TaskRow = Record<string, unknown>;
export type TaskCommentRow = Record<string, unknown>;
export type TaskAttachmentRow = Record<string, unknown>;

/** Lookups for service validation (existence checks) */
export async function findProjectById(projectId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query('SELECT * FROM projects WHERE project_id = $1 LIMIT 1', [projectId]);
  return result.rows[0] ?? null;
}

export async function findUserById(userId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query('SELECT * FROM users WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0] ?? null;
}

export async function insertTask(row: {
  task_id: string;
  project_id: string;
  assigned_to: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO tasks (
      task_id, project_id, assigned_to, title, description, status, priority, deadline, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      row.task_id,
      row.project_id,
      row.assigned_to,
      row.title,
      row.description,
      row.status,
      row.priority,
      row.deadline,
      row.created_at,
      row.updated_at,
    ]
  );
}

export async function findTaskById(taskId: string): Promise<TaskRow | null> {
  const result = await pool.query('SELECT * FROM tasks WHERE task_id = $1 LIMIT 1', [taskId]);
  return result.rows[0] ?? null;
}

export async function countTasks(projectId?: string): Promise<number> {
  const hasProject = projectId && projectId.length > 0;
  const query = hasProject
    ? 'SELECT COUNT(*) FROM tasks t WHERE t.project_id = $1'
    : 'SELECT COUNT(*) FROM tasks t';
  const params = hasProject ? [projectId] : [];
  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count as string, 10);
}

export async function listTasksPaginated(opts: {
  projectId?: string;
  limit: number;
  offset: number;
}): Promise<TaskRow[]> {
  const hasProject = opts.projectId && opts.projectId.length > 0;
  const whereClause = hasProject ? 'WHERE t.project_id = $1' : '';
  const listParams = hasProject
    ? [opts.projectId, opts.limit, opts.offset]
    : [opts.limit, opts.offset];
  const listPlaceholders = hasProject ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2';

  const listQuery = `
    SELECT t.task_id, t.project_id, t.assigned_to, t.title, t.description, t.status, t.priority, t.deadline, t.created_at, t.updated_at
    FROM tasks t
    ${whereClause}
    ORDER BY t.created_at DESC
    ${listPlaceholders}
  `;
  const listResult = await pool.query(listQuery, listParams);
  return listResult.rows;
}

export async function updateTaskById(taskId: string, updates: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map((k) => updates[k]);
  await pool.query(`UPDATE tasks SET ${setClause} WHERE task_id = $${values.length + 1}`, [...values, taskId]);
}

export async function deleteAttachmentsByTaskId(taskId: string): Promise<void> {
  await pool.query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
}

export async function deleteCommentsByTaskId(taskId: string): Promise<void> {
  await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
}

export async function deleteTaskById(taskId: string): Promise<number> {
  const result = await pool.query('DELETE FROM tasks WHERE task_id = $1', [taskId]);
  return result.rowCount ?? 0;
}

export async function insertTaskComment(row: {
  comment_id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO task_comments (comment_id, task_id, user_id, comment, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [row.comment_id, row.task_id, row.user_id, row.comment, row.created_at, row.updated_at]
  );
}

export async function findTaskCommentById(commentId: string): Promise<TaskCommentRow | null> {
  const result = await pool.query('SELECT * FROM task_comments WHERE comment_id = $1 LIMIT 1', [commentId]);
  return result.rows[0] ?? null;
}

export async function listCommentsByTaskId(taskId: string): Promise<TaskCommentRow[]> {
  const result = await pool.query(
    'SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC',
    [taskId]
  );
  return result.rows;
}

export async function insertTaskAttachment(row: {
  attachment_id: string;
  task_id: string;
  file_path: string;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO task_attachments (attachment_id, task_id, file_path, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [row.attachment_id, row.task_id, row.file_path, row.created_at, row.updated_at]
  );
}

export async function findTaskAttachmentById(attachmentId: string): Promise<TaskAttachmentRow | null> {
  const result = await pool.query('SELECT * FROM task_attachments WHERE attachment_id = $1 LIMIT 1', [
    attachmentId,
  ]);
  return result.rows[0] ?? null;
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string): Promise<number> {
  const result = await pool.query(
    'DELETE FROM task_attachments WHERE attachment_id = $1 AND task_id = $2',
    [attachmentId, taskId]
  );
  return result.rowCount ?? 0;
}
