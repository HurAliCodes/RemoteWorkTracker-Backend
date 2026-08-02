import crypto from 'crypto';
import pool from '../config/db';
import logger from '../config/logger';
import { ENV } from '../config/env';
import { getAiEmployeeSnapshotFromTelemetry } from '../modules/attendance/attendance.repository';
import {
	baselineHistoryFromAiWeeklyPayload,
	generatePortalAiReportFromTelemetry,
} from '../modules/analytics/analytics.service';
import { fetchWeeklyReports, isAiIntegrationConfigured } from '../modules/ai/ai.service';
import { publishAiEvent } from '../utils/rabbitmq';
import { finishJobRun, tryClaimJobRun, utcDayScheduleKey } from './jobLock';

type OrgUserRow = { user_id: string; organization_id: string };

async function listActiveOrgUsers(): Promise<OrgUserRow[]> {
	const result = await pool.query(
		`SELECT user_id, organization_id
     FROM users
     WHERE deleted_at IS NULL
       AND organization_id IS NOT NULL
     ORDER BY organization_id, user_id`
	);
	return result.rows as OrgUserRow[];
}

async function upsertAiSyncState(input: {
	organizationId: string;
	userId: string;
	status: string;
	sourceFreshnessAt?: Date | null;
	lastError?: string | null;
	lastReportMeta?: Record<string, unknown> | null;
}) {
	await pool.query(
		`INSERT INTO ai_sync_state (
       organization_id, user_id, last_synced_at, source_freshness_at, last_status, last_error, last_report_meta, updated_at
     ) VALUES ($1, $2, NOW(), $3, $4, $5, $6::jsonb, NOW())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET
       last_synced_at = EXCLUDED.last_synced_at,
       source_freshness_at = COALESCE(EXCLUDED.source_freshness_at, ai_sync_state.source_freshness_at),
       last_status = EXCLUDED.last_status,
       last_error = EXCLUDED.last_error,
       last_report_meta = COALESCE(EXCLUDED.last_report_meta, ai_sync_state.last_report_meta),
       updated_at = NOW()`,
		[
			input.organizationId,
			input.userId,
			input.sourceFreshnessAt ?? null,
			input.status,
			input.lastError ?? null,
			JSON.stringify(input.lastReportMeta ?? {}),
		]
	);
}

/**
 * Durable org-wide analytics fan-out:
 * build telemetry snapshots and enqueue (or sync-generate) AI reports.
 * Prefers queue when RabbitMQ is configured; otherwise generates inline.
 */
export async function runAnalyticsJob(opts: { useQueue?: boolean } = {}) {
	const scheduleKey = utcDayScheduleKey('analytics');
	const claim = await tryClaimJobRun({
		jobName: 'analytics',
		scheduleKey,
		meta: { useQueue: Boolean(opts.useQueue ?? ENV.RABBITMQ_URL) },
	});
	if (!claim.claimed || !claim.runId) return { skipped: true };

	const useQueue = opts.useQueue ?? Boolean(ENV.RABBITMQ_URL);
	let enqueued = 0;
	let generated = 0;
	let failed = 0;
	let skippedNoSnapshot = 0;

	try {
		if (!isAiIntegrationConfigured()) {
			await finishJobRun(claim.runId, 'failed', { reason: 'ai_not_configured' });
			logger.warn('[cron] analytics job skipped: AI not configured');
			return { skipped: true, reason: 'ai_not_configured' };
		}

		const users = await listActiveOrgUsers();
		logger.info('[cron] analytics job started', { users: users.length, useQueue });

		for (const user of users) {
			try {
				const snapshot = await getAiEmployeeSnapshotFromTelemetry(user.user_id);
				if (!snapshot) {
					skippedNoSnapshot += 1;
					await upsertAiSyncState({
						organizationId: user.organization_id,
						userId: user.user_id,
						status: 'no_snapshot',
					});
					continue;
				}

				const requestId = crypto.randomUUID();
				if (useQueue) {
					let history: Array<{
						date: string;
						productivityScore: number;
						workingHours: number;
						idleHours: number;
					}> = [];
					try {
						const weekly = await fetchWeeklyReports({
							tenantId: snapshot.tenantId,
							employeeId: snapshot.employeeId,
							limit: 14,
							requestId: `${requestId}-hist`,
						});
						history = baselineHistoryFromAiWeeklyPayload(weekly.data);
					} catch {
						history = [];
					}

					await publishAiEvent({
						type: 'ai:report:generate',
						tenantId: snapshot.tenantId,
						requestId,
						data: { ...snapshot, history },
					});
					enqueued += 1;
					await upsertAiSyncState({
						organizationId: user.organization_id,
						userId: user.user_id,
						status: 'enqueued',
						sourceFreshnessAt: new Date(),
						lastReportMeta: { requestId, mode: 'queue' },
					});
				} else {
					const result = await generatePortalAiReportFromTelemetry(
						user.organization_id,
						user.user_id
					);
					generated += 1;
					const report = (result.data || {}) as Record<string, unknown>;
					await upsertAiSyncState({
						organizationId: user.organization_id,
						userId: user.user_id,
						status: 'generated',
						sourceFreshnessAt: new Date(),
						lastReportMeta: {
							requestId,
							mode: 'sync',
							scoring_mode: report.scoring_mode,
							confidence: report.confidence,
							rule_engine_version: report.rule_engine_version,
							burnout_risk: report.burnout_risk,
							productivity_score: report.productivity_score,
						},
					});
				}
			} catch (err) {
				failed += 1;
				await upsertAiSyncState({
					organizationId: user.organization_id,
					userId: user.user_id,
					status: 'failed',
					lastError: err instanceof Error ? err.message : String(err),
				});
				logger.warn('[cron] analytics fan-out failed for user', {
					userId: user.user_id,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		await finishJobRun(claim.runId, 'succeeded', {
			enqueued,
			generated,
			failed,
			skippedNoSnapshot,
			users: users.length,
		});
		logger.info('[cron] analytics job finished', { enqueued, generated, failed, skippedNoSnapshot });
		return { skipped: false, enqueued, generated, failed, skippedNoSnapshot };
	} catch (err) {
		await finishJobRun(claim.runId, 'failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
