import logger from '../../config/logger';
import crypto from 'crypto';
import { publishProjectEvent } from '../../utils/rabbitmq';
import { AppError } from '../../utils/errors';
import { mapProjectToApi } from './project.mapper';
import * as projectRepo from './project.repository';

export interface CreateProjectInput {
	name: string;
	description?: string;
	manager_id: string;
	organization_id: string;
	start_date: string;
	end_date: string;
}

export interface UpdateProjectInput {
	name?: string;
	description?: string;
	manager_id?: string;
	start_date?: string;
	end_date?: string;
}

export async function createProjectService(data: CreateProjectInput) {
	if (!data.name || data.name.length < 1 || data.name.length > 100) {
		throw AppError.badRequest('Project name must be between 1 and 100 characters.');
	}
	const org = await projectRepo.findOrganizationById(data.organization_id);
	if (!org) throw AppError.notFound('Organization not found.', 'ORG_NOT_FOUND');
	const manager = await projectRepo.findActiveUserById(data.manager_id);
	if (!manager) throw AppError.notFound('Manager (user) not found.', 'USER_NOT_FOUND');
	const start = new Date(data.start_date);
	const end = new Date(data.end_date);
	if (isNaN(start.getTime()) || isNaN(end.getTime())) {
		throw AppError.badRequest('Invalid start_date or end_date.');
	}
	if (end < start) throw AppError.badRequest('end_date must be on or after start_date.');

	const project_id = crypto.randomUUID();
	const now = new Date().toISOString();
	try {
		await projectRepo.insertProject({
			project_id,
			name: data.name,
			description: data.description ?? null,
			manager_id: data.manager_id,
			organization_id: data.organization_id,
			start_date: data.start_date,
			end_date: data.end_date,
			created_at: now,
			updated_at: now,
		});
	} catch (err) {
		const code = (err as { code?: string })?.code;
		if (code === '23503') {
			throw AppError.badRequest('Invalid manager_id or organization_id.', 'FK_VIOLATION');
		}
		throw err;
	}
	logger.info('Project created', { project_id, name: data.name });
	const created = await projectRepo.findProjectById(project_id);
	try {
		await publishProjectEvent({
			type: 'project:created',
			projectId: project_id,
			data: created,
		});
	} catch (err) {
		logger.error('Failed to publish project:created event', { error: err });
	}
	return mapProjectToApi(created);
}

export async function getAllProjectsService(opts: {
	page?: number;
	limit?: number;
	organization_id?: string;
}) {
	const page = opts.page ?? 1;
	const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
	const offset = (page - 1) * limit;
	if (!opts.organization_id) {
		throw AppError.badRequest('organization_id is required');
	}

	const totalRecords = await projectRepo.countProjectsByOrg(opts.organization_id);
	const totalPages = Math.ceil(totalRecords / limit) || 1;
	const rows = await projectRepo.listProjectsByOrg(opts.organization_id, limit, offset);
	return {
		meta: { page, limit, totalRecords, totalPages },
		data: rows.map((r) => mapProjectToApi(r)!),
	};
}

export async function getProjectByIdService(id: string) {
	const row = await projectRepo.findProjectById(id);
	return mapProjectToApi(row);
}

