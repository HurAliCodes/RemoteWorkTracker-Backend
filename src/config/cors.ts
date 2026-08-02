import type { CorsOptions } from 'cors';
import { ENV } from './env';

export function getCorsOptions(): CorsOptions {
	const raw = ENV.CORS_ORIGIN || ENV.FRONTEND_URL;
	const devDefaults = [
		'http://localhost:3000',
		'http://localhost:3001',
		'http://localhost:5173',
		'http://127.0.0.1:3000',
		'http://127.0.0.1:3001',
		'http://127.0.0.1:5173',
	];

	if (raw === '*') {
		if (ENV.NODE_ENV === 'production') {
			throw new Error('CORS_ORIGIN=* is not allowed when NODE_ENV=production');
		}
		return {
			origin: true,
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		};
	}

	const list = raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	if (list.length > 0) {
		return {
			origin: list,
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		};
	}

	if (ENV.NODE_ENV === 'development') {
		return {
			origin: devDefaults,
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		};
	}

	return { origin: false, credentials: true };
}
