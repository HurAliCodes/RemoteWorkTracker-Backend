import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../config/logger';
import { incCounter, observeHistogram } from '../utils/metrics';

export interface RequestWithContext extends Request {
	requestId?: string;
	startedAtMs?: number;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
	const ctx = req as RequestWithContext;
	const incoming = req.header('x-request-id');
	const requestId = incoming && incoming.trim() ? incoming.trim() : crypto.randomUUID();
	ctx.requestId = requestId;
	ctx.startedAtMs = Date.now();
	res.setHeader('x-request-id', requestId);

	res.on('finish', () => {
		const duration = Date.now() - (ctx.startedAtMs || Date.now());
		const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
		incCounter('http_requests_total', 'HTTP requests', {
			method: req.method,
			status: String(res.statusCode),
		});
		observeHistogram('http_request_duration_ms', 'HTTP request duration ms', duration, {
			method: req.method,
		});
		logger.info('http_request', {
			requestId,
			method: req.method,
			path: route,
			status: res.statusCode,
			durationMs: duration,
		});
	});

	next();
}
