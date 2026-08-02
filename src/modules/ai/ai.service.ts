import crypto from 'crypto';
import { ENV } from '../../config/env';
import logger from '../../config/logger';
import type { EmployeeSyncInput } from './ai.mapper';
import { mapEmployeeInputToAiPayload, mapReportInputToAiPayload, mapTaskInputToAiPayload } from './ai.mapper';
import { fetchWithResilience, HttpClientError, readJsonSafe } from '../../utils/httpClient';

type AiLoginResponse = {
	data?: {
		access_token?: string;
		expires_in?: number;
	};
};

type CachedToken = {
	token: string;
	expiresAtEpochSec: number;
};

/** Per-organization AI JWTs: token `tenant_id` must match request payload, so never reuse across tenants. */
const aiTokenByTenantId = new Map<string, CachedToken>();
const aiTokenInFlight = new Map<string, Promise<string>>();

/** Clears cached AI service Bearer tokens (for tests / hot reload isolation). Safe to call anytime. */
export function clearAiServiceTokenCache(): void {
	aiTokenByTenantId.clear();
	aiTokenInFlight.clear();
}

export class AiServiceError extends Error {
	statusCode: number;
	errorCode?: string;
	traceId?: string;
	meta?: unknown;

	constructor(message: string, statusCode = 500, opts?: { errorCode?: string; traceId?: string; meta?: unknown }) {
		super(message);
		this.statusCode = statusCode;
		this.errorCode = opts?.errorCode;
		this.traceId = opts?.traceId;
		this.meta = opts?.meta;
	}
}

function sanitizeBaseUrl(raw: string): string {
	return raw.replace(/\/+$/, '');
}

export function isAiIntegrationConfigured(): boolean {
	return Boolean(ENV.AI_SERVER_BASE_URL && ENV.AI_SERVICE_CLIENT_ID && ENV.AI_SERVICE_CLIENT_SECRET);
}

export function buildIdempotencyKey(parts: Array<string | number>): string {
	const value = parts.join(':');
	return crypto.createHash('sha256').update(value).digest('hex');
}

/** Stable content hash for logical sync/report dedupe (not random UUIDs). */
export function buildContentHash(payload: unknown): string {
	return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
}

function aiHttpOpts() {
	return {
		timeoutMs: ENV.AI_HTTP_TIMEOUT_MS,
		maxRetries: ENV.AI_HTTP_MAX_RETRIES,
		baseDelayMs: ENV.AI_HTTP_BASE_DELAY_MS,
		circuitFailureThreshold: ENV.AI_CIRCUIT_FAILURE_THRESHOLD,
		circuitCoolDownMs: ENV.AI_CIRCUIT_COOLDOWN_MS,
		circuitKey: 'ai-server',
	};
}

async function getAiToken(tenantId: string): Promise<string> {
	if (!isAiIntegrationConfigured()) {
		throw new AiServiceError('AI integration is not configured in environment.', 503);
	}
	const now = Math.floor(Date.now() / 1000);
	const cached = aiTokenByTenantId.get(tenantId);
	if (cached && cached.expiresAtEpochSec - ENV.AI_TOKEN_TTL_SAFETY_SECONDS > now) {
		return cached.token;
	}

	const inflight = aiTokenInFlight.get(tenantId);
	if (inflight) return inflight;

	const pending = (async () => {
		if (!ENV.AI_SERVICE_CLIENT_ID || !ENV.AI_SERVICE_CLIENT_SECRET) {
			throw new AiServiceError('AI service credentials are missing in backend environment.', 500);
		}

		const loginUrl = `${sanitizeBaseUrl(ENV.AI_SERVER_BASE_URL)}/api/v1/auth/login`;
		let loginResponse: Response;
		try {
			loginResponse = await fetchWithResilience(
				loginUrl,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						client_id: ENV.AI_SERVICE_CLIENT_ID,
						client_secret: ENV.AI_SERVICE_CLIENT_SECRET,
						tenant_id: tenantId,
						scopes: ENV.AI_DEFAULT_SCOPES.split(' ').filter(Boolean),
					}),
				},
				aiHttpOpts()
			);
		} catch (err) {
			if (err instanceof HttpClientError) {
				throw new AiServiceError(err.message, err.status || 503, { errorCode: 'AI_HTTP_FAILURE' });
			}
			throw err;
		}

		const body = (await readJsonSafe(loginResponse)) as AiLoginResponse & Record<string, unknown>;
		if (!loginResponse.ok || !body?.data?.access_token) {
			throw new AiServiceError('Failed to obtain AI service token.', loginResponse.status, {
				errorCode: (body?.error_code as string | undefined) ?? 'AI_AUTH_FAILURE',
				traceId: body?.trace_id as string | undefined,
				meta: body?.meta,
			});
		}

		const expiresIn = Number(body.data.expires_in ?? 3600);
		const entry: CachedToken = {
			token: body.data.access_token,
			expiresAtEpochSec: Math.floor(Date.now() / 1000) + expiresIn,
		};
		aiTokenByTenantId.set(tenantId, entry);
		return entry.token;
	})().finally(() => {
		aiTokenInFlight.delete(tenantId);
	});

	aiTokenInFlight.set(tenantId, pending);
	return pending;
}

