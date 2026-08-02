/**
 * Resilient HTTP helper: timeout, exponential backoff + jitter, simple circuit breaker.
 */

export type HttpClientOptions = {
	timeoutMs: number;
	maxRetries: number;
	baseDelayMs: number;
	circuitFailureThreshold: number;
	circuitCoolDownMs: number;
};

type CircuitState = {
	failures: number;
	openedAt: number | null;
};

const circuits = new Map<string, CircuitState>();

const DEFAULTS: HttpClientOptions = {
	timeoutMs: 15000,
	maxRetries: 3,
	baseDelayMs: 250,
	circuitFailureThreshold: 5,
	circuitCoolDownMs: 30000,
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base: number) {
	return base + Math.floor(Math.random() * base);
}

function getCircuit(key: string): CircuitState {
	let state = circuits.get(key);
	if (!state) {
		state = { failures: 0, openedAt: null };
		circuits.set(key, state);
	}
	return state;
}

export function resetHttpCircuits() {
	circuits.clear();
}

export function isCircuitOpen(key: string, opts: Partial<HttpClientOptions> = {}): boolean {
	const cfg = { ...DEFAULTS, ...opts };
	const state = getCircuit(key);
	if (state.openedAt == null) return false;
	if (Date.now() - state.openedAt >= cfg.circuitCoolDownMs) {
		state.openedAt = null;
		state.failures = 0;
		return false;
	}
	return true;
}

function recordSuccess(key: string) {
	const state = getCircuit(key);
	state.failures = 0;
	state.openedAt = null;
}

function recordFailure(key: string, opts: HttpClientOptions) {
	const state = getCircuit(key);
	state.failures += 1;
	if (state.failures >= opts.circuitFailureThreshold) {
		state.openedAt = Date.now();
	}
}

export class HttpClientError extends Error {
	status?: number;
	body?: unknown;
	constructor(message: string, status?: number, body?: unknown) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

export async function fetchWithResilience(
	url: string,
	init: RequestInit,
	opts: Partial<HttpClientOptions> & { circuitKey?: string } = {}
): Promise<Response> {
	const cfg = { ...DEFAULTS, ...opts };
	const circuitKey = opts.circuitKey || new URL(url).origin;

	if (isCircuitOpen(circuitKey, cfg)) {
		throw new HttpClientError('AI circuit breaker is open; failing fast', 503);
	}

	let lastError: unknown;
	for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
		try {
			const response = await fetch(url, {
				...init,
				signal: controller.signal,
			});
			clearTimeout(timer);

			if (response.status >= 500 || response.status === 429) {
				recordFailure(circuitKey, cfg);
				lastError = new HttpClientError(`Upstream ${response.status}`, response.status);
				if (attempt < cfg.maxRetries) {
					await sleep(jitter(cfg.baseDelayMs * Math.pow(2, attempt)));
					continue;
				}
				throw lastError;
			}

			recordSuccess(circuitKey);
			return response;
		} catch (err) {
			clearTimeout(timer);
			recordFailure(circuitKey, cfg);
			lastError = err;
			const aborted = err instanceof Error && err.name === 'AbortError';
			if (attempt < cfg.maxRetries) {
				await sleep(jitter(cfg.baseDelayMs * Math.pow(2, attempt)));
				continue;
			}
			if (aborted) {
				throw new HttpClientError(`Request timed out after ${cfg.timeoutMs}ms`, 504);
			}
			throw err instanceof HttpClientError
				? err
				: new HttpClientError(err instanceof Error ? err.message : 'Network error', 502);
		}
	}
	throw lastError instanceof Error ? lastError : new HttpClientError('Request failed');
}

export async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
	const text = await response.text();
	if (!text) return {};
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return { message: text.slice(0, 500), non_json: true };
	}
}
