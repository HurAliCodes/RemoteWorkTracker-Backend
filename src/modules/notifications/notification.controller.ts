import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import logger from '../../config/logger';
import { success, error as errorResponse } from '../../utils/response';
import { getNotificationsQuerySchema } from './notification.validation';
import {
  getNotificationsService,
  markNotificationReadService,
  markAllNotificationsReadService,
  deleteNotificationService,
} from './notification.service';

export const getNotificationsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const parsed = getNotificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
    }
    const { page, limit, status } = parsed.data;
    const result = await getNotificationsService(userId, { page, limit, status });
    return success(res, result, 'Notifications fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch notifications', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch notifications', 500);
  }
};

export const markNotificationReadController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await markNotificationReadService(notificationId, userId);
    return success(res, result, 'Notification marked as read');
  } catch (err: any) {
    logger.error('Failed to mark notification as read', { error: err.message });
    if (err.message === 'Notification not found.') {
      return errorResponse(res, 'Notification not found', 404);
    }
    if (err.message === 'Forbidden.') {
      return errorResponse(res, 'Forbidden', 403);
    }
    return errorResponse(res, err.message || 'Failed to mark notification as read', 500);
  }
};

export const markAllNotificationsReadController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const result = await markAllNotificationsReadService(userId);
    return success(res, result, 'All notifications marked as read');
  } catch (err: any) {
    logger.error('Failed to mark all notifications as read', { error: err.message });
    return errorResponse(res, err.message || 'Failed to mark all notifications as read', 500);
  }
};

export const deleteNotificationController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await deleteNotificationService(notificationId, userId);
    return success(res, result, 'Notification deleted successfully');
  } catch (err: any) {
    logger.error('Failed to delete notification', { error: err.message });
    if (err.message === 'Notification not found.') {
      return errorResponse(res, 'Notification not found', 404);
    }
    if (err.message === 'Forbidden.') {
      return errorResponse(res, 'Forbidden', 403);
    }
    return errorResponse(res, err.message || 'Failed to delete notification', 500);
  }
};
