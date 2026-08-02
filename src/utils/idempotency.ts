import type { PoolClient } from 'pg';
import pool from '../config/db';

export async function findIdempotencyResponse(
	scope: string,
	key: string,
	client?: PoolClient
): Promise<unknown | null> {
	const db = client ?? pool;
	const result = await db.query(
		`SELECT response_json FROM idempotency_keys WHERE scope = $1 AND key = $2 LIMIT 1`,
		[scope, key]
	);
	return result.rows[0]?.response_json ?? null;
}

export async function saveIdempotencyResponse(
	input: {
		scope: string;
		key: string;
		response: unknown;
		requestHash?: string | null;
		deviceId?: string | null;
	},
	client?: PoolClient
): Promise<void> {
	const db = client ?? pool;
	await db.query(
		`INSERT INTO idempotency_keys (scope, key, request_hash, response_json, device_id)
		 VALUES ($1, $2, $3, $4::jsonb, $5)
		 ON CONFLICT (scope, key) DO NOTHING`,
		[
			input.scope,
			input.key,
			input.requestHash ?? null,
			JSON.stringify(input.response),
			input.deviceId ?? null,
		]
	);
}
