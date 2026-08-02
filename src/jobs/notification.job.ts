import pool from '../config/db';
import logger from '../config/logger';
import { sendPushToUser } from '../services/fcm.service';
import { finishJobRun, tryClaimJobRun, utcDayScheduleKey } from './jobLock';

/** Weekday unread-notification digest push. */
export async function runNotificationDigestJob() {
	const scheduleKey = utcDayScheduleKey('notification_digest');
	const claim = await tryClaimJobRun({ jobName: 'notification_digest', scheduleKey });
	if (!claim.claimed || !claim.runId) return { skipped: true };

	try {
		const result = await pool.query(
			`SELECT user_id, COUNT(*)::int AS unread
       FROM notifications
       WHERE read = FALSE
       GROUP BY user_id
       HAVING COUNT(*) > 0`
		);
		let sent = 0;
		for (const row of result.rows) {
			await sendPushToUser(
				row.user_id,
				'Unread notifications',
				`You have ${row.unread} unread notification(s).`
			);
			sent += 1;
		}
		await finishJobRun(claim.runId, 'succeeded', { recipients: sent });
		logger.info('[cron] notification digest finished', { recipients: sent });
		return { skipped: false, recipients: sent };
	} catch (err) {
		await finishJobRun(claim.runId, 'failed', {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}
