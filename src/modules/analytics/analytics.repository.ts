import pool from '../../config/db';

/** Tasks created in [start, end) UTC for org projects — simple productivity proxy (Postgres facts). */
export async function aggregateTaskMetricsByUser(params: {
	organizationId: string;
	start: Date;
	endExclusive: Date;
}): Promise<
	Array<{
		user_id: string;
		tasks_total: number;
		tasks_completed: number;
	}>
> {
	const r = await pool.query<{
		user_id: string;
		tasks_total: string;
		tasks_completed: string;
	}>(
		`
    SELECT
      t.assigned_to AS user_id,
      COUNT(*)::int AS tasks_total,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(t.status, '')) IN ('done', 'completed', 'closed')
          OR UPPER(COALESCE(t.status, '')) = 'COMPLETED'
      )::int AS tasks_completed
    FROM tasks t
    INNER JOIN projects p ON p.project_id = t.project_id
    WHERE p.organization_id = $1
      AND t.created_at >= $2
      AND t.created_at < $3
    GROUP BY t.assigned_to
    `,
		[params.organizationId, params.start, params.endExclusive]
	);
	return r.rows.map((row) => ({
		user_id: row.user_id,
		tasks_total: Number(row.tasks_total),
		tasks_completed: Number(row.tasks_completed),
	}));
}

/** Average goal progress per user in org (all goals; optional filter by window using updated_at). */
export async function aggregateGoalProgressByUser(params: {
	organizationId: string;
}): Promise<Array<{ user_id: string; avg_progress: number; goal_count: number }>> {
	const r = await pool.query<{ user_id: string; avg: string; cnt: string }>(
		`
    SELECT
      g.user_id,
      AVG(g.progress)::double precision AS avg,
      COUNT(*)::int AS cnt
    FROM goals g
    INNER JOIN users u ON u.user_id = g.user_id
    WHERE u.organization_id = $1
    GROUP BY g.user_id
    `,
		[params.organizationId]
	);
	return r.rows.map((row) => ({
		user_id: row.user_id,
		avg_progress: Number(row.avg) || 0,
		goal_count: parseInt(row.cnt, 10) || 0,
	}));
}

/** Org members with department labels for AI ranking cohorts. */
export async function listOrgUsersForRanking(organizationId: string): Promise<
	Array<{
		user_id: string;
		name: string | null;
		department_id: string | null;
		department_name: string | null;
	}>
> {
	const r = await pool.query<{
		user_id: string;
		name: string | null;
		department_id: string | null;
		department_name: string | null;
	}>(
		`
    SELECT
      u.user_id,
      u.name,
      u.department_id,
      d.name AS department_name
    FROM users u
    LEFT JOIN departments d
      ON d.department_id = u.department_id
      AND d.organization_id = u.organization_id
    WHERE u.organization_id = $1
    ORDER BY u.name NULLS LAST, u.user_id ASC
    `,
		[organizationId]
	);
	return r.rows;
}
