import crypto from 'crypto';
import pool from '../config/db';
import logger from '../config/logger';
import { ENV } from '../config/env';

let messaging: unknown = null;

async function getMessaging() {
  if (messaging !== null) return messaging;
  const projectId = ENV.FIREBASE_PROJECT_ID;
  const clientEmail = ENV.FIREBASE_CLIENT_EMAIL;
  const privateKey = ENV.FIREBASE_PRIVATE_KEY || undefined;
  if (!projectId || !clientEmail || !privateKey) {
    messaging = false;
    return messaging;
  }
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    messaging = admin.messaging();
  } catch (err) {
    logger.warn('firebase-admin not available; FCM disabled', { error: err });
    messaging = false;
  }
  return messaging;
}

export async function registerPushToken(userId: string, token: string, platform?: string) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO device_push_tokens (token_id, user_id, token, platform, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
    [id, userId, token, platform ?? null]
  );
  return { message: 'Push token registered' };
}

export async function unregisterPushToken(userId: string, token: string) {
  await pool.query('DELETE FROM device_push_tokens WHERE user_id = $1 AND token = $2', [userId, token]);
  return { message: 'Push token removed' };
}

export async function sendPushToUser(userId: string, title: string, body: string) {
  const tokensRes = await pool.query(
    'SELECT token FROM device_push_tokens WHERE user_id = $1',
    [userId]
  );
  const tokens = tokensRes.rows.map((r: { token: string }) => r.token);
  if (!tokens.length) return { sent: 0 };
  const msg = await getMessaging();
  if (!msg || msg === false) {
    logger.info('FCM skipped (not configured)', { userId, title });
    return { sent: 0, skipped: true };
  }
  let sent = 0;
  for (const token of tokens) {
    try {
      await (msg as { send: (p: unknown) => Promise<unknown> }).send({
        token,
        notification: { title, body },
      });
      sent += 1;
    } catch (err) {
      logger.warn('FCM send failed', { error: err });
    }
  }
  return { sent };
}

export async function createNotificationWithPush(opts: {
  userId: string;
  type: string;
  message: string;
  title?: string;
}) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO notifications (notification_id, user_id, type, message, title, read, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,FALSE,NOW(),NOW())`,
    [id, opts.userId, opts.type, opts.message, opts.title ?? null]
  );
  const push = await sendPushToUser(opts.userId, opts.title ?? opts.type, opts.message);
  if (push.sent > 0) {
    await pool.query(
      'UPDATE notifications SET fcm_sent = TRUE, delivered_at = NOW() WHERE notification_id = $1',
      [id]
    );
  }
  return id;
}
