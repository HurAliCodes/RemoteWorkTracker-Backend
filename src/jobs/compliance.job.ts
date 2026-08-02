import pool from '../config/db';
import logger from '../config/logger';
import { insertViolation } from '../modules/compliance/compliance.repository';

/** Daily scan: weekly hours vs compliance rules. */
export async function runComplianceScan() {
  logger.info('[cron] Starting compliance scan');
  const rules = await pool.query(
    `SELECT * FROM compliance_rules WHERE organization_id IS NOT NULL AND max_weekly_hours IS NOT NULL`
  );
  for (const rule of rules.rows) {
    const users = await pool.query(
      `SELECT user_id, region FROM users WHERE organization_id = $1`,
      [rule.organization_id]
    );
    for (const user of users.rows) {
      if (rule.region && user.region && user.region !== rule.region) continue;
      const hoursRes = await pool.query(
        `SELECT COALESCE(SUM(
           EXTRACT(EPOCH FROM (COALESCE(check_out, NOW()) - check_in)) / 3600.0
         ), 0) AS hours
         FROM attendance
         WHERE user_id = $1
           AND check_in >= date_trunc('week', NOW())`,
        [user.user_id]
      );
      const hours = Number(hoursRes.rows[0]?.hours ?? 0);
      const max = Number(rule.max_weekly_hours);
      if (!rule.overtime_allowed && hours > max) {
        await insertViolation({
          organizationId: rule.organization_id,
          userId: user.user_id,
          ruleId: rule.rule_id,
          description: `Exceeded weekly working hours (${hours.toFixed(1)} > ${max})`,
        });
      } else if (hours > max + (rule.overtime_allowed ? 10 : 0)) {
        await insertViolation({
          organizationId: rule.organization_id,
          userId: user.user_id,
          ruleId: rule.rule_id,
          description: `Exceeded weekly working hours (${hours.toFixed(1)} > ${max})`,
        });
      }
    }
  }
  logger.info('[cron] Compliance scan finished');
}
