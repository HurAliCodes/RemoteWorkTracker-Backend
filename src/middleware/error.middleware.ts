import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { AppError, isAppError, mapPgError } from '../utils/errors';

/**
 * Canonical error envelope: { success: false, message, errors?, code? }
 * Agent routes that catch locally never reach here.
 */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
	let appErr: AppError | null = isAppError(err) ? err : null;
	if (!appErr) {
		appErr = mapPgError(err);
	}

	if (!appErr) {
		const status =
			typeof (err as { status?: number })?.status === 'number'
				? (err as { status: number }).status
				: typeof (err as { statusCode?: number })?.statusCode === 'number'
					? (err as { statusCode: number }).statusCode
					: 500;
		const message =
			err instanceof Error && err.message ? err.message : 'Internal Server Error';
		const code =
			typeof (err as { code?: string })?.code === 'string' &&
			!/^\d{5}$/.test((err as { code: string }).code)
				? (err as { code: string }).code
				: status >= 500
					? 'INTERNAL'
					: 'ERROR';
		appErr = new AppError(code, status, message, (err as { details?: unknown })?.details);
	}

	if (appErr.status >= 500) {
		logger.error('[error]', {
			code: appErr.code,
			message: appErr.message,
			path: req.path,
			method: req.method,
		});
	}

	return res.status(appErr.status).json({
		success: false,
		message: appErr.message,
		code: appErr.code,
		...(appErr.details !== undefined ? { errors: appErr.details } : {}),
	});
}
