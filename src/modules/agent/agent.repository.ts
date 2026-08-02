import pool from '../../config/db';
import crypto from 'crypto';

export async function saveDevice(device: any) {
  const result = await pool.query(
    `INSERT INTO devices (device_id, user_id, os, hostname, last_seen, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (device_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       os = EXCLUDED.os,
       hostname = EXCLUDED.hostname,
       last_seen = EXCLUDED.last_seen,
       is_active = EXCLUDED.is_active
     RETURNING *`,
    [device.deviceId, device.userId, device.os, device.hostname, device.lastSeen, true]
  );

  return result.rows[0];
}

export async function findDevice(deviceId: string) {
  const result = await pool.query('SELECT * FROM devices WHERE device_id = $1', [deviceId]);
  return result.rows[0];
}

export async function saveActivityLog(log: any) {
  const result = await pool.query(
    `INSERT INTO activity_logs (device_id, user_id, action, description, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [log.deviceId, log.userId, log.action, log.description || '', log.timestamp]
  );
  return result.rows[0];
}

export async function saveIdleLog(log: any) {
  const result = await pool.query(
    `INSERT INTO idle_logs (device_id, user_id, idle_time, timestamp)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [log.deviceId, log.userId, log.idleTime, log.timestamp]
  );
  return result.rows[0];
}

export async function updateDeviceStatus(deviceId: string, status: string) {
  const result = await pool.query(
    'UPDATE devices SET is_active = $1, last_seen = NOW() WHERE device_id = $2 RETURNING *',
    [status === 'online', deviceId]
  );
  return result.rows[0];
}

export async function createPairingCodeRecord(userId: string, code: string, expiresAt: string) {
  const result = await pool.query(
    `INSERT INTO device_pairing_codes (code, user_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING code, user_id, expires_at`,
    [code, userId, expiresAt]
  );
  return result.rows[0];
}

export async function consumePairingCodeRecord(code: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selectResult = await client.query(
      `SELECT code, user_id, expires_at, consumed_at
       FROM device_pairing_codes
       WHERE code = $1
       FOR UPDATE`,
      [code]
    );

    if (selectResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const row = selectResult.rows[0];
    if (row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE device_pairing_codes
       SET consumed_at = NOW()
       WHERE code = $1`,
      [code]
    );
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteExpiredPairingCodeRecords() {
  await pool.query(
    `DELETE FROM device_pairing_codes
     WHERE expires_at <= NOW()
        OR consumed_at IS NOT NULL`
  );
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function setDeviceRefreshTokenHash(deviceId: string, tokenHash: string) {
  await pool.query(
    `UPDATE devices SET refresh_token_hash = $1 WHERE device_id = $2`,
    [tokenHash, deviceId]
  );
}

export async function clearDeviceRefreshTokenHash(deviceId: string) {
  await pool.query(
    `UPDATE devices SET refresh_token_hash = NULL WHERE device_id = $1`,
    [deviceId]
  );
}

export async function insertActivityLogWithClient(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  log: { deviceId: string; userId: string; action: string; description?: string; timestamp: string }
) {
  await client.query(
    `INSERT INTO activity_logs (device_id, user_id, action, description, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [log.deviceId, log.userId, log.action, log.description || '', log.timestamp]
  );
}
