/**
 * Portal → AI integration-style test (mocked upstream HTTP).
 * Verifies resilient client + report generate contract.
 */
import { ENV } from '../../config/env';
import {
	clearAiServiceTokenCache,
	generateAnalyticsReport,
	buildContentHash,
} from './ai.service';
import { resetHttpCircuits } from '../../utils/httpClient';

function jsonResponse(ok: boolean, status: number, body: Record<string, unknown>): Response {
	const text = JSON.stringify(body);
	return {
		ok,
		status,
		json: async () => body,
		text: async () => text,
		headers: {
			get: (name: string) => (name.toLowerCase() === 'x-trace-id' ? 'trace-int-1' : null),
		},
	} as Response;
}

describe('portal-to-AI integration (mocked)', () => {
	const baseUrl = 'http://mock-ai.integration.test';

	beforeEach(() => {
		clearAiServiceTokenCache();
		resetHttpCircuits();
		ENV.AI_SERVER_BASE_URL = baseUrl;
		ENV.AI_SERVICE_CLIENT_ID = 'portal';
		ENV.AI_SERVICE_CLIENT_SECRET = 'secret';
		ENV.AI_HTTP_MAX_RETRIES = 1;
		ENV.AI_HTTP_BASE_DELAY_MS = 1;
		ENV.AI_CIRCUIT_FAILURE_THRESHOLD = 50;
	});

	afterEach(() => {
		jest.restoreAllMocks();
		clearAiServiceTokenCache();
		resetHttpCircuits();
	});

	it('generates report after login and uses stable content hash idempotency', async () => {
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						data: { access_token: 'tok', expires_in: 3600 },
					})
				);
			}
			if (url.includes('/analytics/report')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						data: {
							productivity_score: 72,
							scoring_mode: 'rules',
							rule_engine_version: '1.0.0',
							confidence: 0.8,
							burnout_risk: 'Low Risk',
							working_hours: 7.5,
							idle_hours: 0.5,
						},
					})
				);
			}
			return Promise.reject(new Error(url));
		});

		const hashA = buildContentHash({ a: 1 });
		const hashB = buildContentHash({ a: 1 });
		expect(hashA).toBe(hashB);

		const result = await generateAnalyticsReport({
			tenantId: '11111111-1111-1111-1111-111111111111',
			employeeId: '22222222-2222-2222-2222-222222222222',
			tasksCompleted: 3,
			attendanceDays: 4,
			idleHours: 0.5,
			workingHours: 7.5,
			taskProgress: 60,
			daysLeft: 2,
			lateArrivals: 0,
			absentDays: 0,
			history: [{ date: '2026-07-01', productivityScore: 70, workingHours: 7, idleHours: 1 }],
			requestId: 'int-1',
		});

		expect(result.data).toMatchObject({
			scoring_mode: 'rules',
			rule_engine_version: '1.0.0',
		});
		expect(result.traceId).toBe('trace-int-1');
	});
});
