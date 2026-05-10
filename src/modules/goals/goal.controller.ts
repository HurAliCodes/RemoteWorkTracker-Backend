import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { error as errorResponse, success } from '../../utils/response';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { getGoalsQuerySchema } from './goal.validation';
import {
  createGoalService,
  deleteGoalService,
  getAllGoalsService,
  getGoalByIdService,
  updateGoalProgressService,
  updateGoalService,
} from './goal.service';

export const createGoalController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
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

    const result = await getAllGoalsService({
      userId: parsed.data.userId,
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
    const body = req.body;

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
    const result = await updateGoalProgressService(goalId, Number(req.body.progress));
    return success(res, result, 'Goal progress updated successfully');
  } catch (err: any) {
    logger.error('Failed to update goal progress', { error: err.message });
    if (err.message === 'Goal not found.') return errorResponse(res, 'Goal not found', 404);
    return errorResponse(res, err.message || 'Failed to update goal progress', 400);
  }
};
