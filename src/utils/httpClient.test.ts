/**
 * Resilient HTTP helper tests: timeout, retry, circuit breaker.
 */
import {
	fetchWithResilience,
	HttpClientError,
	isCircuitOpen,
	readJsonSafe,
	resetHttpCircuits,
} from './httpClient';

function mockResponse(status: number, body: string, ok?: boolean): Response {
	const isOk = ok ?? (status >= 200 && status < 300);
	return {
		ok: isOk,
		status,
		text: async () => body,
		json: async () => JSON.parse(body || '{}'),
		headers: { get: () => null },
	} as unknown as Response;
}

describe('httpClient', () => {
	beforeEach(() => {
		resetHttpCircuits();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it('returns response on success', async () => {
		jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse(200, '{"ok":true}'));
		const res = await fetchWithResilience(
			'http://example.test/ok',
			{ method: 'GET' },
			{ maxRetries: 0, circuitKey: 't-ok' }
		);
		expect(res.status).toBe(200);
	});

	it('retries on 503 then succeeds', async () => {
		const fetchSpy = jest
			.spyOn(global, 'fetch')
			.mockResolvedValueOnce(mockResponse(503, 'busy'))
			.mockResolvedValueOnce(mockResponse(200, '{"ok":true}'));

		const res = await fetchWithResilience(
			'http://example.test/retry',
			{ method: 'GET' },
			{ maxRetries: 2, baseDelayMs: 1, circuitKey: 't-retry', circuitFailureThreshold: 99 }
		);
		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it('opens circuit after repeated failures', async () => {
		jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
		const key = 't-circuit';
		for (let i = 0; i < 5; i++) {
			await expect(
				fetchWithResilience('http://example.test/fail', { method: 'GET' }, {
					maxRetries: 0,
					circuitKey: key,
					circuitFailureThreshold: 5,
					circuitCoolDownMs: 60_000,
				})
			).rejects.toBeInstanceOf(HttpClientError);
		}
		expect(isCircuitOpen(key, { circuitCoolDownMs: 60_000 })).toBe(true);
		await expect(
			fetchWithResilience('http://example.test/fail', { method: 'GET' }, {
				maxRetries: 0,
				circuitKey: key,
				circuitCoolDownMs: 60_000,
			})
		).rejects.toMatchObject({ message: expect.stringContaining('circuit breaker') });
	});

	it('readJsonSafe handles non-JSON bodies', async () => {
		const res = mockResponse(500, 'Internal Server Error plain text');
		const body = await readJsonSafe(res);
		expect(body.non_json).toBe(true);
		expect(String(body.message)).toContain('Internal Server Error');
	});
});
