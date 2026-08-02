import type { TaskRow, TaskCommentRow, TaskAttachmentRow } from './tasks.repository';

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

/** Canonical camelCase task DTO (+ snake aliases for transitional clients). */
export function mapTaskToApi(row: TaskRow | null) {
	if (!row) return null;
	const deadline = normalizeDeadlineValue(row.deadline);
	const taskId = String(row.task_id ?? '');
	const projectId = String(row.project_id ?? '');
	const assignedTo = String(row.assigned_to ?? '');
	return {
		taskId,
		projectId,
		assignedTo,
		title: row.title ?? null,
		description: row.description ?? null,
		status: row.status ?? null,
		priority: row.priority ?? null,
		deadline,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		// transitional snake_case aliases (web dual-reads)
		task_id: taskId,
		project_id: projectId,
		assigned_to: assignedTo,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}

export function mapTaskCommentToApi(row: TaskCommentRow) {
	return {
		commentId: row.comment_id,
		taskId: row.task_id,
		userId: row.user_id,
		comment: row.comment,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		comment_id: row.comment_id,
		task_id: row.task_id,
		user_id: row.user_id,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

export function mapTaskAttachmentToApi(row: TaskAttachmentRow) {
	return {
		attachmentId: row.attachment_id,
		taskId: row.task_id,
		filePath: row.file_path,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		attachment_id: row.attachment_id,
		task_id: row.task_id,
		file_path: row.file_path,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}
