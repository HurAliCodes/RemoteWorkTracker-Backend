import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { success, error } from '../../utils/response';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { dashboardSummaryQuerySchema } from './dashboard.validation';
import { getDashboardSummary } from './dashboard.service';

export async function getDashboardSummaryController(req: AuthRequest, res: Response) {
	try {
		const organizationId = await resolveCallerOrganizationId(req);
		if (!organizationId) return error(res, 'Unauthorized', 401);

		const parsed = dashboardSummaryQuerySchema.safeParse(req.query);
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

		const data = await getDashboardSummary(organizationId, q, {
			viewerUserId,
		});

		return success(res, data, 'Dashboard summary');
	} catch (err) {
		return error(res, 'Failed to load dashboard summary', 500, err);
	}
}
