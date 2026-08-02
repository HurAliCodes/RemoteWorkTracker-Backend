import { Response } from 'express';
export function success<T>(res: Response, data: T, message = 'Success', status = 200) {
	return res.status(status).json({
		success: true,
		message,
		data,
	});
}
export function error(res: Response, message = 'Error', status = 500, errors?: any, code?: string) {
	return res.status(status).json({
		success: false,
		message,
		...(code ? { code } : {}),
		...(errors !== undefined ? { errors } : {}),
	});
}