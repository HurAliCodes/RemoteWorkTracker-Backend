import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const boolFromEnv = z
	.union([z.boolean(), z.string()])
	.optional()
	.transform((v) => v === true || v === '1' || v === 'true');

const envSchema = z.object({
	NODE_ENV: z.preprocess(
		(v) => (v === '' || v == null ? 'development' : v),
		z.enum(['development', 'test', 'production'])
	),
	PORT: z.string().optional().default('5000'),
	DATABASE_URL: z.string().optional().default(''),
	DB_HOST: z.string().optional().default(''),
	DB_PORT: z.string().optional().default(''),
	DB_NAME: z.string().optional().default(''),
	DB_USER: z.string().optional().default(''),
	DB_PASSWORD: z.string().optional().default(''),
	JWT_SECRET: z.string().optional().default(''),
	JWT_REFRESH_SECRET: z.string().optional().default(''),
	FRONTEND_URL: z.string().optional().default('http://localhost:3000'),
	CORS_ORIGIN: z.string().optional().default(''),
	TRUST_PROXY: boolFromEnv,
	NGROK_AUTHTOKEN: z.string().optional().default(''),
	BREVO_API_KEY: z.string().optional().default(''),
	REDIS_URL: z.string().optional().default(''),
	RABBITMQ_URL: z.string().optional().default(''),
	FIREBASE_PROJECT_ID: z.string().optional().default(''),
	FIREBASE_CLIENT_EMAIL: z.string().optional().default(''),
	FIREBASE_PRIVATE_KEY: z.string().optional().default(''),
	AI_SERVER_BASE_URL: z.string().optional().default('http://localhost:8000'),
	AI_SERVICE_CLIENT_ID: z.string().optional().default(''),
	AI_SERVICE_CLIENT_SECRET: z.string().optional().default(''),
	AI_DEFAULT_SCOPES: z.string().optional().default('analytics:write analytics:read'),
	AI_TOKEN_TTL_SAFETY_SECONDS: z.coerce.number().optional().default(60),
	AI_SNAPSHOT_POLICY_START_HOUR_UTC: z.coerce.number().optional().default(9),
	AI_SNAPSHOT_POLICY_END_HOUR_UTC: z.coerce.number().optional().default(18),
	AI_SNAPSHOT_ROLLUP_DAYS: z.coerce.number().optional().default(30),
	AI_SNAPSHOT_LATE_GRACE_MINUTES: z.coerce.number().optional().default(60),
	AI_HTTP_TIMEOUT_MS: z.coerce.number().optional().default(15000),
	AI_HTTP_MAX_RETRIES: z.coerce.number().optional().default(3),
	AI_HTTP_BASE_DELAY_MS: z.coerce.number().optional().default(250),
	AI_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().optional().default(5),
	AI_CIRCUIT_COOLDOWN_MS: z.coerce.number().optional().default(30000),
	RABBITMQ_PREFETCH: z.coerce.number().optional().default(5),
	RABBITMQ_RECONNECT_MS: z.coerce.number().optional().default(2000),
	ANALYTICS_CRON: z.string().optional().default('15 3 * * *'),
	BURNOUT_CRON: z.string().optional().default('30 3 * * *'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
	throw new Error(`Invalid environment configuration: ${issues}`);
}

const raw = parsed.data;

export const ENV = {
	NODE_ENV: raw.NODE_ENV,
	PORT: raw.PORT,
	DATABASE_URL: raw.DATABASE_URL.trim(),
	DB_HOST: raw.DB_HOST.trim(),
	DB_PORT: raw.DB_PORT.trim(),
	DB_NAME: raw.DB_NAME.trim(),
	DB_USER: raw.DB_USER.trim(),
	DB_PASSWORD: raw.DB_PASSWORD,
	JWT_SECRET: raw.JWT_SECRET.trim(),
	JWT_REFRESH_SECRET: raw.JWT_REFRESH_SECRET.trim(),
	FRONTEND_URL: raw.FRONTEND_URL.trim() || 'http://localhost:3000',
	/** Comma-separated allowed origins. `*` is allowed only outside production. */
	CORS_ORIGIN: raw.CORS_ORIGIN.trim(),
	TRUST_PROXY: Boolean(raw.TRUST_PROXY),
	NGROK_AUTHTOKEN: raw.NGROK_AUTHTOKEN.trim(),
	BREVO_API_KEY: raw.BREVO_API_KEY.trim(),
	REDIS_URL: raw.REDIS_URL.trim(),
	RABBITMQ_URL: raw.RABBITMQ_URL.trim(),
	FIREBASE_PROJECT_ID: raw.FIREBASE_PROJECT_ID.trim(),
	FIREBASE_CLIENT_EMAIL: raw.FIREBASE_CLIENT_EMAIL.trim(),
	FIREBASE_PRIVATE_KEY: raw.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
	AI_SERVER_BASE_URL: raw.AI_SERVER_BASE_URL.trim() || 'http://localhost:8000',
	AI_SERVICE_CLIENT_ID: raw.AI_SERVICE_CLIENT_ID.trim(),
	AI_SERVICE_CLIENT_SECRET: raw.AI_SERVICE_CLIENT_SECRET.trim(),
	AI_DEFAULT_SCOPES: raw.AI_DEFAULT_SCOPES.trim() || 'analytics:write analytics:read',
	AI_TOKEN_TTL_SAFETY_SECONDS: raw.AI_TOKEN_TTL_SAFETY_SECONDS,
	AI_SNAPSHOT_POLICY_START_HOUR_UTC: raw.AI_SNAPSHOT_POLICY_START_HOUR_UTC,
	AI_SNAPSHOT_POLICY_END_HOUR_UTC: raw.AI_SNAPSHOT_POLICY_END_HOUR_UTC,
	AI_SNAPSHOT_ROLLUP_DAYS: raw.AI_SNAPSHOT_ROLLUP_DAYS,
	AI_SNAPSHOT_LATE_GRACE_MINUTES: raw.AI_SNAPSHOT_LATE_GRACE_MINUTES,
	AI_HTTP_TIMEOUT_MS: raw.AI_HTTP_TIMEOUT_MS,
	AI_HTTP_MAX_RETRIES: raw.AI_HTTP_MAX_RETRIES,
	AI_HTTP_BASE_DELAY_MS: raw.AI_HTTP_BASE_DELAY_MS,
	AI_CIRCUIT_FAILURE_THRESHOLD: raw.AI_CIRCUIT_FAILURE_THRESHOLD,
	AI_CIRCUIT_COOLDOWN_MS: raw.AI_CIRCUIT_COOLDOWN_MS,
	RABBITMQ_PREFETCH: raw.RABBITMQ_PREFETCH,
	RABBITMQ_RECONNECT_MS: raw.RABBITMQ_RECONNECT_MS,
	ANALYTICS_CRON: raw.ANALYTICS_CRON.trim() || '15 3 * * *',
	BURNOUT_CRON: raw.BURNOUT_CRON.trim() || '30 3 * * *',
};

/** Fail closed before the HTTP server listens. */
export function assertRequiredEnv(): void {
	const missing: string[] = [];
	if (!ENV.JWT_SECRET) missing.push('JWT_SECRET');
	if (!ENV.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
	const hasDatabaseUrl = Boolean(ENV.DATABASE_URL);
	const hasDiscreteDb = Boolean(ENV.DB_HOST) && Boolean(ENV.DB_NAME) && Boolean(ENV.DB_USER);
	if (!hasDatabaseUrl && !hasDiscreteDb) {
		missing.push('DATABASE_URL (or DB_HOST+DB_NAME+DB_USER)');
	}
	if (ENV.NODE_ENV === 'production') {
		if (!ENV.JWT_SECRET) missing.push('JWT_SECRET');
		if (!ENV.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
		if (ENV.CORS_ORIGIN === '*') {
			missing.push('CORS_ORIGIN must not be * in production');
		}
	}
	if (missing.length) {
		throw new Error(`Missing/invalid required environment variable(s): ${missing.join(', ')}`);
	}
}
