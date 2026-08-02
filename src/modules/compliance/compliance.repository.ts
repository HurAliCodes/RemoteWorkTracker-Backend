import crypto from 'crypto';
import pool from '../../config/db';

export async function createRule(data: {
  organizationId: string;
  region: string;
  maxWeeklyHours: number;
  overtimeAllowed: boolean;
  minBreakHours: number;
  description?: string;
}) {
  const ruleId = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO compliance_rules
      (rule_id, organization_id, region, max_weekly_hours, overtime_allowed, min_break_hours, description, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      ruleId,
      data.organizationId,
      data.region,
      data.maxWeeklyHours,
      data.overtimeAllowed,
      data.minBreakHours,
      data.description ?? `Rule for ${data.region}`,
      now,
      now,
    ]
  );
  return result.rows[0];
}

export async function listRules(organizationId: string, opts: { region?: string; page: number; limit: number }) {
  const conditions = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  if (opts.region) {
    params.push(opts.region);
    conditions.push(`region = $${params.length}`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*) FROM compliance_rules ${where}`, params);
  const totalRecords = parseInt(count.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / opts.limit) || 1;
  const offset = (opts.page - 1) * opts.limit;
  params.push(opts.limit, offset);
  const rows = await pool.query(
    `SELECT * FROM compliance_rules ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows: rows.rows, totalRecords, totalPages, page: opts.page, limit: opts.limit };
}

export async function findRule(ruleId: string, organizationId: string) {
  const result = await pool.query(
    'SELECT * FROM compliance_rules WHERE rule_id = $1 AND organization_id = $2',
    [ruleId, organizationId]
  );
  return result.rows[0] || null;
}

export async function updateRule(ruleId: string, organizationId: string, updates: Record<string, unknown>) {
  const keys = Object.keys(updates);
  if (!keys.length) return findRule(ruleId, organizationId);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map((k) => updates[k]);
  await pool.query(
    `UPDATE compliance_rules SET ${setClause}, updated_at = NOW()
     WHERE rule_id = $${values.length + 1} AND organization_id = $${values.length + 2}`,
    [...values, ruleId, organizationId]
  );
  return findRule(ruleId, organizationId);
}

export async function deleteRule(ruleId: string, organizationId: string) {
  const result = await pool.query(
    'DELETE FROM compliance_rules WHERE rule_id = $1 AND organization_id = $2 RETURNING rule_id',
    [ruleId, organizationId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listViolations(
  organizationId: string,
  opts: {
    userId?: string;
    region?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }
) {
  const conditions = ['v.organization_id = $1'];
  const params: unknown[] = [organizationId];
  if (opts.userId) {
    params.push(opts.userId);
    conditions.push(`v.user_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    conditions.push(`v.status = $${params.length}`);
  }
  if (opts.region) {
    params.push(opts.region);
    conditions.push(
      `EXISTS (SELECT 1 FROM users u WHERE u.user_id = v.user_id AND u.region = $${params.length})`
    );
  }
  if (opts.startDate) {
    params.push(opts.startDate);
    conditions.push(`v.created_at >= $${params.length}::date`);
  }
  if (opts.endDate) {
    params.push(opts.endDate);
    conditions.push(`v.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await pool.query(`SELECT COUNT(*) FROM compliance_violations v ${where}`, params);
  const totalRecords = parseInt(count.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / opts.limit) || 1;
  const offset = (opts.page - 1) * opts.limit;
  params.push(opts.limit, offset);
  const rows = await pool.query(
    `SELECT v.* FROM compliance_violations v ${where}
     ORDER BY v.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { rows: rows.rows, totalRecords, totalPages, page: opts.page, limit: opts.limit };
}

export async function resolveViolation(violationId: string, organizationId: string) {
  const result = await pool.query(
    `UPDATE compliance_violations
     SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW()
     WHERE violation_id = $1 AND organization_id = $2
     RETURNING *`,
    [violationId, organizationId]
  );
  return result.rows[0] || null;
}

export async function insertViolation(data: {
  organizationId: string;
  userId: string;
  ruleId: string;
  description: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO compliance_violations
      (violation_id, organization_id, user_id, rule_id, description, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7)`,
    [id, data.organizationId, data.userId, data.ruleId, data.description, now, now]
  );
  return id;
}

export async function acknowledgeRule(userId: string, ruleId: string, signatureData: string) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO compliance_acknowledgements (ack_id, user_id, rule_id, signature_data, signed_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (user_id, rule_id) DO UPDATE SET signature_data = EXCLUDED.signature_data, signed_at = NOW()
     RETURNING *`,
    [id, userId, ruleId, signatureData]
  );
}
