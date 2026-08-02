import { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { success, error as errorResponse } from '../../utils/response';
import { generatePerformanceSchema, finalizePerformanceSchema } from './performance.validation';
import * as service from './performance.service';

export const generateController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = generatePerformanceSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const row = await service.generatePerformanceReview({
      organizationId,
      userId: parsed.data.userId,
      period: parsed.data.period,
      reviewerId: req.user?.userId,
    });
    return success(res, service.mapReview(row), 'Performance review generated', 201);
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to generate review', 400);
  }
};

export const listController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    let userId = req.query.userId as string | undefined;
    if (req.user?.admin !== true && req.user?.userId) {
      userId = req.user.userId;
    }
    const result = await service.listPerformanceReviews(organizationId, {
      userId,
      period: req.query.period as string | undefined,
      status: req.query.status as string | undefined,
      page,
      limit,
    });
    return success(
      res,
      {
        meta: {
          page: result.page,
          limit: result.limit,
          totalRecords: result.totalRecords,
          totalPages: result.totalPages,
        },
        data: result.rows.map(service.mapReview),
      },
      'Reviews fetched'
    );
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to list reviews', 400);
  }
};

export const getByIdController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await service.getPerformanceReview(id!, organizationId);
    if (!row) return errorResponse(res, 'Review not found', 404);
    if (req.user?.admin !== true && req.user?.userId && row.user_id !== req.user.userId) {
      return errorResponse(res, 'Forbidden', 403);
    }
    return success(res, service.mapReview(row), 'Review fetched');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to fetch review', 400);
  }
};

export const finalizeController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = finalizePerformanceSchema.safeParse(req.body || {});
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await service.finalizePerformanceReview(id!, organizationId, parsed.data);
    if (!row) return errorResponse(res, 'Review not found or already finalized', 404);
    return success(res, service.mapReview(row), 'Review finalized');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to finalize', 400);
  }
};
