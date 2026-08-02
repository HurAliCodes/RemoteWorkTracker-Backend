import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import { AiServiceError } from '../ai/ai.service';
import { success, error } from '../../utils/response';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
	generatePortalAiReportFromTelemetry,
	getAiPerformanceRanking,
	getAnalyticsOverview,
	getPortalAiWeeklyReports,
	getProductivityAnalytics,
	getTeamPerformanceAnalytics,
} from './analytics.service';
import {
	aiWeeklyReportsQuerySchema,
	analyticsDateRangeQuerySchema,
	analyticsOverviewQuerySchema,
	generateAiReportBodySchema,
} from './analytics.validation';

function filterSeriesToSelf(
	payload: { meta?: unknown; data?: Array<{ userId?: string }> },
	userId?: string
) {
	if (!userId || !Array.isArray(payload?.data)) return payload;
	return {
		...payload,
		data: payload.data.filter((row) => row.userId === userId),
		meta: {
			...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
			selfScoped: true,
		},
	};
}

export async function getAnalyticsOverviewController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = analyticsOverviewQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const q = parsed.data;
		if (q.organizationId && q.organizationId !== organizationId) {
			return error(res, 'Forbidden', 403);
		}

		const viewerUserId =
			typeof req.user?.userId === 'string' && req.user.userId.trim()
				? req.user.userId.trim()
				: undefined;

		const payload = await getAnalyticsOverview(organizationId, q, { viewerUserId });
		return success(res, payload, 'Analytics overview');
	} catch (err) {
		if (err instanceof AiServiceError) {
			return res.status(err.statusCode).json({
				success: false,
				message: err.message,
				errorCode: err.errorCode,
				traceId: err.traceId,
				meta: err.meta,
			});
		}
		return error(res, 'Failed to load analytics overview', 500, err);
	}
}

export async function getProductivityAnalyticsController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = analyticsDateRangeQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const q = parsed.data;
		if (q.organizationId && q.organizationId !== organizationId) {
			return error(res, 'Forbidden', 403);
		}

		const payload = await getProductivityAnalytics(organizationId, q);
		const privileged = await isManagerOrAdmin(req);
		const scoped = privileged
			? payload
			: filterSeriesToSelf(payload, req.user?.userId);
		return success(res, scoped, 'Productivity analytics (task-based facts)');
	} catch (err) {
		return error(res, 'Failed to load productivity analytics', 500, err);
	}
}

export async function getTeamPerformanceAnalyticsController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = analyticsDateRangeQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const q = parsed.data;
		if (q.organizationId && q.organizationId !== organizationId) {
			return error(res, 'Forbidden', 403);
		}

		const payload = await getTeamPerformanceAnalytics(organizationId, q);
		const privileged = await isManagerOrAdmin(req);
		const scoped = privileged
			? payload
			: filterSeriesToSelf(payload, req.user?.userId);
		return success(res, scoped, 'Team performance analytics');
	} catch (err) {
		return error(res, 'Failed to load team performance analytics', 500, err);
	}
}

export async function getAiPerformanceRankingController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = analyticsDateRangeQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const q = parsed.data;
		if (q.organizationId && q.organizationId !== organizationId) {
			return error(res, 'Forbidden', 403);
		}

		const payload = await getAiPerformanceRanking(organizationId, q);
		if (payload.traceId) res.setHeader('x-ai-trace-id', payload.traceId);
		return success(res, payload, 'AI performance ranking');
	} catch (err) {
		if (err instanceof AiServiceError) {
			return res.status(err.statusCode).json({
				success: false,
				message: err.message,
				errorCode: err.errorCode,
				traceId: err.traceId,
				meta: err.meta,
			});
		}
		return error(res, 'Failed to compute AI performance ranking', 500, err);
	}
}

export async function getPortalAiWeeklyReportsController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const employeeId = String(req.params.employeeId || '').trim();
		if (!employeeId) return error(res, 'employeeId is required', 400);

		const parsed = aiWeeklyReportsQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const out = await getPortalAiWeeklyReports(organizationId, employeeId, parsed.data.limit);
		if (out.traceId) res.setHeader('x-ai-trace-id', out.traceId);
		return success(res, out.data, 'AI weekly reports');
	} catch (err) {
		if (err instanceof AiServiceError) {
			return res.status(err.statusCode).json({
				success: false,
				message: err.message,
				errorCode: err.errorCode,
				traceId: err.traceId,
				meta: err.meta,
			});
		}
		return error(res, 'Failed to load AI reports', 500, err);
	}
}

export async function postGeneratePortalAiReportController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = generateAiReportBodySchema.safeParse(req.body);
		if (!parsed.success) {
			return error(res, 'Validation failed', 400, parsed.error.flatten());
		}

		const result = await generatePortalAiReportFromTelemetry(organizationId, parsed.data.employeeId);
		if (result.traceId) res.setHeader('x-ai-trace-id', result.traceId);
		return success(
			res,
			{ report: result.data, traceId: result.traceId },
			'AI analytics report generated'
		);
	} catch (err) {
		if (err instanceof AiServiceError) {
			return res.status(err.statusCode).json({
				success: false,
				message: err.message,
				errorCode: err.errorCode,
				traceId: err.traceId,
				meta: err.meta,
			});
		}
		return error(res, 'Failed to generate AI report', 500, err);
	}
}
