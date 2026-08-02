import type { ProjectRow } from './project.repository';

export function mapProjectToApi(row: ProjectRow | null) {
	if (!row) return null;
	const projectId = String(row.project_id ?? '');
	const managerId = String(row.manager_id ?? '');
	const organizationId = String(row.organization_id ?? '');
	return {
		projectId,
		name: row.name ?? null,
		description: row.description ?? null,
		managerId,
		organizationId,
		startDate: row.start_date ?? null,
		endDate: row.end_date ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		// transitional snake aliases
		project_id: projectId,
		manager_id: managerId,
		organization_id: organizationId,
		start_date: row.start_date ?? null,
		end_date: row.end_date ?? null,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}
