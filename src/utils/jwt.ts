import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { ENV } from '../config/env';
const JWT_SECRET = ENV.JWT_SECRET;
const JWT_REFRESH_SECRET = ENV.JWT_REFRESH_SECRET;
export function signAccessToken(payload: object, expiresIn: StringValue | number = '15m') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
export function signRefreshToken(payload: object, expiresIn: StringValue | number = '7d') {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn });
}
export function verifyAccessToken(token: string) {
	return jwt.verify(token, JWT_SECRET);
}
export function verifyRefreshToken(token: string) {
	return jwt.verify(token, JWT_REFRESH_SECRET);
}