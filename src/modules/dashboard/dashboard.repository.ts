import pool from '../../config/db';

export async function countUsersInOrganization(organizationId: string): Promise<number> {
	const r = await pool.query<{ c: string }>(
		`SELECT COUNT(*)::text AS c FROM users WHERE organization_id = $1`,
		[organizationId]
	);
	return parseInt(r.rows[0]?.c || '0', 10);
}

export async function countProjectsInOrganization(organizationId: string): Promise<number> {
	const r = await pool.query<{ c: string }>(
		`SELECT COUNT(*)::text AS c FROM projects WHERE organization_id = $1`,
		[organizationId]
	);
	return parseInt(r.rows[0]?.c || '0', 10);
}

export async function countTasksInOrganization(organizationId: string): Promise<{
	total: number;
	openLike: number;
}> {
	const r = await pool.query<{ total: string; open_like: string }>(
		`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(status, '')) NOT IN ('done', 'completed', 'closed', 'cancelled')
      )::text AS open_like
    FROM tasks t
    INNER JOIN projects p ON p.project_id = t.project_id
    WHERE p.organization_id = $1
    `,
		[organizationId]
	);
	const row = r.rows[0];
	return {
		total: parseInt(row?.total || '0', 10),
		openLike: parseInt(row?.open_like || '0', 10),
	};
}

export async function countUnreadNotificationsForUser(userId: string): Promise<number> {
	const r = await pool.query<{ c: string }>(
		`
    SELECT COUNT(*)::text AS c
    FROM notifications
    WHERE user_id = $1 AND (read IS NOT TRUE)
    `,
		[userId]
	);
	return parseInt(r.rows[0]?.c || '0', 10);
}
