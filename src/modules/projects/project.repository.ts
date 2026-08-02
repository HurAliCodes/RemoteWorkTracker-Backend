import pool from '../../config/db';
import type { PoolClient } from 'pg';

export type ProjectRow = Record<string, unknown>;

export async function findOrganizationById(organizationId: string) {
	const result = await pool.query(
		`SELECT organization_id FROM organizations WHERE organization_id = $1 LIMIT 1`,
		[organizationId]
	);
	return result.rows[0] ?? null;
}

export async function findActiveUserById(userId: string) {
	const result = await pool.query(
		`SELECT user_id FROM users WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
		[userId]
	);
	return result.rows[0] ?? null;
}

export async function insertProject(row: {
	project_id: string;
	name: string;
	description: string | null;
	manager_id: string;
	organization_id: string;
	start_date: string;
	end_date: string;
	created_at: string;
	updated_at: string;
}) {
	await pool.query(
		`INSERT INTO projects (
      project_id, name, description, manager_id, organization_id, start_date, end_date, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		[
			row.project_id,
			row.name,
			row.description,
			row.manager_id,
			row.organization_id,
			row.start_date,
			row.end_date,
			row.created_at,
			row.updated_at,
		]
	);
}

export async function countProjectsByOrg(organizationId: string): Promise<number> {
	const result = await pool.query(
		`SELECT COUNT(*)::int AS count FROM projects p
     WHERE p.organization_id = $1 AND p.deleted_at IS NULL`,
		[organizationId]
	);
	return Number(result.rows[0]?.count ?? 0);
}

export async function listProjectsByOrg(organizationId: string, limit: number, offset: number) {
	const result = await pool.query(
		`SELECT p.project_id, p.name, p.description, p.manager_id, p.organization_id,
            p.start_date, p.end_date, p.created_at, p.updated_at
     FROM projects p
     WHERE p.organization_id = $1 AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
		[organizationId, limit, offset]
	);
	return result.rows as ProjectRow[];
}

export async function findProjectById(id: string): Promise<ProjectRow | null> {
	const result = await pool.query(
		`SELECT * FROM projects WHERE project_id = $1 AND deleted_at IS NULL LIMIT 1`,
		[id]
	);
	return result.rows[0] ?? null;
}

export async function updateProjectById(id: string, updates: Record<string, unknown>) {
	const keys = Object.keys(updates);
	if (!keys.length) return;
	const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
	const values = keys.map((k) => updates[k]);
	await pool.query(
		`UPDATE projects SET ${setClause}
     WHERE project_id = $${values.length + 1} AND deleted_at IS NULL`,
		[...values, id]
	);
}

export async function softDeleteProjectCascade(
	client: PoolClient,
	projectId: string,
	actorUserId?: string | null
) {
	await client.query(
		`UPDATE tasks
     SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
     WHERE project_id = $1 AND deleted_at IS NULL`,
		[projectId, actorUserId ?? null]
	);
	await client.query(
		`UPDATE projects
     SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
     WHERE project_id = $1 AND deleted_at IS NULL`,
		[projectId, actorUserId ?? null]
	);
}

export async function memberExists(projectId: string, userId: string) {
	const result = await pool.query(
		`SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
		[projectId, userId]
	);
	return (result.rowCount ?? 0) > 0;
}

export async function insertProjectMember(row: {
	member_id: string;
	project_id: string;
	user_id: string;
	role: string | null;
	joined_at: string;
	created_at: string;
	updated_at: string;
}) {
	await pool.query(
		`INSERT INTO project_members
      (member_id, project_id, user_id, role, joined_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		[
			row.member_id,
			row.project_id,
			row.user_id,
			row.role,
			row.joined_at,
			row.created_at,
			row.updated_at,
		]
	);
}

export async function findProjectMemberById(memberId: string) {
	const result = await pool.query(`SELECT * FROM project_members WHERE member_id = $1 LIMIT 1`, [
		memberId,
	]);
	return result.rows[0] ?? null;
}

export async function deleteProjectMember(projectId: string, userId: string) {
	const result = await pool.query(
		`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING member_id`,
		[projectId, userId]
	);
	return result.rowCount ?? 0;
}

export async function listProjectMembers(projectId: string) {
	const result = await pool.query(
		`SELECT pm.user_id, u.name, pm.role
     FROM project_members pm
     INNER JOIN users u ON u.user_id = pm.user_id AND u.deleted_at IS NULL
     WHERE pm.project_id = $1
     ORDER BY u.name ASC NULLS LAST`,
		[projectId]
	);
	return result.rows as Array<{ user_id: string; name: string | null; role: string | null }>;
}
