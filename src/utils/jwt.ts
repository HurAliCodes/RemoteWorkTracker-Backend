import type { StringValue } from 'ms';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

const JWT_SECRET = ENV.JWT_SECRET;
const JWT_REFRESH_SECRET = ENV.JWT_REFRESH_SECRET;

export type TokenTyp = 'user' | 'org_admin' | 'device';

export function signAccessToken(
	payload: object,
	expiresIn: StringValue | number = '15m',
	typ: TokenTyp = 'user'
) {
	return jwt.sign({ ...payload, typ }, JWT_SECRET, { expiresIn });
}

export function signRefreshToken(
	payload: object,
	expiresIn: StringValue | number = '7d',
	typ: TokenTyp = 'user'
) {
	return jwt.sign({ ...payload, typ }, JWT_REFRESH_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string) {
	return jwt.verify(token, JWT_SECRET);
}

export function verifyRefreshToken(token: string) {
	return jwt.verify(token, JWT_REFRESH_SECRET);
}

export function readTokenTyp(payload: Record<string, unknown> | null | undefined): TokenTyp | null {
	if (!payload || typeof payload !== 'object') return null;
	const typ = payload.typ;
	if (typ === 'user' || typ === 'org_admin' || typ === 'device') return typ;
	// Legacy tokens: device payloads include deviceId; org admin includes admin:true.
	if (typeof payload.deviceId === 'string' && payload.deviceId) return 'device';
	if (payload.admin === true) return 'org_admin';
	if (typeof payload.userId === 'string' && payload.userId) return 'user';
	return null;
}
