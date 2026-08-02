import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Small load smoke against portal health endpoints.
 * Run: k6 run tests/load/health-smoke.k6.js
 */
export const options = {
	vus: 5,
	duration: '15s',
	thresholds: {
		http_req_failed: ['rate<0.05'],
		http_req_duration: ['p(95)<2000'],
	},
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
	const live = http.get(`${BASE}/health`);
	check(live, {
		'live status 200': (r) => r.status === 200,
	});

	const ready = http.get(`${BASE}/health/ready`);
	check(ready, {
		'ready responded': (r) => r.status === 200 || r.status === 503,
	});

	sleep(0.5);
}
