import pool from '../../config/db';

export interface ActivityRow {
  user_id: string;
  name: string | null;
  created_at: string;
  description: string | null;
  action: string;
  device_id: string | null;
}

export async function fetchActivitySegmentsInRange(params: {
  organizationId: string;
  userId?: string;
  start: Date;
  end: Date;
}): Promise<ActivityRow[]> {
  const { organizationId, userId, start, end } = params;
  const values: Array<string | Date> = [organizationId, start, end];
  let userClause = '';
  if (userId) {
    values.push(userId);
    userClause = ` AND al.user_id = $${values.length}`;
  }

  const result = await pool.query<ActivityRow>(
    `
    SELECT al.user_id, u.name, al.created_at, al.description, al.action, al.device_id::text
    FROM activity_logs al
    INNER JOIN users u ON u.user_id = al.user_id
    WHERE u.organization_id = $1
      AND al.created_at >= $2
      AND al.created_at < $3
      ${userClause}
    ORDER BY al.created_at ASC
    `,
    values
  );
  return result.rows;
}

export interface IdleAggRow {
  user_id: string;
  day: string;
  idle_seconds: string;
  name: string | null;
}

export async function fetchIdleAggregates(params: {
  organizationId: string;
  userId?: string;
  start: Date;
  end: Date;
}): Promise<IdleAggRow[]> {
  const { organizationId, userId, start, end } = params;
  const values: Array<string | Date> = [organizationId, start, end];
  let userClause = '';
  if (userId) {
    values.push(userId);
    userClause = ` AND il.user_id = $${values.length}`;
  }

  const result = await pool.query<IdleAggRow>(
    `
    SELECT
      il.user_id AS user_id,
      MAX(u.name)::text AS name,
      (DATE(il.timestamp AT TIME ZONE 'UTC'))::text AS day,
      SUM(il.idle_time)::bigint::text AS idle_seconds
    FROM idle_logs il
    INNER JOIN users u ON u.user_id = il.user_id
    WHERE u.organization_id = $1
      AND il.timestamp >= $2
      AND il.timestamp < $3
      ${userClause}
    GROUP BY il.user_id, DATE(il.timestamp AT TIME ZONE 'UTC')
    `,
    values
  );
  return result.rows;
}

export async function fetchActivitySegmentsForDay(params: {
  organizationId: string;
  userId: string;
  dayStart: Date;
  dayEnd: Date;
  limit: number;
  offset: number;
  hourStartUtc?: number;
  hourEndUtc?: number;
}): Promise<{ rows: ActivityRow[]; total: number }> {
  const { organizationId, userId, dayStart, dayEnd, limit, offset, hourStartUtc, hourEndUtc } = params;
  const baseValues: unknown[] = [organizationId, userId, dayStart, dayEnd];
  let hourClause = '';
  if (typeof hourStartUtc === 'number' && typeof hourEndUtc === 'number') {
    baseValues.push(hourStartUtc, hourEndUtc);
    hourClause = ` AND (EXTRACT(HOUR FROM (al.created_at AT TIME ZONE 'UTC'))::int) BETWEEN $5 AND $6`;
  }

  const countResult = await pool.query<{ cnt: string }>(
    `
    SELECT COUNT(*)::text AS cnt
    FROM activity_logs al
    INNER JOIN users u ON u.user_id = al.user_id
    WHERE u.organization_id = $1
      AND al.user_id = $2
      AND al.created_at >= $3
      AND al.created_at < $4
      ${hourClause}
    `,
    baseValues
  );
  const total = parseInt(countResult.rows[0]?.cnt || '0', 10);

  const limitIdx = baseValues.length + 1;
  const offsetIdx = baseValues.length + 2;
  const listValues = [...baseValues, limit, offset];

  const rows = await pool.query<ActivityRow>(
    `
    SELECT al.user_id, u.name, al.created_at, al.description, al.action, al.device_id::text
    FROM activity_logs al
    INNER JOIN users u ON u.user_id = al.user_id
    WHERE u.organization_id = $1
      AND al.user_id = $2
      AND al.created_at >= $3
      AND al.created_at < $4
      ${hourClause}
    ORDER BY al.created_at ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listValues
  );
  return { rows: rows.rows, total };
}

/** Latest activity row per user for a UTC calendar day (by max created_at). */
export async function fetchLatestActivityPerUserForDay(params: {
  organizationId: string;
  dayStart: Date;
  dayEnd: Date;
  userId?: string;
}): Promise<ActivityRow[]> {
  const values: unknown[] = [params.organizationId, params.dayStart, params.dayEnd];
  let userClause = '';
  if (params.userId) {
    values.push(params.userId);
    userClause = ` AND al.user_id = $${values.length}`;
  }

  const result = await pool.query<ActivityRow>(
    `
    WITH ranked AS (
      SELECT al.user_id, u.name, al.created_at, al.description, al.action, al.device_id::text,
        ROW_NUMBER() OVER (PARTITION BY al.user_id ORDER BY al.created_at DESC) AS rn
      FROM activity_logs al
      INNER JOIN users u ON u.user_id = al.user_id
      WHERE u.organization_id = $1
        AND al.created_at >= $2
        AND al.created_at < $3
        ${userClause}
    )
    SELECT user_id, name, created_at, description, action, device_id
    FROM ranked
    WHERE rn = 1
    ORDER BY user_id ASC
    `,
    values,
  );
  return result.rows;
}
