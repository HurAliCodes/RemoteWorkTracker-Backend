import { Request, Response } from 'express';
import { success, error as errorResponse } from '../../utils/response';
import {
  validateCreateWellnessLog,
  validateListMyWellnessLogsQuery,
  validateListWellnessLogsQuery,
} from './wellness.validation';
import {
  createWellnessLogService,
  getMyWellnessLogsService,
  getWellnessLogsService,
} from './wellness.service';

export const createWellnessLogController = async (req: Request, res: Response) => {
  const parsed = validateCreateWellnessLog(req.body);
  if (!parsed.success) {
    return errorResponse(res, 'Validation failed', 400, parsed.error.issues);
  }

  const userId = (req as any).user?.userId as string | undefined;
  if (!userId) {
    return errorResponse(res, 'User not authenticated', 401);
  }

  try {
    const log = await createWellnessLogService(userId, parsed.data);
    return success(res, log, 'Wellness log created successfully', 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create wellness log';
    return errorResponse(res, message, 400);
  }
};

export const getWellnessLogsController = async (req: Request, res: Response) => {
  const parsed = validateListWellnessLogsQuery(req.query);
  if (!parsed.success) {
    return errorResponse(res, 'Validation failed', 400, parsed.error.issues);
  }

  try {
    const logs = await getWellnessLogsService(parsed.data);
    return success(res, logs, 'Wellness logs fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch wellness logs';
    return errorResponse(res, message, 400);
  }
};

export const getMyWellnessLogsController = async (req: Request, res: Response) => {
  const parsed = validateListMyWellnessLogsQuery(req.query);
  if (!parsed.success) {
    return errorResponse(res, 'Validation failed', 400, parsed.error.issues);
  }

  const userId = (req as any).user?.userId as string | undefined;
  if (!userId) {
    return errorResponse(res, 'User not authenticated', 401);
  }

  try {
    const logs = await getMyWellnessLogsService(userId, parsed.data);
    return success(res, logs, 'My wellness logs fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch my wellness logs';
    return errorResponse(res, message, 400);
  }
};
