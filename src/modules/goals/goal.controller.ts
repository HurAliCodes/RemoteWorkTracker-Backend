import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import { error as errorResponse, success } from '../../utils/response';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
  assertResourceInCallerOrg,
  goalBelongsToOrg,
  userBelongsToOrg,
  requireCallerOrgId,
} from '../../utils/org-access';
import { getGoalsQuerySchema } from './goal.validation';
import {
  createGoalService,
  deleteGoalService,
  getAllGoalsService,
  getGoalByIdService,
  updateGoalProgressService,
  updateGoalService,
} from './goal.service';

async function assertGoalAccess(req: Request, res: Response, goalId: string) {
  const organizationId = await assertResourceInCallerOrg(
    req as AuthRequest,
    res,
    goalId,
    goalBelongsToOrg,
    'Goal not found'
  );
  if (!organizationId) return null;

  const privileged = await isManagerOrAdmin(req);
  if (!privileged) {
    const callerId = (req as AuthRequest).user?.userId;
    const goal = await getGoalByIdService(goalId);
    if (!goal || !callerId || goal.userId !== callerId) {
      errorResponse(res, 'Forbidden', 403);
      return null;
    }
  }
  return organizationId;
}

export const createGoalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await requireCallerOrgId(req as AuthRequest, res);
    if (!organizationId) return;
    const body = req.body;
    if (!(await userBelongsToOrg(body.userId, organizationId))) {
      return errorResponse(res, 'User not found', 404);
    }
    const result = await createGoalService({
      title: body.title,
      userId: body.userId,
      description: body.description,
      deadline: body.deadline,
    });
    return success(res, result, 'Goal created successfully', 201);
  } catch (err: any) {
    logger.error('Failed to create goal', { error: err.message });
    if (err.message === 'User not found.') return errorResponse(res, 'User not found', 404);
    return errorResponse(res, err.message || 'Failed to create goal', 400);
  }
};

export const getAllGoalsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = getGoalsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
    }

    const callerOrgId = await resolveCallerOrganizationId(req);
    if (!callerOrgId) {
      return errorResponse(res, 'Unauthorized or missing organization', 401);
    }

    const qOrg = parsed.data.organizationId?.trim();
    if (qOrg && qOrg !== callerOrgId) {
      return errorResponse(res, 'organizationId does not match caller organization', 403);
    }

    const privileged = await isManagerOrAdmin(req);
    let userId = parsed.data.userId;
    if (!privileged) {
      const callerId = req.user?.userId;
      if (!callerId) return errorResponse(res, 'Unauthorized', 401);
      userId = callerId;
    }

    const result = await getAllGoalsService({
      userId,
      status: parsed.data.status,
      page: parsed.data.page,
      limit: parsed.data.limit,
      organizationId: callerOrgId,
    });

    return success(res, result, 'Goals fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch goals', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch goals', 400);
  }
};

export const getGoalByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await assertGoalAccess(req, res, goalId))) return;
    const goal = await getGoalByIdService(goalId);
    if (!goal) return errorResponse(res, 'Goal not found', 404);

    return success(res, goal, 'Goal fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch goal', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch goal', 400);
  }
};

export const updateGoalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const organizationId = await assertGoalAccess(req, res, goalId);
    if (!organizationId) return;
    const body = req.body;
    if (body.userId && !(await userBelongsToOrg(body.userId, organizationId))) {
      return errorResponse(res, 'User not found', 404);
    }

    const result = await updateGoalService(goalId, {
      title: body.title,
      userId: body.userId,
      description: body.description,
      deadline: body.deadline,
    });

    return success(res, result, 'Goal updated successfully');
  } catch (err: any) {
    logger.error('Failed to update goal', { error: err.message });
    if (err.message === 'Goal not found.') return errorResponse(res, 'Goal not found', 404);
    if (err.message === 'User not found.') return errorResponse(res, 'User not found', 404);
    return errorResponse(res, err.message || 'Failed to update goal', 400);
  }
};

export const deleteGoalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await assertGoalAccess(req, res, goalId))) return;
    const result = await deleteGoalService(goalId);
    return success(res, result, 'Goal deleted successfully');
  } catch (err: any) {
    logger.error('Failed to delete goal', { error: err.message });
    if (err.message === 'Goal not found.') return errorResponse(res, 'Goal not found', 404);
    return errorResponse(res, err.message || 'Failed to delete goal', 400);
  }
};

export const updateGoalProgressController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await assertGoalAccess(req, res, goalId))) return;
    const result = await updateGoalProgressService(goalId, Number(req.body.progress));
    return success(res, result, 'Goal progress updated successfully');
  } catch (err: any) {
    logger.error('Failed to update goal progress', { error: err.message });
    if (err.message === 'Goal not found.') return errorResponse(res, 'Goal not found', 404);
    return errorResponse(res, err.message || 'Failed to update goal progress', 400);
  }
};