async function callAiApi<T>({
	tenantId,
	method,
	path,
	payload,
	idempotencyKey,
	requestId,
}: {
	tenantId: string;
	method: 'GET' | 'POST';
	path: string;
	payload?: Record<string, unknown>;
	idempotencyKey?: string;
	requestId: string;
}): Promise<{ data: T; traceId?: string; meta?: unknown }> {
	const token = await getAiToken(tenantId);
	const headers: Record<string, string> = {
		authorization: `Bearer ${token}`,
		'x-request-id': requestId,
	};
	if (method !== 'GET') headers['content-type'] = 'application/json';
	if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

	let response: Response;
	try {
		response = await fetchWithResilience(
			`${sanitizeBaseUrl(ENV.AI_SERVER_BASE_URL)}${path}`,
			{
				method,
				headers,
				body: method === 'GET' ? undefined : JSON.stringify(payload ?? {}),
			},
			aiHttpOpts()
		);
	} catch (err) {
		if (err instanceof HttpClientError) {
			throw new AiServiceError(err.message, err.status || 503, { errorCode: 'AI_HTTP_FAILURE' });
		}
		throw err;
	}

	const traceId = response.headers.get('x-trace-id') || undefined;
	const body = await readJsonSafe(response);
	if (!response.ok) {
		throw new AiServiceError((body?.message as string) || 'AI server request failed', response.status, {
			errorCode: body?.error_code as string | undefined,
			traceId: (body?.trace_id as string | undefined) || traceId,
			meta: body?.meta,
		});
	}
	return { data: body.data as T, traceId, meta: body.meta };
}

export async function syncEmployeeData(input: EmployeeSyncInput & { requestId: string }) {
	const payload = mapEmployeeInputToAiPayload(input);
	const contentHash = buildContentHash(payload);
	const idempotencyKey = buildIdempotencyKey(['employee', input.tenantId, input.employeeId, contentHash]);
	return callAiApi({
		tenantId: input.tenantId,
		method: 'POST',
		path: '/api/v1/employee/data',
		payload,
		idempotencyKey,
		requestId: input.requestId,
	});
}

export async function syncTaskData(input: {
	tenantId: string;
	employeeId: string;
	taskId: string;
	progressPercent: number;
	daysLeft: number;
	requestId: string;
}) {
	const payload = mapTaskInputToAiPayload(input);
	const contentHash = buildContentHash(payload);
	const idempotencyKey = buildIdempotencyKey(['task', input.tenantId, input.taskId, contentHash]);
	return callAiApi({
		tenantId: input.tenantId,
		method: 'POST',
		path: '/api/v1/tasks',
		payload,
		idempotencyKey,
		requestId: input.requestId,
	});
}

export async function generateAnalyticsReport(
	input: EmployeeSyncInput & {
		history: Array<{ date: string; productivityScore: number; workingHours: number; idleHours: number }>;
		requestId: string;
	}
) {
	const payload = mapReportInputToAiPayload(input);
	const dayKey = new Date().toISOString().slice(0, 10);
	const contentHash = buildContentHash({ ...payload, day: dayKey });
	const idempotencyKey = buildIdempotencyKey(['report', input.tenantId, input.employeeId, dayKey, contentHash]);
	const result = await callAiApi<Record<string, unknown>>({
		tenantId: input.tenantId,
		method: 'POST',
		path: '/api/v1/analytics/report',
		payload,
		idempotencyKey,
		requestId: input.requestId,
	});
	logger.info('AI analytics report generated', {
		tenantId: input.tenantId,
		employeeId: input.employeeId,
		traceId: result.traceId,
	});
	return result;
}

export async function fetchWeeklyReports(input: {
	tenantId: string;
	employeeId: string;
	limit: number;
	requestId: string;
}) {
	const query = new URLSearchParams({
		tenant_id: input.tenantId,
		limit: String(input.limit),
	}).toString();
	return callAiApi<Record<string, unknown>>({
		tenantId: input.tenantId,
		method: 'GET',
		path: `/api/v1/reports/weekly/${encodeURIComponent(input.employeeId)}?${query}`,
		requestId: input.requestId,
	});
}

export type PerformanceRankingEmployeePayload = {
	employee_id: string;
	display_name?: string | null;
	department_id?: string | null;
	department_name?: string | null;
	productivity: number;
	task_completion: number;
	attendance: number;
	efficiency: number;
	collaboration: number;
};

export async function runPerformanceRanking(input: {
	tenantId: string;
	employees: PerformanceRankingEmployeePayload[];
	requestId: string;
}) {
	const payload = {
		tenant_id: input.tenantId,
		employees: input.employees,
	};
	const idempotencyKey = buildIdempotencyKey([
		'ranking',
		input.tenantId,
		buildContentHash(input.employees.map((e) => e.employee_id).sort()),
	]);
	return callAiApi<Record<string, unknown>>({
		tenantId: input.tenantId,
		method: 'POST',
		path: '/api/v1/analytics/performance-ranking',
		payload,
		idempotencyKey,
		requestId: input.requestId,
	});
}
