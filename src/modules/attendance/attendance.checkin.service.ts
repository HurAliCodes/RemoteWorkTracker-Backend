import crypto from 'crypto';
import pool from '../../config/db';

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export async function listGeoFences(organizationId: string) {
  const result = await pool.query(
    'SELECT * FROM organization_geo_fences WHERE organization_id = $1 ORDER BY created_at DESC',
    [organizationId]
  );
  return result.rows;
}

export async function createGeoFence(data: {
  organizationId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO organization_geo_fences
      (fence_id, organization_id, name, latitude, longitude, radius_meters, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
    [id, data.organizationId, data.name, data.latitude, data.longitude, data.radiusMeters]
  );
  return result.rows[0];
}

export async function deleteGeoFence(fenceId: string, organizationId: string) {
  const result = await pool.query(
    'DELETE FROM organization_geo_fences WHERE fence_id = $1 AND organization_id = $2 RETURNING fence_id',
    [fenceId, organizationId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function assertWithinGeoFence(
  organizationId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const fences = await listGeoFences(organizationId);
  if (fences.length === 0) return;
  const ok = fences.some((f) => {
    const dist = haversineMeters(latitude, longitude, Number(f.latitude), Number(f.longitude));
    return dist <= Number(f.radius_meters);
  });
  if (!ok) {
    throw new Error('Check-in location is outside allowed geo-fences');
  }
}

export async function checkIn(opts: {
  userId: string;
  latitude: number;
  longitude: number;
  ipAddress: string;
  deviceId?: string;
  organizationId: string;
}) {
  await assertWithinGeoFence(opts.organizationId, opts.latitude, opts.longitude);
  const open = await pool.query(
    `SELECT attendance_id FROM attendance
     WHERE user_id = $1 AND check_out IS NULL AND status = 'CHECKED_IN'
     LIMIT 1`,
    [opts.userId]
  );
  if (open.rows[0]) throw new Error('Already checked in');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const location = `${opts.latitude},${opts.longitude}`;
  // device_id column may be UUID FK — only set when valid UUID
  const deviceIsUuid =
    typeof opts.deviceId === 'string' &&
    /^[0-9a-f-]{36}$/i.test(opts.deviceId);
  const result = await pool.query(
    `INSERT INTO attendance
      (attendance_id, user_id, device_id, check_in, location, latitude, longitude, ip_address, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'CHECKED_IN',$4,$4)
     RETURNING *`,
    [
      id,
      opts.userId,
      deviceIsUuid ? opts.deviceId : null,
      now,
      location,
      opts.latitude,
      opts.longitude,
      opts.ipAddress,
    ]
  );
  return result.rows[0];
}

export async function checkOut(opts: { userId: string; sessionId: string }) {
  const result = await pool.query(
    `UPDATE attendance
     SET check_out = NOW(), status = 'COMPLETED', updated_at = NOW()
     WHERE attendance_id = $1 AND user_id = $2 AND check_out IS NULL
     RETURNING *`,
    [opts.sessionId, opts.userId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('Open attendance session not found');
  const workedHours =
    (new Date(row.check_out).getTime() - new Date(row.check_in).getTime()) / 3600000;
  return { ...row, workedHours: Number(workedHours.toFixed(2)) };
}

export function mapAttendanceSession(row: any) {
  return {
    sessionId: row.attendance_id,
    userId: row.user_id,
    checkIn: row.check_in,
    checkOut: row.check_out ?? null,
    status: row.status,
    workedHours: row.workedHours,
    location: {
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      ipAddress: row.ip_address ?? null,
    },
    deviceId: row.device_id,
  };
}
