import { Request, Response } from 'express';
import crypto from 'crypto';
import {
  saveDevice,
  findDevice,
  updateDeviceStatus,
  saveActivityLog,
  saveIdleLog,
  createPairingCodeRecord,
  consumePairingCodeRecord,
  deleteExpiredPairingCodeRecords,
} from './agent.repository';

import {
  registerDeviceSchema,
  heartbeatSchema,
  activitySchema,
  idleSchema,
  createPairingCodeSchema,
} from './agent.validation';
import { normalizeActivityRecord } from './agent.mapper';
import { AuthRequest } from '../../middleware/auth.middleware';

function isUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, alphabet.length);
    code += alphabet[idx];
  }
  return code;
}

async function resolveUserIdFromPairingCode(pairingCode?: string): Promise<string | null> {
  if (!pairingCode) {
    return null;
  }
  const record = await consumePairingCodeRecord(pairingCode.toUpperCase());
  if (!record) {
    return null;
  }
  return record.user_id;
}

export const registerDevice = async (req: Request, res: Response) => {
  const parseResult = registerDeviceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, userId, pairingCode, hostname, os } = parseResult.data;
  const resolvedUserId = userId || await resolveUserIdFromPairingCode(pairingCode);
  if (!resolvedUserId) {
    return res.status(400).json({
      error: 'Invalid or expired pairing code. Generate a new pairing code and try again.',
    });
  }
  let device = await findDevice(deviceId);
  if (!device) {
    device = {
      deviceId,
      userId: resolvedUserId,
      hostname,
      os,
      status: 'online',
      lastSeen: new Date().toISOString(),
    };
    device = await saveDevice(device);
  }
  const { signAccessToken, signRefreshToken } = await import('../../utils/jwt');
  const payload = { deviceId: device.device_id || device.deviceId, userId: device.user_id || device.userId };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return res.json({
    deviceId: device.device_id || device.deviceId,
    userId: device.user_id || device.userId,
    accessToken,
    refreshToken,
  });
};

export const createPairingCode = async (req: AuthRequest, res: Response) => {
  const parseResult = createPairingCodeSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const userId = req.user?.userId;
  if (!userId || !isUuid(userId)) {
    return res.status(401).json({ error: 'Authenticated user is required to generate a pairing code' });
  }
  const expiresInMinutes = parseResult.data.expiresInMinutes ?? 10;
  const expiresAtMs = Date.now() + expiresInMinutes * 60 * 1000;
  await deleteExpiredPairingCodeRecords();

  let pairingCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    pairingCode = generatePairingCode();
    try {
      await createPairingCodeRecord(userId, pairingCode, new Date(expiresAtMs).toISOString());
      break;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code !== '23505') {
        throw err;
      }
      pairingCode = '';
    }
  }

  if (!pairingCode) {
    return res.status(500).json({ error: 'Failed to generate pairing code, please try again.' });
  }

  return res.json({
    pairingCode,
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresInMinutes,
  });
};

export const heartbeat = async (req: Request, res: Response) => {
  const parseResult = heartbeatSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, status } = parseResult.data;
  const device = await updateDeviceStatus(deviceId, status || 'online');
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  return res.json({ status: 'ok', device });
};
export const activity = async (req: Request, res: Response) => {
  const parseResult = activitySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { activities } = parseResult.data;
  let saved = 0;
  for (const log of activities) {
    const row = normalizeActivityRecord(log);
    if (row) {
      await saveActivityLog(row);
      saved += 1;
    }
  }
  return res.json({ status: 'ok', count: saved, received: activities.length });
};

export const idle = async (req: Request, res: Response) => {
  const parseResult = idleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, idleDuration, idleTime, userId: bodyUserId, timestamp } = parseResult.data;
  let userId = bodyUserId;
  if (!userId) {
    const device = await findDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found; register the device first' });
    }
    userId = device.user_id;
  }
  const seconds = Math.round(idleDuration ?? idleTime ?? 0);
  const ts = timestamp ?? new Date().toISOString();
  await saveIdleLog({
    deviceId,
    userId,
    idleTime: seconds,
    timestamp: ts,
  });
  return res.json({ status: 'ok' });
};
