import { ENV } from '../../config/env';
import {
	clearAiServiceTokenCache,
	AiServiceError,
	fetchWeeklyReports,
	generateAnalyticsReport,
	isAiIntegrationConfigured,
	syncEmployeeData,
	syncTaskData,
} from './ai.service';

function jsonResponse(ok: boolean, status: number, body: Record<string, unknown>): Response {
	return {
		ok,
		status,
		json: async () => body,
		headers: {
			get: (name: string) => (name.toLowerCase() === 'x-trace-id' ? 'trace-ai-1' : null),
		},
	} as Response;
}

describe('ai.service', () => {
	const baseUrl = 'http://mock-ai.integration.test';
	let savedAiUrl: string;
	let savedAiId: string;
	let savedAiSecret: string;

	beforeEach(() => {
		clearAiServiceTokenCache();
		savedAiUrl = ENV.AI_SERVER_BASE_URL;
		savedAiId = ENV.AI_SERVICE_CLIENT_ID;
		savedAiSecret = ENV.AI_SERVICE_CLIENT_SECRET;
		ENV.AI_SERVER_BASE_URL = baseUrl;
		ENV.AI_SERVICE_CLIENT_ID = 'test-client-id';
		ENV.AI_SERVICE_CLIENT_SECRET = 'test-client-secret';
		jest.spyOn(global, 'fetch').mockReset();
	});

	afterEach(() => {
		ENV.AI_SERVER_BASE_URL = savedAiUrl;
		ENV.AI_SERVICE_CLIENT_ID = savedAiId;
		ENV.AI_SERVICE_CLIENT_SECRET = savedAiSecret;
		clearAiServiceTokenCache();
		jest.restoreAllMocks();
	});

	describe('isAiIntegrationConfigured', () => {
		it('is false when service credentials missing', () => {
			ENV.AI_SERVICE_CLIENT_ID = '';
			ENV.AI_SERVICE_CLIENT_SECRET = '';
			clearAiServiceTokenCache();
			expect(isAiIntegrationConfigured()).toBe(false);
		});
	});

	it('throws AiServiceError 503 when AI env not configured', async () => {
		ENV.AI_SERVICE_CLIENT_ID = '';
		ENV.AI_SERVICE_CLIENT_SECRET = '';
		clearAiServiceTokenCache();
		await expect(
			syncEmployeeData({
				tenantId: 't1',
				employeeId: 'e1',
				tasksCompleted: 0,
				attendanceDays: 0,
				idleHours: 0,
				workingHours: 0,
				taskProgress: 0,
				daysLeft: 0,
				lateArrivals: 0,
				absentDays: 0,
				requestId: 'req-503',
			})
		).rejects.toMatchObject({
			statusCode: 503,
		});
	});

	it('POSTs login then employee/data with snake_case payload and bearer', async () => {
		let fetchCalls = 0;
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL, init?: RequestInit) => {
			fetchCalls += 1;
			const url = String(input);

			if (url === `${baseUrl}/api/v1/auth/login`) {
				expect(init?.method).toBe('POST');
				const loginBody = JSON.parse(String(init?.body));
				expect(loginBody).toMatchObject({
					client_id: 'test-client-id',
					client_secret: 'test-client-secret',
					tenant_id: 'tenant-uuid-1',
					scopes: expect.any(Array),
				});

				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'jwt-from-ai-login', expires_in: 3600 },
					})
				);
			}

			if (url === `${baseUrl}/api/v1/employee/data`) {
				expect(init?.method).toBe('POST');
				const hdrs = init?.headers as Record<string, string>;
				expect(hdrs?.authorization || (init?.headers as Headers)?.get?.('authorization')).toBe(
					'Bearer jwt-from-ai-login'
				);
				expect(hdrs?.['content-type'] || hdrs?.['Content-Type']).toBe('application/json');
				expect(hdrs?.['x-request-id'] || (init?.headers as any)?.['x-request-id']).toBe('req-a');
				expect(hdrs?.['idempotency-key']).toBeDefined();

				const body = JSON.parse(String(init?.body));
				expect(body).toMatchObject({
					tenant_id: 'tenant-uuid-1',
					employee_id: 'employee-uuid-1',
					tasks_completed: 5,
					attendance_days: 4,
					idle_hours: 1,
					working_hours: 8,
					active_seconds: 28800,
					idle_seconds: 3600,
					segment_count: 10,
				});

				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: body,
						message: 'ok',
					})
				);
			}

			return Promise.reject(new Error(`unexpected fetch: ${url}`));
		});

		const result = await syncEmployeeData({
			tenantId: 'tenant-uuid-1',
			employeeId: 'employee-uuid-1',
			tasksCompleted: 5,
			attendanceDays: 4,
			idleHours: 1,
			workingHours: 8,
			activeSeconds: 28800,
			idleSeconds: 3600,
			telemetryDaysWithData: 4,
			segmentCount: 10,
			focusFragmentationIndex: 0.25,
			firstSeenOffsetMinutes: 15,
			lastSeenOffsetMinutes: 20,
			taskProgress: 50,
			daysLeft: 2,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'req-a',
		});

		expect(fetchCalls).toBe(2);
		expect(result.data).toMatchObject({
			tenant_id: 'tenant-uuid-1',
			employee_id: 'employee-uuid-1',
		});
		expect(result.traceId).toBe('trace-ai-1');
	});

	it('reuses cached token across two syncEmployeeData calls (single login)', async () => {
		let loginCount = 0;
		let dataCount = 0;

		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				loginCount += 1;
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'cached-token-x', expires_in: 7200 },
					})
				);
			}
			if (url.endsWith('/employee/data')) {
				dataCount += 1;
				return Promise.resolve(
					jsonResponse(true, 200, { status: 'success', data: { tenant_id: 't', employee_id: 'e' }, message: 'ok' })
				);
			}
			return Promise.reject(new Error(url));
		});

		await syncEmployeeData({
			tenantId: 't-same',
			employeeId: 'e-same',
			tasksCompleted: 0,
			attendanceDays: 0,
			idleHours: 0,
			workingHours: 0,
			taskProgress: 0,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'r1',
		});

		await syncEmployeeData({
			tenantId: 't-same',
			employeeId: 'e-same',
			tasksCompleted: 0,
			attendanceDays: 0,
			idleHours: 0,
			workingHours: 0,
			taskProgress: 0,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'r2',
		});

		expect(loginCount).toBe(1);
		expect(dataCount).toBe(2);
	});

	it('does not reuse cached token across different tenantIds (separate AI JWT per org)', async () => {
		let loginCount = 0;

		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				loginCount += 1;
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: `jwt-for-login-${loginCount}`, expires_in: 3600 },
					})
				);
			}
			if (url.endsWith('/employee/data')) {
				return Promise.resolve(
					jsonResponse(true, 200, { status: 'success', data: { tenant_id: 't', employee_id: 'e' }, message: 'ok' })
				);
			}
			return Promise.reject(new Error(url));
		});

		await syncEmployeeData({
			tenantId: 'org-a',
			employeeId: 'e1',
			tasksCompleted: 0,
			attendanceDays: 0,
			idleHours: 0,
			workingHours: 0,
			taskProgress: 0,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'r-a',
		});

		await syncEmployeeData({
			tenantId: 'org-b',
			employeeId: 'e2',
			tasksCompleted: 0,
			attendanceDays: 0,
			idleHours: 0,
			workingHours: 0,
			taskProgress: 0,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'r-b',
		});

		expect(loginCount).toBe(2);
	});

	it('throws AiServiceError when login fails', async () => {
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(false, 401, {
						status: 'error',
						message: 'Invalid service credentials',
						error_code: 'AUTH_FAIL',
						trace_id: 't-login',
						data: {},
					})
				);
			}
			return Promise.reject(new Error('unexpected'));
		});

		await expect(
			syncEmployeeData({
				tenantId: 'tx',
				employeeId: 'ex',
				tasksCompleted: 0,
				attendanceDays: 0,
				idleHours: 0,
				workingHours: 0,
				taskProgress: 0,
				daysLeft: 0,
				lateArrivals: 0,
				absentDays: 0,
				requestId: 'r-x',
			})
		).rejects.toMatchObject({
			statusCode: 401,
			errorCode: 'AUTH_FAIL',
		});
	});

	it('throws AiServiceError when employee/data responds non-OK', async () => {
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'tok-ok', expires_in: 3600 },
					})
				);
			}
			if (url.endsWith('/employee/data')) {
				return Promise.resolve(
					jsonResponse(false, 422, {
						status: 'error',
						message: 'Validation failed',
						error_code: 'VAL_FAIL',
						trace_id: 't-val',
						data: {},
					})
				);
			}
			return Promise.reject(new Error(url));
		});

		await expect(
			syncEmployeeData({
				tenantId: 'tx',
				employeeId: 'ex',
				tasksCompleted: 0,
				attendanceDays: 0,
				idleHours: 0,
				workingHours: 0,
				taskProgress: 0,
				daysLeft: 0,
				lateArrivals: 0,
				absentDays: 0,
				requestId: 'r-y',
			})
		).rejects.toMatchObject({
			statusCode: 422,
			errorCode: 'VAL_FAIL',
			traceId: 't-val',
		});
	});

	it('syncTaskData POSTs tasks with bearer and idempotency', async () => {
		let step = 0;
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL, init?: RequestInit) => {
			step += 1;
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'tok-task', expires_in: 3600 },
					})
				);
			}
			if (url.endsWith('/api/v1/tasks')) {
				expect(init?.method).toBe('POST');
				const parsed = JSON.parse(String(init?.body));
				expect(parsed).toMatchObject({
					tenant_id: 't-task',
					employee_id: 'e-task',
					task_id: 'task-1',
					progress_percent: 60,
				});

				return Promise.resolve(jsonResponse(true, 200, { status: 'success', data: parsed, message: 'ok' }));
			}
			return Promise.reject(new Error(url));
		});

		await syncTaskData({
			tenantId: 't-task',
			employeeId: 'e-task',
			taskId: 'task-1',
			progressPercent: 60,
			daysLeft: 1,
			requestId: 'req-task',
		});
		expect(step).toBe(2);
	});

	it('generateAnalyticsReport POSTs report with history', async () => {
		let reportBody: Record<string, unknown> | undefined;
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'tok-rep', expires_in: 3600 },
					})
				);
			}
			if (url.endsWith('/analytics/report')) {
				expect(init?.method).toBe('POST');
				reportBody = JSON.parse(String(init?.body));
				expect(Array.isArray(reportBody!.history)).toBe(true);
				expect(reportBody!.history).toHaveLength(1);

				const reportEnvelope = {
					productivity_score: 71,
					tenant_id: 'tre',
				};
				return Promise.resolve(
					jsonResponse(true, 200, { status: 'success', data: reportEnvelope, meta: {}, message: 'ok' })
				);
			}
			return Promise.reject(new Error(url));
		});

		const out = await generateAnalyticsReport({
			tenantId: 'tre',
			employeeId: 'emp-rep',
			tasksCompleted: 1,
			attendanceDays: 2,
			idleHours: 0,
			workingHours: 8,
			taskProgress: 70,
			daysLeft: 1,
			lateArrivals: 0,
			absentDays: 0,
			requestId: 'rq-rep',
			history: [{ date: '2026-05-01', productivityScore: 70, workingHours: 8, idleHours: 1 }],
		});

		expect(out.data).toMatchObject({
			productivity_score: 71,
			tenant_id: 'tre',
		});
		expect(reportBody).toHaveProperty('history');
	});

	it('fetchWeeklyReports GETs with tenant_id query', async () => {
		let gotUrl = '';
		jest.spyOn(global, 'fetch').mockImplementation((input: string | Request | URL, init?: RequestInit) => {
			const url = String(input);
			gotUrl = url;
			if (url.endsWith('/auth/login')) {
				return Promise.resolve(
					jsonResponse(true, 200, {
						status: 'success',
						data: { access_token: 'tok-week', expires_in: 3600 },
					})
				);
			}
			expect(init?.method).toBe('GET');
			if (url.includes('/reports/weekly/emp-weekly')) {
				expect(url).toContain('tenant_id=same-org');
				expect(url).toContain('limit=5');
				return Promise.resolve(
					jsonResponse(true, 200, { status: 'success', data: { reports_found: 1 }, message: 'ok' })
				);
			}
			return Promise.reject(new Error(url));
		});

		const res = await fetchWeeklyReports({
			tenantId: 'same-org',
			employeeId: 'emp-weekly',
			limit: 5,
			requestId: 'rq-week',
		});

		expect(gotUrl).toContain(`/reports/weekly/emp-weekly`);
		expect(res.data).toMatchObject({
			reports_found: 1,
		});
	});

	it('wraps AiServiceError for unknown failures', async () => {
		const err = new AiServiceError('x', 502, { traceId: 'zzz' });
		expect(err).toBeInstanceOf(Error);
		expect(err.statusCode).toBe(502);
		expect(err.traceId).toBe('zzz');
	});
});