export async function updateProjectService(id: string, data: UpdateProjectInput) {
	const existing = await projectRepo.findProjectById(id);
	if (!existing) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');

	if (data.name !== undefined) {
		if (data.name.length < 1 || data.name.length > 100) {
			throw AppError.badRequest('Project name must be between 1 and 100 characters.');
		}
	}
	if (data.manager_id !== undefined) {
		const manager = await projectRepo.findActiveUserById(data.manager_id);
		if (!manager) throw AppError.notFound('Manager (user) not found.', 'USER_NOT_FOUND');
	}
	if (data.start_date !== undefined) {
		const d = new Date(data.start_date);
		if (isNaN(d.getTime())) throw AppError.badRequest('Invalid start_date.');
	}
	if (data.end_date !== undefined) {
		const d = new Date(data.end_date);
		if (isNaN(d.getTime())) throw AppError.badRequest('Invalid end_date.');
	}
	const start = data.start_date ? new Date(data.start_date) : new Date(String(existing.start_date));
	const end = data.end_date ? new Date(data.end_date) : new Date(String(existing.end_date));
	if (end < start) throw AppError.badRequest('end_date must be on or after start_date.');

	const allowed = ['name', 'description', 'manager_id', 'start_date', 'end_date'];
	const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
	for (const key of allowed) {
		if ((data as any)[key] !== undefined) updates[key] = (data as any)[key];
	}
	try {
		await projectRepo.updateProjectById(id, updates);
	} catch (err) {
		const code = (err as { code?: string })?.code;
		if (code === '23503') throw AppError.badRequest('Invalid manager_id.', 'FK_VIOLATION');
		throw err;
	}
	const updated = await projectRepo.findProjectById(id);
	try {
		await publishProjectEvent({
			type: 'project:updated',
			projectId: id,
			data: updated,
		});
	} catch (err) {
		logger.error('Failed to publish project:updated event', { error: err });
	}
	return mapProjectToApi(updated);
}

export async function deleteProjectService(
	id: string,
	actor?: { userId?: string; organizationId?: string }
) {
	const existing = await projectRepo.findProjectById(id);
	if (!existing) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
	const { withTransaction } = await import('../../utils/withTransaction');
	const { writeAuditLog } = await import('../../utils/audit');
	await withTransaction(async (client) => {
		await projectRepo.softDeleteProjectCascade(client, id, actor?.userId ?? null);
		await writeAuditLog(
			{
				entityType: 'project',
				entityId: id,
				action: 'soft_delete',
				actorUserId: actor?.userId,
				actorOrganizationId: actor?.organizationId,
			},
			client
		);
	});
	logger.info('Project soft-deleted', { project_id: id });
	return { message: 'Project deleted successfully.' };
}

export async function addProjectMemberService(projectId: string, userId: string, role?: string) {
	const project = await projectRepo.findProjectById(projectId);
	if (!project) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
	const user = await projectRepo.findActiveUserById(userId);
	if (!user) throw AppError.notFound('User not found.', 'USER_NOT_FOUND');
	if (await projectRepo.memberExists(projectId, userId)) {
		throw AppError.conflict('User is already a member of this project.');
	}

	const member_id = crypto.randomUUID();
	const now = new Date().toISOString();
	try {
		await projectRepo.insertProjectMember({
			member_id,
			project_id: projectId,
			user_id: userId,
			role: role ?? null,
			joined_at: now,
			created_at: now,
			updated_at: now,
		});
	} catch (err: any) {
		if (err?.code === '23505') {
			throw AppError.conflict('User is already a member of this project.');
		}
		throw err;
	}
	const row = await projectRepo.findProjectMemberById(member_id);
	try {
		await publishProjectEvent({
			type: 'project:member:added',
			userId,
			projectId,
			data: row,
		});
	} catch (err) {
		logger.error('Failed to publish project:member:added event', { error: err });
	}
	return row;
}

export async function removeProjectMemberService(projectId: string, userId: string) {
	const project = await projectRepo.findProjectById(projectId);
	if (!project) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
	const deleted = await projectRepo.deleteProjectMember(projectId, userId);
	if (!deleted) throw AppError.notFound('Project member not found.', 'MEMBER_NOT_FOUND');
	try {
		await publishProjectEvent({
			type: 'project:member:removed',
			userId,
			projectId,
			data: { userId, projectId },
		});
	} catch (err) {
		logger.error('Failed to publish project:member:removed event', { error: err });
	}
	return { message: 'Member removed from project successfully.' };
}

export async function listProjectMembersService(projectId: string) {
	const project = await projectRepo.findProjectById(projectId);
	if (!project) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
	const rows = await projectRepo.listProjectMembers(projectId);
	return rows.map((row) => ({
		userId: row.user_id,
		name: row.name,
		role: row.role,
	}));
}
