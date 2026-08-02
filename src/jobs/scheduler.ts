import cron from 'node-cron';
import logger from '../config/logger';
import { ENV } from '../config/env';
import { runComplianceScan } from './compliance.job';
import { runAnalyticsJob } from './analytics.job';
import { runBurnoutJob } from './burnout.job';
import { runNotificationDigestJob } from './notification.job';
import { finishJobRun, tryClaimJobRun, utcDayScheduleKey } from './jobLock';

export function startScheduledJobs() {
	// Daily 02:00 — compliance scan
	cron.schedule('0 2 * * *', async () => {
		const claim = await tryClaimJobRun({
			jobName: 'compliance',
			scheduleKey: utcDayScheduleKey('compliance'),
		});
		if (!claim.claimed || !claim.runId) return;
		try {
			await runComplianceScan();
			await finishJobRun(claim.runId, 'succeeded');
		} catch (err) {
			await finishJobRun(claim.runId, 'failed', {
				error: err instanceof Error ? err.message : String(err),
			});
			logger.error('[cron] compliance scan failed', { error: err });
		}
	});

	// Configurable analytics fan-out (default 03:15 UTC)
	cron.schedule(ENV.ANALYTICS_CRON, async () => {
		try {
			await runAnalyticsJob();
		} catch (err) {
			logger.error('[cron] analytics job failed', { error: err });
		}
	});

	// Configurable burnout alerts (default 03:30 UTC)
	cron.schedule(ENV.BURNOUT_CRON, async () => {
		try {
			await runBurnoutJob();
		} catch (err) {
			logger.error('[cron] burnout job failed', { error: err });
		}
	});

	// Weekdays 09:00 — unread notification digest reminder
	cron.schedule('0 9 * * 1-5', async () => {
		try {
			await runNotificationDigestJob();
		} catch (err) {
			logger.error('[cron] notification digest failed', { error: err });
		}
	});

	logger.info('Scheduled jobs registered', {
		analyticsCron: ENV.ANALYTICS_CRON,
		burnoutCron: ENV.BURNOUT_CRON,
		jobs: ['compliance', 'analytics', 'burnout', 'notification_digest'],
	});
}
