import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { success, error as errorResponse } from '../../utils/response';
import { registerPushToken, unregisterPushToken } from '../../services/fcm.service';

const tokenSchema = z.object({
  token: z.string().min(10),
  platform: z.string().max(32).optional(),
});

export const registerPushTokenController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'Employee authentication required', 401);
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const data = await registerPushToken(userId, parsed.data.token, parsed.data.platform);
    return success(res, data, 'Token registered');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register token';
    return errorResponse(res, message, 400);
  }
};

export const unregisterPushTokenController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'Employee authentication required', 401);
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const data = await unregisterPushToken(userId, parsed.data.token);
    return success(res, data, 'Token removed');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove token';
    return errorResponse(res, message, 400);
  }
};
