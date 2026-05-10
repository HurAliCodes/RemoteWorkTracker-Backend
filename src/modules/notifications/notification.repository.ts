import pool from '../../config/db';

export interface NotificationRow {
  notification_id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: Date;
  updated_at: Date;
}

export const findNotificationsByUserId = async (
  userId: string,
  opts: { page: number; limit: number; status?: string }
) => {
  const { page, limit, status } = opts;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['user_id = $1'];
  const params: (string | number | boolean)[] = [userId];

  if (status === 'READ') {
    conditions.push(`read = TRUE`);
  } else if (status === 'UNREAD') {
    conditions.push(`read = FALSE`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM notifications ${where}`,
    params
  );
  const totalRecords = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listResult = await pool.query(
    `SELECT notification_id, user_id, type, message, read, created_at, updated_at
     FROM notifications
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return { rows: listResult.rows as NotificationRow[], totalRecords, totalPages };
};

export const findNotificationById = async (notificationId: string) => {
  const result = await pool.query(
    `SELECT notification_id, user_id, type, message, read, created_at, updated_at
     FROM notifications
     WHERE notification_id = $1
     LIMIT 1`,
    [notificationId]
  );
  return (result.rows[0] as NotificationRow) || null;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const result = await pool.query(
    `UPDATE notifications SET read = TRUE, updated_at = NOW()
     WHERE notification_id = $1
     RETURNING notification_id, user_id, type, message, read, created_at, updated_at`,
    [notificationId]
  );
  return (result.rows[0] as NotificationRow) || null;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const result = await pool.query(
    `UPDATE notifications SET read = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND read = FALSE
     RETURNING notification_id`,
    [userId]
  );
  return result.rowCount ?? 0;
};

export const deleteNotificationById = async (notificationId: string) => {
  const result = await pool.query(
    `DELETE FROM notifications WHERE notification_id = $1 RETURNING notification_id`,
    [notificationId]
  );
  return result.rowCount ?? 0;
};
