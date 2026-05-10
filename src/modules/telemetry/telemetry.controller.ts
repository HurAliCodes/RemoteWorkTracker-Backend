import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { error, success } from '../../utils/response';
import {
  telemetryDetailQuerySchema,
  telemetryAppsByDayQuerySchema,
  telemetryDeskLatestQuerySchema,
  telemetryListQuerySchema,
} from './telemetry.validation';
import {
  getActivityAppsByDayForOrg,
  getActivityDetail,
  getDailyTelemetry,
  getLatestDeskAppsForDay,
} from './telemetry.service';

function assertOrganizationMatch(bodyOrgId: string | undefined, callerOrg: string): boolean {
  if (!bodyOrgId) return true;
  return bodyOrgId === callerOrg;
}

export async function getAgentDailyTelemetryController(req: AuthRequest, res: Response) {
  const organizationId = await resolveCallerOrganizationId(req);
  if (!organizationId) return error(res, 'Unauthorized or user has no organization', 401);

  const parsed = telemetryListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
  }

  const q = parsed.data;
  if (!assertOrganizationMatch(q.organizationId, organizationId)) {
    return error(res, 'organizationId mismatch', 403);
  }

  try {
    const result = await getDailyTelemetry(organizationId, q);
    return success(res, result, 'Agent telemetry (daily)');
  } catch (e: unknown) {
    return error(res, 'Failed to load telemetry', 500, e);
  }
}

export async function getAgentActivityDetailController(req: AuthRequest, res: Response) {
  const organizationId = await resolveCallerOrganizationId(req);
  if (!organizationId) return error(res, 'Unauthorized or user has no organization', 401);

  const parsed = telemetryDetailQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
  }

  const q = parsed.data;
  if (!assertOrganizationMatch(q.organizationId, organizationId)) {
    return error(res, 'organizationId mismatch', 403);
  }

  try {
    const detail = await getActivityDetail(organizationId, q);
    return success(res, detail, 'Activity segments');
  } catch (e: unknown) {
    return error(res, 'Failed to load activity segments', 500, e);
  }
}

export async function getAgentAppsByDayController(req: AuthRequest, res: Response) {
  const organizationId = await resolveCallerOrganizationId(req);
  if (!organizationId) return error(res, 'Unauthorized or user has no organization', 401);

  const parsed = telemetryAppsByDayQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
  }

  const q = parsed.data;
  if (!assertOrganizationMatch(q.organizationId, organizationId)) {
    return error(res, 'organizationId mismatch', 403);
  }

  try {
    const result = await getActivityAppsByDayForOrg(organizationId, q.day);
    return success(res, result, 'Application totals for day');
  } catch (e: unknown) {
    return error(res, 'Failed to load application totals', 500, e);
  }
}

export async function getAgentDeskLatestController(req: AuthRequest, res: Response) {
  const organizationId = await resolveCallerOrganizationId(req);
  if (!organizationId) return error(res, 'Unauthorized or user has no organization', 401);

  const parsed = telemetryDeskLatestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
  }

  const q = parsed.data;
  if (!assertOrganizationMatch(q.organizationId, organizationId)) {
    return error(res, 'organizationId mismatch', 403);
  }

  try {
    const result = await getLatestDeskAppsForDay(organizationId, q.day, q.userId);
    return success(res, result, 'Latest desk per user');
  } catch (e: unknown) {
    return error(res, 'Failed to load latest desk apps', 500, e);
  }
}
