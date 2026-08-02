export type AppErrorDetails = unknown;

/** Shared application error — map via error middleware to the API envelope. */
export class AppError extends Error {
	readonly code: string;
	readonly status: number;
	readonly details?: AppErrorDetails;

	constructor(code: string, status: number, message: string, details?: AppErrorDetails) {
		super(message);
		this.name = 'AppError';
		this.code = code;
		this.status = status;
		this.details = details;
		Object.setPrototypeOf(this, new.target.prototype);
	}

	static badRequest(message: string, code = 'BAD_REQUEST', details?: AppErrorDetails) {
		return new AppError(code, 400, message, details);
	}

	static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: AppErrorDetails) {
		return new AppError(code, 401, message, details);
	}

	static forbidden(message = 'Forbidden', code = 'FORBIDDEN', details?: AppErrorDetails) {
		return new AppError(code, 403, message, details);
	}

	static notFound(message = 'Not found', code = 'NOT_FOUND', details?: AppErrorDetails) {
		return new AppError(code, 404, message, details);
	}

	static conflict(message: string, code = 'CONFLICT', details?: AppErrorDetails) {
		return new AppError(code, 409, message, details);
	}

	static internal(message = 'Internal Server Error', code = 'INTERNAL', details?: AppErrorDetails) {
		return new AppError(code, 500, message, details);
	}
}

export function isAppError(err: unknown): err is AppError {
	return err instanceof AppError;
}

/** Map common Postgres error codes to AppError when services don't handle them. */
export function mapPgError(err: unknown): AppError | null {
	const code = (err as { code?: string })?.code;
	if (code === '23503') {
		return AppError.badRequest('Invalid foreign key reference.', 'FK_VIOLATION');
	}
	if (code === '23505') {
		return AppError.conflict('Duplicate resource.', 'UNIQUE_VIOLATION');
	}
	return null;
}
