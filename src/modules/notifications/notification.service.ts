import {
  findNotificationsByUserId,
  findNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
  NotificationRow,
} from './notification.repository';

export const getNotificationsService = async (
  userId: string,
  opts: { page?: number; limit?: number; status?: string }
) => {
  const page = opts.page ?? 1;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const { rows, totalRecords, totalPages } = await findNotificationsByUserId(userId, {
    page,
    limit,
    status: opts.status,
  });
  const data = rows.map((row: NotificationRow) => ({
    notificationId: row.notification_id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    status: row.read ? 'READ' : 'UNREAD',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return { meta: { page, limit, totalRecords, totalPages }, data };
};

export const markNotificationReadService = async (
  notificationId: string,
  userId: string
) => {
  const notification = await findNotificationById(notificationId);
  if (!notification) throw new Error('Notification not found.');
  if (notification.user_id !== userId) throw new Error('Forbidden.');
  const updated = await markNotificationAsRead(notificationId);
  if (!updated) throw new Error('Failed to update notification.');
  return {
    notificationId: updated.notification_id,
    status: updated.read ? 'READ' : 'UNREAD',
    updatedAt: updated.updated_at,
  };
};

export const markAllNotificationsReadService = async (userId: string) => {
  const count = await markAllNotificationsAsRead(userId);
  return { updatedCount: count, message: 'All notifications marked as read.' };
};

export const deleteNotificationService = async (
  notificationId: string,
  userId: string
) => {
  const notification = await findNotificationById(notificationId);
  if (!notification) throw new Error('Notification not found.');
  if (notification.user_id !== userId) throw new Error('Forbidden.');
  await deleteNotificationById(notificationId);
  return { message: 'Notification deleted successfully.' };
};
