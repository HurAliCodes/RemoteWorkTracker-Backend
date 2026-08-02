import crypto from 'crypto';
import pool from '../../config/db';
import logger from '../../config/logger';

export interface PayrollRow {
  payroll_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  amount: string;
  created_at: string;
  updated_at: string;
  // joined fields
  user_name?: string;
  basic_salary?: string;
  overtime?: string;
  bonus?: string;
  deductions?: string;
}

const toMonth = (periodStart: string): string => {
  // period_start is a DATE like "2026-03-01" – return "2026-03"
  return String(periodStart).slice(0, 7);
};

const mapPayrollRow = (row: PayrollRow) => {
  const basicSalary = Number(row.basic_salary ?? 0);
  const overtime = Number(row.overtime ?? 0);
  const bonus = Number(row.bonus ?? 0);
  const deductions = Number(row.deductions ?? 0);
  const netPay = Number(row.amount ?? basicSalary + overtime + bonus - deductions);

  return {
    payrollId: row.payroll_id,
    userId: row.user_id,
    employeeName: row.user_name ?? null,
    month: toMonth(row.period_start),
    basicSalary,
    overtime,
    bonus,
    deductions,
    netPay,
    generatedAt: row.created_at,
  };
};

/** Parse "YYYY-MM" into first and last day of that month */
const parseMonthBounds = (month: string): { periodStart: string; periodEnd: string } => {
  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, mon - 1, 1));
  const lastDay = new Date(Date.UTC(year, mon, 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { periodStart: fmt(firstDay), periodEnd: fmt(lastDay) };
};


export const generatePayrollService = async (month: string, organizationId: string) => {
  const { periodStart, periodEnd } = parseMonthBounds(month);

  const usersResult = await pool.query(
    `SELECT user_id, name, salary FROM users WHERE organization_id = $1`,
    [organizationId],
  );
  const users = usersResult.rows;

  if (users.length === 0) {
    return { month, generatedAt: new Date().toISOString(), entriesGenerated: 0 };
  }

  const now = new Date().toISOString();
  let generatedCount = 0;

  const { withTransaction } = await import('../../utils/withTransaction');
  await withTransaction(async (client) => {
    for (const user of users) {
      const salary = Number(user.salary ?? 0);
      const payrollId = crypto.randomUUID();

      const insertPayroll = await client.query(
        `INSERT INTO payroll (payroll_id, user_id, period_start, period_end, amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, period_start, period_end) DO NOTHING
         RETURNING payroll_id`,
        [payrollId, user.user_id, periodStart, periodEnd, salary, now, now],
      );

      if ((insertPayroll.rowCount ?? 0) === 0) {
        continue;
      }

      const entryId = crypto.randomUUID();
      await client.query(
        `INSERT INTO payroll_entries (entry_id, payroll_id, description, amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entryId, payrollId, 'basicSalary', salary, now, now],
      );

      generatedCount++;
    }
  });

  logger.info('Payroll generated', { month, organizationId, entriesGenerated: generatedCount });

  return {
    month,
    generatedAt: now,
    entriesGenerated: generatedCount,
  };
};

export const listPayrollService = async (opts: {
  userId?: string;
  month?: string;
  page?: number;
  limit?: number;
  organizationId: string;
}) => {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions: string[] = [`u.organization_id = $1`];
  const params: any[] = [opts.organizationId];

  if (opts.userId) {
    params.push(opts.userId);
    conditions.push(`p.user_id = $${params.length}`);
  }

  if (opts.month) {
    const { periodStart, periodEnd } = parseMonthBounds(opts.month);
    params.push(periodStart);
    conditions.push(`p.period_start = $${params.length}`);
    params.push(periodEnd);
    conditions.push(`p.period_end = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM payroll p
     INNER JOIN users u ON u.user_id = p.user_id
     ${whereClause}`,
    params,
  );
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listParams = [...params, limit, offset];
  const listResult = await pool.query<PayrollRow>(
    `SELECT p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at,
            u.name AS user_name,
            SUM(CASE WHEN pe.description = 'basicSalary' THEN pe.amount ELSE 0 END) AS basic_salary,
            SUM(CASE WHEN pe.description = 'overtime'    THEN pe.amount ELSE 0 END) AS overtime,
            SUM(CASE WHEN pe.description = 'bonus'       THEN pe.amount ELSE 0 END) AS bonus,
            SUM(CASE WHEN pe.description = 'deductions'  THEN pe.amount ELSE 0 END) AS deductions
     FROM payroll p
     INNER JOIN users u ON u.user_id = p.user_id
     LEFT JOIN payroll_entries pe ON pe.payroll_id = p.payroll_id
     ${whereClause}
     GROUP BY p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at, u.name
     ORDER BY p.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  return {
    meta: { page, limit, totalRecords, totalPages },
    data: listResult.rows.map(mapPayrollRow),
  };
};

export const getPayrollByIdService = async (payrollId: string) => {
  const result = await pool.query<PayrollRow>(
    `SELECT p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at,
            u.name AS user_name,
            SUM(CASE WHEN pe.description = 'basicSalary' THEN pe.amount ELSE 0 END) AS basic_salary,
            SUM(CASE WHEN pe.description = 'overtime'    THEN pe.amount ELSE 0 END) AS overtime,
            SUM(CASE WHEN pe.description = 'bonus'       THEN pe.amount ELSE 0 END) AS bonus,
            SUM(CASE WHEN pe.description = 'deductions'  THEN pe.amount ELSE 0 END) AS deductions
     FROM payroll p
     LEFT JOIN users u ON u.user_id = p.user_id
     LEFT JOIN payroll_entries pe ON pe.payroll_id = p.payroll_id
     WHERE p.payroll_id = $1
     GROUP BY p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at, u.name`,
    [payrollId],
  );

  if (!result.rows[0]) return null;
  return mapPayrollRow(result.rows[0]);
};

export const getUserPayrollService = async (
  userId: string,
  opts: { month?: string; page?: number; limit?: number },
) => {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions: string[] = [`p.user_id = $1`];
  const params: any[] = [userId];

  if (opts.month) {
    const { periodStart, periodEnd } = parseMonthBounds(opts.month);
    params.push(periodStart);
    conditions.push(`p.period_start = $${params.length}`);
    params.push(periodEnd);
    conditions.push(`p.period_end = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM payroll p ${whereClause}`,
    params,
  );
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listParams = [...params, limit, offset];
  const listResult = await pool.query<PayrollRow>(
    `SELECT p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at,
            u.name AS user_name,
            SUM(CASE WHEN pe.description = 'basicSalary' THEN pe.amount ELSE 0 END) AS basic_salary,
            SUM(CASE WHEN pe.description = 'overtime'    THEN pe.amount ELSE 0 END) AS overtime,
            SUM(CASE WHEN pe.description = 'bonus'       THEN pe.amount ELSE 0 END) AS bonus,
            SUM(CASE WHEN pe.description = 'deductions'  THEN pe.amount ELSE 0 END) AS deductions
     FROM payroll p
     LEFT JOIN users u ON u.user_id = p.user_id
     LEFT JOIN payroll_entries pe ON pe.payroll_id = p.payroll_id
     ${whereClause}
     GROUP BY p.payroll_id, p.user_id, p.period_start, p.period_end, p.amount, p.created_at, p.updated_at, u.name
     ORDER BY p.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  return {
    meta: { page, limit, totalRecords, totalPages },
    data: listResult.rows.map(mapPayrollRow),
  };
};
