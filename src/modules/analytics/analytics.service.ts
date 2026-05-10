import crypto from 'node:crypto';
import {
	fetchWeeklyReports,
	generateAnalyticsReport,
	isAiIntegrationConfigured,
	AiServiceError,
	runPerformanceRanking,
	type PerformanceRankingEmployeePayload,
} from '../ai/ai.service';
import { getAiEmployeeSnapshotFromTelemetry } from '../attendance/attendance.repository';
import { getDashboardSummary, periodDatesUtc } from '../dashboard/dashboard.service';
import { getDailyTelemetry } from '../telemetry/telemetry.service';
import {
	aggregateGoalProgressByUser,
	aggregateTaskMetricsByUser,
	listOrgUsersForRanking,
} from './analytics.repository';
import type { AnalyticsDateRangeQuery, AnalyticsOverviewQuery } from './analytics.validation';

type SelectedEmployeeDesk = {
	employeeId: string;
	totalActiveSeconds: number;
	totalIdleSeconds: number;
	totalSegments: number;
	personDaysWithData: number;
};

function utcTodayYMD(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Inclusive calendar dates → UTC half-open interval for SQL. */
export function toUtcHalfOpenRange(startDate: string, endDate: string): { start: Date; endExclusive: Date } {
	const start = new Date(`${startDate}T00:00:00.000Z`);
	const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
	endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
	return { start, endExclusive };
}

function defaultDateRange(): { startDate: string; endDate: string } {
	const endDate = utcTodayYMD();
	const start = new Date(`${endDate}T12:00:00.000Z`);
	start.setUTCDate(start.getUTCDate() - 29);
	const startDate = start.toISOString().slice(0, 10);
	return { startDate, endDate };
}

function inclusiveCalendarDays(startDate: string, endDate: string): number {
	const a = new Date(`${startDate}T12:00:00.000Z`).getTime();
	const b = new Date(`${endDate}T12:00:00.000Z`).getTime();
	return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export async function getAnalyticsOverview(
	organizationId: string,
	q: AnalyticsOverviewQuery,
	options?: { viewerUserId?: string }
) {
	const days = q.days ?? 7;

	const dashboardSummary = await getDashboardSummary(organizationId, { days }, {
		viewerUserId: options?.viewerUserId,
	});

	const { startDate, endDate } = periodDatesUtc(days);

	let selectedEmployeeDesk: SelectedEmployeeDesk | undefined;

	if (q.employeeId) {
		const tel = await getDailyTelemetry(organizationId, {
			startDate,
			endDate,
			userId: q.employeeId,
			page: 1,
			limit: 100_000,
		});
		let totalActiveSeconds = 0;
		let totalIdleSeconds = 0;
		let totalSegments = 0;
		let personDaysWithData = 0;
		for (const row of tel.data) {
			totalActiveSeconds += row.activeSeconds;
			totalIdleSeconds += row.idleSeconds;
			totalSegments += row.segmentCount;
			if (row.activeSeconds > 0 || row.idleSeconds > 0 || row.segmentCount > 0) {
				personDaysWithData += 1;
			}
		}
		selectedEmployeeDesk = {
			employeeId: q.employeeId,
			totalActiveSeconds,
			totalIdleSeconds,
			totalSegments,
			personDaysWithData,
		};
	}

	const aiInsights: {
		kind: 'ai_interpretation';
		displayName: string;
		explanation: string;
		source: string;
		available: boolean;
		employeeId: string | null;
		traceId?: string;
		data: Record<string, unknown> | null;
		unavailableReason: string | null;
	} = {
		kind: 'ai_interpretation',
		displayName: 'AI productivity assessment',
		explanation:
			'Interpretation from the analytics microservice (rules / optional ML). This is not the same as raw desk seconds.',
		source: 'ai-server',
		available: false,
		employeeId: q.employeeId ?? null,
		data: null,
		unavailableReason: null,
	};

	if (!q.employeeId) {
		aiInsights.unavailableReason =
			'Pass employeeId (UUID) to load AI weekly reports for that person.';
	} else if (!isAiIntegrationConfigured()) {
		aiInsights.unavailableReason =
			'AI integration is not configured on the portal backend (set AI_SERVER_BASE_URL and credentials).';
	} else {
		try {
			const requestId = crypto.randomUUID();
			const result = await fetchWeeklyReports({
				tenantId: organizationId,
				employeeId: q.employeeId,
				limit: q.aiReportLimit ?? 7,
				requestId,
			});
			aiInsights.available = true;
			aiInsights.data = result.data as Record<string, unknown>;
			if (result.traceId) aiInsights.traceId = result.traceId;
			aiInsights.unavailableReason = null;
		} catch (e: unknown) {
			if (e instanceof AiServiceError) {
				aiInsights.unavailableReason = e.message;
				if (e.traceId) aiInsights.traceId = e.traceId;
			} else {
				aiInsights.unavailableReason = e instanceof Error ? e.message : 'AI request failed.';
			}
		}
	}

	return {
		facts: {
			kind: 'telemetry_facts',
			displayName: 'Team desk activity',
			explanation:
				'Factual rollups from the desktop agent (activity_logs, idle_logs). Distinct from AI interpretation.',
			source: 'postgres:telemetry_rollups',
			period: dashboardSummary.period,
			people: dashboardSummary.people,
			telemetry: dashboardSummary.telemetry,
			work: dashboardSummary.work,
			viewerDesk: dashboardSummary.me,
			unreadNotifications: dashboardSummary.unreadNotifications,
			selectedEmployeeDesk,
		},
		aiInsights,
	};
}

export async function getProductivityAnalytics(organizationId: string, q: AnalyticsDateRangeQuery) {
	const range =
		q.startDate && q.endDate
			? { startDate: q.startDate, endDate: q.endDate }
			: defaultDateRange();
	const { start, endExclusive } = toUtcHalfOpenRange(range.startDate, range.endDate);

	const rows = await aggregateTaskMetricsByUser({
		organizationId,
		start,
		endExclusive,
	});

	const data = rows.map((row) => {
		const total = row.tasks_total;
		const completed = row.tasks_completed;
		const rate = total > 0 ? completed / total : 0;
		return {
			userId: row.user_id,
			tasksCompleted: completed,
			averageTaskCompletionTime: 0,
			productivityScore: Math.round(rate * 100),
		};
	});

	return {
		meta: {
			startDate: range.startDate,
			endDate: range.endDate,
			totalEmployees: data.length,
			note: 'Productivity score is a simple completion ratio for tasks created in the window (Postgres facts).',
		},
		data,
	};
}

export async function getTeamPerformanceAnalytics(organizationId: string, q: AnalyticsDateRangeQuery) {
	const range =
		q.startDate && q.endDate
			? { startDate: q.startDate, endDate: q.endDate }
			: defaultDateRange();
	const { start, endExclusive } = toUtcHalfOpenRange(range.startDate, range.endDate);

	const [taskRows, goalRows] = await Promise.all([
		aggregateTaskMetricsByUser({ organizationId, start, endExclusive }),
		aggregateGoalProgressByUser({ organizationId }),
	]);

	const goalByUser = new Map(goalRows.map((g) => [g.user_id, g]));

	const data = taskRows.map((row) => {
		const assigned = row.tasks_total;
		const completed = row.tasks_completed;
		const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
		const productivityLike = completionRate;
		const goals = goalByUser.get(row.user_id);
		const goalProgress = goals ? Math.round(goals.avg_progress) : 0;
		return {
			userId: row.user_id,
			tasksAssigned: assigned,
			tasksCompleted: completed,
			completionRate,
			/** Proxy until attendance scoring is wired; aligned with task completion for now. */
			attendanceScore: Math.min(100, productivityLike),
			goalProgress,
		};
	});

	return {
		meta: {
			teamId: undefined,
			period: `${range.startDate} to ${range.endDate}`,
			note: 'Blended from tasks (window) and goals (current org snapshot). attendanceScore is a placeholder aligned to completion rate.',
		},
		data,
	};
}

/**
 * Build per-employee pillars from Postgres, then call the AI microservice for weighted + RF ranking.
 * Pillars: productivity (blend), task completion, attendance (telemetry days / period), efficiency (active ratio), collaboration (goals).
 */
export async function getAiPerformanceRanking(organizationId: string, q: AnalyticsDateRangeQuery) {
	if (!isAiIntegrationConfigured()) {
		throw new AiServiceError('AI integration is not configured on the portal backend.', 503);
	}
	const range =
		q.startDate && q.endDate
			? { startDate: q.startDate, endDate: q.endDate }
			: defaultDateRange();
	const { start, endExclusive } = toUtcHalfOpenRange(range.startDate, range.endDate);
	const periodDays = inclusiveCalendarDays(range.startDate, range.endDate);

	const [users, taskRows, goalRows, telemetryPage] = await Promise.all([
		listOrgUsersForRanking(organizationId),
		aggregateTaskMetricsByUser({ organizationId, start, endExclusive }),
		aggregateGoalProgressByUser({ organizationId }),
		getDailyTelemetry(organizationId, {
			startDate: range.startDate,
			endDate: range.endDate,
			page: 1,
			limit: 100_000,
		}),
	]);

	if (users.length === 0) {
		throw new AiServiceError('No employees in organization for ranking.', 400);
	}

	const taskByUser = new Map(taskRows.map((row) => [row.user_id, row]));
	const goalByUser = new Map(goalRows.map((g) => [g.user_id, g]));

	type TelAgg = { active: number; idle: number; segments: number; days: Set<string> };
	const telByUser = new Map<string, TelAgg>();
	for (const row of telemetryPage.data) {
		const cur = telByUser.get(row.userId) ?? { active: 0, idle: 0, segments: 0, days: new Set<string>() };
		cur.active += row.activeSeconds;
		cur.idle += row.idleSeconds;
		cur.segments += row.segmentCount;
		cur.days.add(row.day);
		telByUser.set(row.userId, cur);
	}

	const employees: PerformanceRankingEmployeePayload[] = users.map((u) => {
		const tr = taskByUser.get(u.user_id);
		const assigned = tr?.tasks_total ?? 0;
		const completed = tr?.tasks_completed ?? 0;
		const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
		const goals = goalByUser.get(u.user_id);
		const goalProgress = goals ? Math.round(goals.avg_progress) : 0;
		const productivity = Math.min(100, Math.round(0.55 * completionRate + 0.45 * goalProgress));
		const task_completion = completionRate;
		const tel = telByUser.get(u.user_id);
		const personDays = tel ? tel.days.size : 0;
		const attendance = Math.min(100, Math.round((personDays / periodDays) * 100));
		const active = tel?.active ?? 0;
		const idle = tel?.idle ?? 0;
		const efficiency = active + idle > 0 ? Math.round((active / (active + idle)) * 100) : 0;
		const collaboration = goalProgress;

		return {
			employee_id: u.user_id,
			display_name: u.name,
			department_id: u.department_id,
			department_name: u.department_name,
			productivity,
			task_completion,
			attendance,
			efficiency,
			collaboration,
		};
	});

	const requestId = crypto.randomUUID();
	const result = await runPerformanceRanking({
		tenantId: organizationId,
		employees,
		requestId,
	});

	return {
		meta: {
			period: `${range.startDate} to ${range.endDate}`,
			periodDays,
			employeeCount: users.length,
			source: 'postgres_facts_via_ai_ranking',
			aiMeta: result.meta ?? null,
		},
		inputSummary: {
			note: 'Pillars are 0–100: productivity blends task completion + goals; attendance uses agent person-days / period; efficiency is active/(active+idle); collaboration uses goal progress.',
		},
		data: result.data as Record<string, unknown>,
		traceId: result.traceId,
	};
}

export type AiBaselineHistoryPoint = {
	date: string;
	productivityScore: number;
	workingHours: number;
	idleHours: number;
};

/** Map AI server weekly-reports `data.history` rows into analytics report baseline points. */
export function baselineHistoryFromAiWeeklyPayload(data: unknown): AiBaselineHistoryPoint[] {
	if (!data || typeof data !== 'object') return [];
	const d = data as Record<string, unknown>;
	const hist = d.history;
	if (!Array.isArray(hist)) return [];
	const out: AiBaselineHistoryPoint[] = [];
	for (const item of hist) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const createdRaw = row.created_at;
		const date =
			typeof createdRaw === 'string' && createdRaw.length >= 10
				? createdRaw.slice(0, 10)
				: utcTodayYMD();
		const prod = Number(row.productivity_score ?? 0);
		out.push({ date, productivityScore: prod, workingHours: 8, idleHours: 1 });
	}
	return out;
}

/** GET proxy: load stored AI reports for an employee (same org as caller). */
export async function getPortalAiWeeklyReports(organizationId: string, employeeId: string, limit: number) {
	if (!isAiIntegrationConfigured()) {
		throw new AiServiceError('AI integration is not configured on the portal backend.', 503);
	}
	const requestId = crypto.randomUUID();
	const result = await fetchWeeklyReports({
		tenantId: organizationId,
		employeeId,
		limit,
		requestId,
	});
	return { data: result.data as Record<string, unknown>, traceId: result.traceId };
}

/**
 * Build snapshot from telemetry + tasks (Postgres), attach prior report productivity as `history`,
 * then call the AI analytics microservice. Does not accept a raw report body from the client.
 */
export async function generatePortalAiReportFromTelemetry(organizationId: string, employeeId: string) {
	if (!isAiIntegrationConfigured()) {
		throw new AiServiceError('AI integration is not configured on the portal backend.', 503);
	}
	const snapshot = await getAiEmployeeSnapshotFromTelemetry(employeeId);
	if (!snapshot) {
		throw new AiServiceError('Employee not found or could not build telemetry snapshot.', 404);
	}
	if (snapshot.tenantId !== organizationId) {
		throw new AiServiceError('Employee does not belong to this organization.', 403);
	}

	const requestId = crypto.randomUUID();
	const weekly = await fetchWeeklyReports({
		tenantId: organizationId,
		employeeId,
		limit: 14,
		requestId,
	});
	const history = baselineHistoryFromAiWeeklyPayload(weekly.data);

	const reportInput = {
		...snapshot,
		history,
		requestId: crypto.randomUUID(),
	};
	return generateAnalyticsReport(reportInput);
}
