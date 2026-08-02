import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import logger from '../config/logger';
import { readTokenTyp } from '../utils/jwt';

export interface AuthRequest extends Request {
	user?: {
		userId: string;
		email?: string;
		role?: string;
		typ?: string;
		deviceId?: string;
		organizationId?: string;
		admin?: boolean;
		[key: string]: any;
	};
}

const JWT_SECRET = ENV.JWT_SECRET;

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
	if (!JWT_SECRET) {
		logger.error('[AUTH] JWT_SECRET is missing.');
		return res.status(500).json({ message: 'Server auth configuration is invalid' });
	}
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		const token = authHeader.split(' ')[1];
		try {
			const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
			(req as AuthRequest).user = decoded as AuthRequest['user'];
			return next();
		} catch {
			logger.warn('[AUTH] JWT verification failed');
			return res.status(401).json({ message: 'Invalid or expired token' });
		}
	}
	return res.status(401).json({ message: 'Authorization header missing or malformed' });
};

/** Portal web/mobile APIs — reject agent/device JWTs. */
export const requirePortalToken = (req: Request, res: Response, next: NextFunction) => {
	const user = (req as AuthRequest).user;
	const typ = readTokenTyp(user as Record<string, unknown>);
	if (typ === 'device') {
		return res.status(403).json({ message: 'Device tokens cannot access portal APIs' });
	}
	return next();
};

/** Agent telemetry — require device JWT (typ=device or legacy deviceId claim). */
export const requireDeviceToken = (req: Request, res: Response, next: NextFunction) => {
	const user = (req as AuthRequest).user;
	const typ = readTokenTyp(user as Record<string, unknown>);
	if (typ !== 'device') {
		return res.status(403).json({ message: 'Device token required' });
	}
	if (typeof user?.deviceId !== 'string' || !user.deviceId.trim()) {
		return res.status(403).json({ message: 'Device token missing deviceId' });
	}
	return next();
};

/** Employee user JWT (not org-admin, not device). */
export const requireEmployeeToken = (req: Request, res: Response, next: NextFunction) => {
	const user = (req as AuthRequest).user;
	const typ = readTokenTyp(user as Record<string, unknown>);
	if (typ === 'device') {
		return res.status(403).json({ message: 'Device tokens cannot access this endpoint' });
	}
	if (user?.admin === true && typ === 'org_admin') {
		return res.status(403).json({ message: 'Employee token required' });
	}
	if (typeof user?.userId !== 'string' || !user.userId.trim()) {
		return res.status(403).json({ message: 'Employee token required' });
	}
	return next();
};
