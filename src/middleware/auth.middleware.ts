import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import logger from '../config/logger';

export interface AuthRequest extends Request {
	user?: {
		userId: string;
		email?: string;
		role?: string;
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
			const decoded = jwt.verify(token, JWT_SECRET) as any;
			(req as any).user = decoded;
			return next();
		} catch (err) {
			console.error('[AUTH] JWT verification error:', err);
			return res.status(401).json({ message: 'Invalid or expired token', error: err instanceof Error ? err.message : err });
		}
	}
	return res.status(401).json({ message: 'Authorization header missing or malformed' });
};
