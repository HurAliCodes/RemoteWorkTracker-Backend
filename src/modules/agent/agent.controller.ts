import { Request, Response } from 'express';
import crypto from 'crypto';
import {
  saveDevice,
  findDevice,
  updateDeviceStatus,
  saveIdleLog,
  createPairingCodeRecord,
  consumePairingCodeRecord,
  deleteExpiredPairingCodeRecords,
  setDeviceRefreshTokenHash,
  clearDeviceRefreshTokenHash,
  hashRefreshToken,
} from './agent.repository';

import {
  registerDeviceSchema,
  heartbeatSchema,
  activitySchema,
  idleSchema,
  createPairingCodeSchema,
  refreshDeviceTokenSchema,
} from './agent.validation';
import { AuthRequest } from '../../middleware/auth.middleware';
import { readTokenTyp, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { recordActivityBatch } from './agent.service';

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

function assertDeviceMatchesToken(req: AuthRequest, deviceId: string): boolean {
  const tokenDeviceId = req.user?.deviceId;
  return typeof tokenDeviceId === 'string' && tokenDeviceId === deviceId;
}

export const registerDevice = async (req: Request, res: Response) => {
  const parseResult = registerDeviceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, pairingCode, hostname, os } = parseResult.data;
  const resolvedUserId = await resolveUserIdFromPairingCode(pairingCode);
  if (!resolvedUserId) {
    return res.status(400).json({
      error: 'Invalid or expired pairing code. Generate a new pairing code and try again.',
    });
  }
  const existing = await findDevice(deviceId);
  if (existing && existing.user_id !== resolvedUserId) {
    return res.status(409).json({ error: 'Device is already registered to another user.' });
  }
  const device = await saveDevice({
    deviceId,
    userId: resolvedUserId,
    hostname,
    os,
    status: 'online',
    lastSeen: new Date().toISOString(),
  });
  const payload = {
    deviceId: device.device_id || deviceId,
    userId: device.user_id || resolvedUserId,
  };
  const accessToken = signAccessToken(payload, '15m', 'device');
  const refreshToken = signRefreshToken(payload, '7d', 'device');
  await setDeviceRefreshTokenHash(device.device_id || deviceId, hashRefreshToken(refreshToken));
  return res.json({
    deviceId: device.device_id || deviceId,
    userId: device.user_id || resolvedUserId,
    accessToken,
    refreshToken,
  });
};

export const refreshDeviceToken = async (req: Request, res: Response) => {
  const parseResult = refreshDeviceTokenSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  try {
    const payload = verifyRefreshToken(parseResult.data.refreshToken) as {
      deviceId?: string;
      userId?: string;
      typ?: string;
    };
    if (readTokenTyp(payload as Record<string, unknown>) !== 'device') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    if (!payload?.deviceId || !payload?.userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const device = await findDevice(payload.deviceId);
    if (!device || device.user_id !== payload.userId) {
      return res.status(401).json({ error: 'Device not found for refresh token' });
    }
    const presentedHash = hashRefreshToken(parseResult.data.refreshToken);
    if (!device.refresh_token_hash || device.refresh_token_hash !== presentedHash) {
      return res.status(401).json({ error: 'Refresh token revoked or invalid' });
    }
    const nextPayload = { deviceId: payload.deviceId, userId: payload.userId };
    const accessToken = signAccessToken(nextPayload, '15m', 'device');
    const refreshToken = signRefreshToken(nextPayload, '7d', 'device');
    await setDeviceRefreshTokenHash(payload.deviceId, hashRefreshToken(refreshToken));
    return res.json({
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

export const revokeDeviceRefresh = async (req: AuthRequest, res: Response) => {
  const deviceId = req.user?.deviceId;
  if (!deviceId) {
    return res.status(403).json({ error: 'Device token required' });
  }
  await clearDeviceRefreshTokenHash(deviceId);
  return res.json({ status: 'ok', revoked: true });
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

export const heartbeat = async (req: AuthRequest, res: Response) => {
  const parseResult = heartbeatSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, status } = parseResult.data;
  if (!assertDeviceMatchesToken(req, deviceId)) {
    return res.status(403).json({ error: 'Token does not match deviceId' });
  }
  const device = await updateDeviceStatus(deviceId, status || 'online');
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  return res.json({ status: 'ok', device });
};

export const activity = async (req: AuthRequest, res: Response) => {
  const parseResult = activitySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const tokenDeviceId = req.user?.deviceId;
  const tokenUserId = req.user?.userId;
  if (!tokenDeviceId || !tokenUserId) {
    return res.status(403).json({ error: 'Device token required' });
  }

  const idempotencyKey =
    (req.header('idempotency-key') || req.header('Idempotency-Key') || '').trim() ||
    (typeof (req.body as { idempotencyKey?: string })?.idempotencyKey === 'string'
      ? String((req.body as { idempotencyKey?: string }).idempotencyKey).trim()
      : '');

  const response = await recordActivityBatch({
    tokenDeviceId,
    tokenUserId,
    activities: parseResult.data.activities,
    idempotencyKey: idempotencyKey || undefined,
  });

  return res.json(response);
};

export const idle = async (req: AuthRequest, res: Response) => {
  const parseResult = idleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.flatten() });
  }
  const { deviceId, idleDuration, idleTime, timestamp } = parseResult.data;
  if (!assertDeviceMatchesToken(req, deviceId)) {
    return res.status(403).json({ error: 'Token does not match deviceId' });
  }
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(403).json({ error: 'Device token missing userId' });
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
