import crypto from 'crypto';
import pool from '../../config/db';

function periodBounds(period: string): { start: string; end: string } {
  const [yearStr, qStr] = period.split('-Q');
  const year = Number(yearStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { start: fmt(start), end: fmt(end) };
}

async function scoreAttendance(userId: string, start: string, end: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS days
     FROM attendance
     WHERE user_id = $1 AND check_in::date BETWEEN $2::date AND $3::date`,
    [userId, start, end]
  );
  const days = result.rows[0]?.days ?? 0;
  return Math.min(100, Math.round((days / 60) * 100));
}

async function scoreTasks(userId: string, start: string, end: string): Promise<number> {
  const total = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tasks
     WHERE assigned_to = $1 AND created_at::date BETWEEN $2::date AND $3::date`,
    [userId, start, end]
  );
  const done = await pool.query(
    `SELECT COUNT(*)::int AS c FROM tasks
     WHERE assigned_to = $1
       AND LOWER(COALESCE(status,'')) IN ('done','completed','complete')
       AND created_at::date BETWEEN $2::date AND $3::date`,
    [userId, start, end]
  );
  const t = total.rows[0]?.c ?? 0;
  if (t === 0) return 70;
  return Math.round(((done.rows[0]?.c ?? 0) / t) * 100);
}

async function scoreGoals(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(AVG(COALESCE(progress, 0)), 70) AS avg FROM goals WHERE user_id = $1`,
    [userId]
  );
  return Math.round(Number(result.rows[0]?.avg ?? 70));
}

async function scoreWellness(userId: string, start: string, end: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(AVG(COALESCE(mood, energy, 3)), 3) AS avg
     FROM wellness_logs
     WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date`,
    [userId, start, end]
  ).catch(async () =>
    pool.query(
      `SELECT COALESCE(AVG(3), 3) AS avg`
    )
  );
  const avg = Number(result.rows[0]?.avg ?? 3);
  return Math.min(100, Math.round((avg / 5) * 100));
}

export async function generatePerformanceReview(opts: {
  organizationId: string;
  userId: string;
  period: string;
  reviewerId?: string;
}) {
  const user = await pool.query(
    'SELECT user_id FROM users WHERE user_id = $1 AND organization_id = $2',
    [opts.userId, opts.organizationId]
  );
  if (!user.rows[0]) throw new Error('User not found in organization');

  const existing = await pool.query(
    'SELECT * FROM performance_reviews WHERE user_id = $1 AND period = $2',
    [opts.userId, opts.period]
  );
  if (existing.rows[0]) throw new Error('Review already exists for this user/period');

  const { start, end } = periodBounds(opts.period);
  const attendanceScore = await scoreAttendance(opts.userId, start, end);
  const taskCompletionScore = await scoreTasks(opts.userId, start, end);
  const goalProgressScore = await scoreGoals(opts.userId);
  const wellnessScore = await scoreWellness(opts.userId, start, end);
  const overallScore =
    attendanceScore * 0.25 +
    taskCompletionScore * 0.35 +
    goalProgressScore * 0.3 +
    wellnessScore * 0.1;

  const reviewId = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO performance_reviews (
      review_id, user_id, reviewer_id, organization_id, period,
      attendance_score, task_completion_score, goal_progress_score, wellness_score,
      overall_score, score, status, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'DRAFT',$11,$11)
    RETURNING *`,
    [
      reviewId,
      opts.userId,
      opts.reviewerId ?? null,
      opts.organizationId,
      opts.period,
      attendanceScore,
      taskCompletionScore,
      goalProgressScore,
      wellnessScore,
      Number(overallScore.toFixed(2)),
      now,
    ]
  );
  return result.rows[0];
}

export async function listPerformanceReviews(
  organizationId: string,
  opts: { userId?: string; period?: string; status?: string; page: number; limit: number }
) {
  const conditions = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  if (opts.userId) {
    params.push(opts.userId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (opts.period) {
    params.push(opts.period);
    conditions.push(`period = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*) FROM performance_reviews ${where}`, params);
  const totalRecords = parseInt(count.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / opts.limit) || 1;
  const offset = (opts.page - 1) * opts.limit;
  params.push(opts.limit, offset);
  const rows = await pool.query(
    `SELECT * FROM performance_reviews ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows: rows.rows, totalRecords, totalPages, page: opts.page, limit: opts.limit };
}

export async function getPerformanceReview(reviewId: string, organizationId: string) {
  const result = await pool.query(
    'SELECT * FROM performance_reviews WHERE review_id = $1 AND organization_id = $2',
    [reviewId, organizationId]
  );
  return result.rows[0] || null;
}

export async function finalizePerformanceReview(
  reviewId: string,
  organizationId: string,
  opts: { comments?: string; signatureData?: string }
) {
  const result = await pool.query(
    `UPDATE performance_reviews
     SET status = 'FINALIZED',
         finalized_at = NOW(),
         comments = COALESCE($3, comments),
         signature_data = COALESCE($4, signature_data),
         signed_at = CASE WHEN $4 IS NOT NULL THEN NOW() ELSE signed_at END,
         updated_at = NOW()
     WHERE review_id = $1 AND organization_id = $2 AND status = 'DRAFT'
     RETURNING *`,
    [reviewId, organizationId, opts.comments ?? null, opts.signatureData ?? null]
  );
  return result.rows[0] || null;
}

export function mapReview(row: any) {
  return {
    reviewId: row.review_id,
    userId: row.user_id,
    reviewerId: row.reviewer_id,
    period: row.period,
    attendanceScore: Number(row.attendance_score ?? 0),
    taskCompletionScore: Number(row.task_completion_score ?? 0),
    goalProgressScore: Number(row.goal_progress_score ?? 0),
    wellnessScore: Number(row.wellness_score ?? 0),
    overallScore: Number(row.overall_score ?? row.score ?? 0),
    status: row.status,
    comments: row.comments,
    generatedAt: row.created_at,
    finalizedAt: row.finalized_at,
    signedAt: row.signed_at,
    hasSignature: Boolean(row.signature_data),
  };
}
