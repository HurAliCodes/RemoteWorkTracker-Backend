import crypto from 'crypto';
import pool from '../config/db';
import logger from '../config/logger';

/**
 * Attempt to claim a schedule window lock via unique (job_name, schedule_key).
 * Returns true if this instance owns the run; false if another instance already claimed it.
 */
export async function tryClaimJobRun(input: {
	jobName: string;
	scheduleKey: string;
	meta?: Record<string, unknown>;
}): Promise<{ claimed: boolean; runId?: string }> {
	const runId = crypto.randomUUID();
	try {
		await pool.query(
			`INSERT INTO job_runs (run_id, job_name, schedule_key, status, started_at, meta)
       VALUES ($1, $2, $3, 'running', NOW(), $4::jsonb)`,
			[runId, input.jobName, input.scheduleKey, JSON.stringify(input.meta ?? {})]
		);
		return { claimed: true, runId };
	} catch (err: unknown) {
		const code = (err as { code?: string })?.code;
		if (code === '23505') {
			logger.info('[job] schedule window already claimed', {
				jobName: input.jobName,
				scheduleKey: input.scheduleKey,
			});
			return { claimed: false };
		}
		throw err;
	}
}

export async function finishJobRun(
	runId: string,
	status: 'succeeded' | 'failed',
	meta?: Record<string, unknown>
) {
	await pool.query(
		`UPDATE job_runs
     SET status = $2, finished_at = NOW(), meta = COALESCE(meta, '{}'::jsonb) || $3::jsonb
     WHERE run_id = $1`,
		[runId, status, JSON.stringify(meta ?? {})]
	);
}

/** UTC calendar day key for daily schedules. */
export function utcDayScheduleKey(prefix = ''): string {
	const day = new Date().toISOString().slice(0, 10);
	return prefix ? `${prefix}:${day}` : day;
}

