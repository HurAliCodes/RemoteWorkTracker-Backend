import crypto from 'crypto';
import { getDb } from '../../config/db';
import pool from '../../config/db';
import logger from '../../config/logger';

const db = getDb();

export interface CreateGoalInput {
  title: string;
  userId: string;
  description?: string;
  deadline: string;
}

export interface UpdateGoalInput {
  title?: string;
  userId?: string;
  description?: string;
  deadline?: string;
}

const getGoalStatus = (progress: number) => (progress >= 50 ? 'ON_TRACK' : 'AT_RISK');

const mapGoalRow = (row: any) => ({
  goalId: row.goal_id,
  title: row.title,
  userId: row.user_id,
  description: row.description,
  progress: Number(row.progress ?? 0),
  deadline: row.deadline,
  status: getGoalStatus(Number(row.progress ?? 0)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function createGoalService(input: CreateGoalInput) {
  const user = await db.findOne('users', { user_id: input.userId });
  if (!user) throw new Error('User not found.');

  const goalId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert('goals', {
    goal_id: goalId,
    user_id: input.userId,
    title: input.title,
    description: input.description ?? null,
    progress: 0,
    deadline: input.deadline,
    created_at: now,
    updated_at: now,
  });

  const created = await db.findOne('goals', { goal_id: goalId });
  logger.info('Goal created', { goal_id: goalId, user_id: input.userId });
  return mapGoalRow(created);
}

export async function getAllGoalsService(opts: {
  page?: number;
  limit?: number;
  userId?: string;
  status?: 'ON_TRACK' | 'AT_RISK';
  organizationId?: string;
}) {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const offset = (page - 1) * limit;

  const whereParts: string[] = [];
  const params: unknown[] = [];

  const fromSql =
    opts.organizationId != null && opts.organizationId !== ''
      ? 'FROM goals g INNER JOIN users u ON u.user_id = g.user_id'
      : 'FROM goals g';

  if (opts.organizationId != null && opts.organizationId !== '') {
    params.push(opts.organizationId);
    whereParts.push(`u.organization_id = $${params.length}`);
  }

  if (opts.userId) {
    params.push(opts.userId);
    whereParts.push(`g.user_id = $${params.length}`);
  }

  if (opts.status === 'ON_TRACK') {
    whereParts.push('g.progress >= 50');
  } else if (opts.status === 'AT_RISK') {
    whereParts.push('g.progress < 50');
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*)::int AS count ${fromSql} ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listParams = [...params, limit, offset];
  const listQuery = `
    SELECT g.goal_id, g.title, g.user_id, g.description, g.progress, g.deadline, g.created_at, g.updated_at
    ${fromSql}
    ${whereClause}
    ORDER BY g.created_at DESC
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
  `;

  const listResult = await pool.query(listQuery, listParams);
  const data = listResult.rows.map(mapGoalRow);

  return {
    meta: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
    data,
  };
}

export async function getGoalByIdService(goalId: string) {
  const goal = await db.findOne('goals', { goal_id: goalId });
  if (!goal) return null;
  return mapGoalRow(goal);
}

export async function updateGoalService(goalId: string, input: UpdateGoalInput) {
  const existing = await db.findOne('goals', { goal_id: goalId });
  if (!existing) throw new Error('Goal not found.');

  if (input.userId) {
    const user = await db.findOne('users', { user_id: input.userId });
    if (!user) throw new Error('User not found.');
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) updates.title = input.title;
  if (input.userId !== undefined) updates.user_id = input.userId;
  if (input.description !== undefined) updates.description = input.description;
  if (input.deadline !== undefined) updates.deadline = input.deadline;

  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

  await pool.query(`UPDATE goals SET ${setClause} WHERE goal_id = $${values.length + 1}`, [...values, goalId]);

  const updated = await db.findOne('goals', { goal_id: goalId });
  return mapGoalRow(updated);
}

export async function deleteGoalService(goalId: string) {
  const existing = await db.findOne('goals', { goal_id: goalId });
  if (!existing) throw new Error('Goal not found.');

  await pool.query('DELETE FROM kpis WHERE goal_id = $1', [goalId]);
  await pool.query('DELETE FROM goals WHERE goal_id = $1', [goalId]);
  logger.info('Goal deleted', { goal_id: goalId });

  return { message: 'Goal deleted successfully' };
}

export async function updateGoalProgressService(goalId: string, progress: number) {
  const existing = await db.findOne('goals', { goal_id: goalId });
  if (!existing) throw new Error('Goal not found.');

  const result = await pool.query(
    `
      UPDATE goals
      SET progress = $1, updated_at = NOW()
      WHERE goal_id = $2
      RETURNING goal_id, title, user_id, description, progress, deadline, created_at, updated_at
    `,
    [progress, goalId]
  );

  if (!result.rowCount) throw new Error('Goal not found.');
  return mapGoalRow(result.rows[0]);
}
