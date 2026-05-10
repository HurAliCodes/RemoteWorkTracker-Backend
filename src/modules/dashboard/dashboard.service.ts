import { getDailyTelemetry } from '../telemetry/telemetry.service';
import {
	countProjectsInOrganization,
	countTasksInOrganization,
	countUnreadNotificationsForUser,
	countUsersInOrganization,
} from './dashboard.repository';
import type { DashboardSummaryQuery } from './dashboard.validation';

function utcTodayYMD(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Inclusive period ending today: `days` calendar days in UTC. */
export function periodDatesUtc(days: number): { startDate: string; endDate: string } {
	const endDate = utcTodayYMD();
	const end = new Date(`${endDate}T12:00:00.000Z`);
	end.setUTCDate(end.getUTCDate() - (days - 1));
	const startDate = end.toISOString().slice(0, 10);
	return { startDate, endDate };
}

export async function getDashboardSummary(
	organizationId: string,
	q: DashboardSummaryQuery,
	options?: { viewerUserId?: string }
) {
	const days = q.days ?? 7;
	const { startDate, endDate } = periodDatesUtc(days);

	const [
		telemetryBundle,
		memberCount,
		projectCount,
		taskCounts,
	] = await Promise.all([
		getDailyTelemetry(organizationId, {
			startDate,
			endDate,
			page: 1,
			limit: 100_000,
		}),
		countUsersInOrganization(organizationId),
		countProjectsInOrganization(organizationId),
		countTasksInOrganization(organizationId),
	]);

	const rows = telemetryBundle.data;

	let totalActiveSeconds = 0;
	let totalIdleSeconds = 0;
	let totalSegments = 0;
	const usersWithTelemetry = new Set<string>();

	for (const r of rows) {
		totalActiveSeconds += r.activeSeconds;
		totalIdleSeconds += r.idleSeconds;
		totalSegments += r.segmentCount;
		if (r.activeSeconds > 0 || r.idleSeconds > 0 || r.segmentCount > 0) {
			usersWithTelemetry.add(r.userId);
		}
	}

	let viewer: {
		userId: string;
		activeSeconds: number;
		idleSeconds: number;
		segmentCount: number;
		personDaysWithData: number;
	} | undefined;

	const viewerId = options?.viewerUserId;
	if (viewerId) {
		let a = 0;
		let i = 0;
		let s = 0;
		let pd = 0;
		for (const r of rows) {
			if (r.userId !== viewerId) continue;
			a += r.activeSeconds;
			i += r.idleSeconds;
			s += r.segmentCount;
			if (r.activeSeconds > 0 || r.idleSeconds > 0 || r.segmentCount > 0) pd += 1;
		}
		viewer = {
			userId: viewerId,
			activeSeconds: a,
			idleSeconds: i,
			segmentCount: s,
			personDaysWithData: pd,
		};
	}

	let unreadNotifications: number | undefined;
	if (viewerId) {
		unreadNotifications = await countUnreadNotificationsForUser(viewerId);
	}

	const coverageRatio =
		memberCount > 0
			? Math.round((usersWithTelemetry.size / memberCount) * 1000) / 1000
			: 0;

	return {
		organizationId,
		period: {
			days,
			startDate,
			endDate,
			timezoneNote: 'Dates are UTC calendar days (aligned with agent telemetry).',
		},
		people: {
			members: memberCount,
			withAgentDataInPeriod: usersWithTelemetry.size,
		},
		telemetry: {
			personDayRows: telemetryBundle.meta.totalRecords,
			totalActiveSeconds,
			totalIdleSeconds,
			totalSegments,
			coverageRatio,
		},
		work: {
			projects: projectCount,
			tasks: {
				total: taskCounts.total,
				openOrActive: taskCounts.openLike,
			},
		},
		...(viewer ? { me: viewer } : {}),
		...(typeof unreadNotifications === 'number' ? { unreadNotifications } : {}),
	};
}
