import pool from '../config/db';
import logger from '../config/logger';
import { createNotificationWithPush } from '../services/fcm.service';
import { fetchWeeklyReports, isAiIntegrationConfigured } from '../modules/ai/ai.service';
import { finishJobRun, tryClaimJobRun, utcDayScheduleKey } from './jobLock';

const HIGH_BURNOUT = new Set(['High Risk', 'Critical Risk', 'high', 'High']);

type SyncRow = {
	organization_id: string;
	user_id: string;
	last_report_meta: Record<string, unknown> | null;
};

async function listRecentSyncedUsers(): Promise<SyncRow[]> {
	const result = await pool.query(
		`SELECT organization_id, user_id, last_report_meta
     FROM ai_sync_state
     WHERE last_status IN ('generated', 'enqueued', 'ok')
       AND last_synced_at > NOW() - INTERVAL '48 hours'`
	);
	return result.rows as SyncRow[];
}

async function findOrgManagers(organizationId: string): Promise<string[]> {
	const result = await pool.query(
		`SELECT u.user_id
     FROM users u
     JOIN roles r ON r.role_id = u.role_id
     WHERE u.organization_id = $1
       AND u.deleted_at IS NULL
       AND (
         LOWER(TRIM(r.name)) = 'manager'
         OR LOWER(TRIM(r.name)) LIKE '%manager%'
         OR LOWER(TRIM(r.name)) IN ('admin', 'super_admin')
       )`,
		[organizationId]
	);
	return result.rows.map((r) => String(r.user_id));
}

async function alreadyAlertedToday(userId: string, type: string): Promise<boolean> {
	const result = await pool.query(
		`SELECT 1 FROM notifications
     WHERE user_id = $1
       AND type = $2
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
     LIMIT 1`,
		[userId, type]
	);
	return result.rows.length > 0;
}

function burnoutFromMetaOrReport(
	meta: Record<string, unknown> | null,
	report: Record<string, unknown> | null
): string | null {
	const fromMeta = meta?.burnout_risk;
	if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
	const fromReport = report?.burnout_risk;
	if (typeof fromReport === 'string' && fromReport) return fromReport;
	return null;
}

/**
 * Evaluate latest AI reports / sync meta for burnout and send deduplicated alerts.
 */
export async function runBurnoutJob() {
	const scheduleKey = utcDayScheduleKey('burnout');
	const claim = await tryClaimJobRun({ jobName: 'burnout', scheduleKey });
	if (!claim.claimed || !claim.runId) return { skipped: true };

	let evaluated = 0;
	let alerted = 0;
	let skipped = 0;

	try {
		if (!isAiIntegrationConfigured()) {
			await finishJobRun(claim.runId, 'failed', { reason: 'ai_not_configured' });
			return { skipped: true, reason: 'ai_not_configured' };
		}

		const rows = await listRecentSyncedUsers();
		logger.info('[cron] burnout job started', { candidates: rows.length });

		for (const row of rows) {
			evaluated += 1;
			let burnout: string | null = burnoutFromMetaOrReport(row.last_report_meta, null);
			let report: Record<string, unknown> | null = null;

			if (!burnout) {
				try {
					const weekly = await fetchWeeklyReports({
						tenantId: row.organization_id,
						employeeId: row.user_id,
						limit: 1,
						requestId: `burnout-${row.user_id}-${Date.now()}`,
					});
					const data = weekly.data as Record<string, unknown>;
					const latest =
						data.latest_report && typeof data.latest_report === 'object'
							? (data.latest_report as Record<string, unknown>)
							: null;
					report = latest;
					burnout = burnoutFromMetaOrReport(row.last_report_meta, latest);
				} catch (err) {
					logger.warn('[cron] burnout fetch failed', {
						userId: row.user_id,
						error: err instanceof Error ? err.message : String(err),
					});
					continue;
				}
			}

			if (!burnout || !HIGH_BURNOUT.has(burnout)) {
				skipped += 1;
				continue;
			}

			const employeeType = 'burnout_alert_employee';
			const managerType = 'burnout_alert_manager';

			if (!(await alreadyAlertedToday(row.user_id, employeeType))) {
				await createNotificationWithPush({
					userId: row.user_id,
					type: employeeType,
					title: 'Burnout risk alert',
					message: `Your latest analytics report indicates ${burnout}. Consider adjusting workload and rest.`,
				});
				alerted += 1;
			}

			const managers = await findOrgManagers(row.organization_id);
			for (const managerId of managers) {
				if (managerId === row.user_id) continue;
				if (await alreadyAlertedToday(managerId, `${managerType}:${row.user_id}`)) continue;
				// Deduplicate per manager+employee pair via typed notification key
				const dedupeType = `${managerType}:${row.user_id}`;
				const existing = await pool.query(
					`SELECT 1 FROM notifications
           WHERE user_id = $1 AND type = $2
             AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
           LIMIT 1`,
					[managerId, dedupeType]
				);
				if (existing.rows.length > 0) continue;

				await createNotificationWithPush({
					userId: managerId,
					type: dedupeType,
					title: 'Team burnout alert',
					message: `Employee ${row.user_id} has ${burnout} on the latest analytics report.`,
				});
				alerted += 1;
			}

			await pool.query(
				`UPDATE ai_sync_state
         SET last_report_meta = COALESCE(last_report_meta, '{}'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE organization_id = $1 AND user_id = $2`,
				[
					row.organization_id,
					row.user_id,
					JSON.stringify({
						burnout_risk: burnout,
						burnout_alerted_at: new Date().toISOString(),
						confidence: report?.confidence,
						scoring_mode: report?.scoring_mode,
					}),
				]
			);
		}

		await finishJobRun(claim.runId, 'succeeded', { evaluated, alerted, skipped });
		logger.info('[cron] burnout job finished', { evaluated, alerted, skipped });
		return { skipped: false, evaluated, alerted };
	} catch (err) {
		await finishJobRun(claim.runId, 'failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
