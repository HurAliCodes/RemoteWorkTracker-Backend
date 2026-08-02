/**
 * One-shot smoke checks against a running backend (+ optional ai-server).
 * Usage: npx ts-node scripts/smoke-seeded-apis.ts
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000';
const AI = process.env.SMOKE_AI_URL || 'http://127.0.0.1:8000';

type Row = { name: string; ok: boolean; status: number; detail: string };

async function req(
	name: string,
	method: string,
	path: string,
	token?: string,
	body?: unknown,
	base = BASE
): Promise<Row> {
	try {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (token) headers.Authorization = `Bearer ${token}`;
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		const res = await fetch(`${base}${path}`, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		const text = await res.text();
		const detail = text.length > 220 ? `${text.slice(0, 220)}…` : text;
		return { name, ok: res.ok, status: res.status, detail };
	} catch (err) {
		return {
			name,
			ok: false,
			status: 0,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

function pickToken(json: any): string {
	return (
		json?.accessToken ||
		json?.data?.accessToken ||
		json?.token ||
		json?.data?.token ||
		''
	);
}

function pickUserId(json: any): string {
	return json?.user?.userId || json?.data?.user?.userId || json?.data?.userId || '';
}

async function main() {
	const rows: Row[] = [];
	rows.push(await req('GET /health', 'GET', '/health'));
	rows.push(await req('AI /health/live', 'GET', '/health/live', undefined, undefined, AI));

	const orgRes = await fetch(`${BASE}/api/v1/organizations/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: 'admin@acme.test', password: 'Password1!' }),
	});
	const orgJson = await orgRes.json().catch(() => ({}));
	const orgToken = pickToken(orgJson);
	rows.push({
		name: 'POST /organizations/login',
		ok: orgRes.ok && Boolean(orgToken),
		status: orgRes.status,
		detail: orgToken ? `tokenLen=${orgToken.length}` : JSON.stringify(orgJson).slice(0, 220),
	});

	const empRes = await fetch(`${BASE}/api/v1/users/sign-in`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: 'admin.acmecorporation@example.com',
			password: 'Password1!',
		}),
	});
	const empJson = await empRes.json().catch(() => ({}));
	const empToken = pickToken(empJson);
	const empId = pickUserId(empJson);
	rows.push({
		name: 'POST /users/sign-in',
		ok: empRes.ok && Boolean(empToken),
		status: empRes.status,
		detail: empToken
			? `tokenLen=${empToken.length} userId=${empId || '?'}`
			: JSON.stringify(empJson).slice(0, 220),
	});

	const day = new Date().toISOString().slice(0, 10);
	const checks: Array<[string, string, string, string?, unknown?]> = [
		['GET /organizations/users', 'GET', '/api/v1/organizations/users', orgToken],
		['GET /projects', 'GET', '/api/v1/projects', orgToken],
		['GET /tasks', 'GET', '/api/v1/tasks', orgToken],
		['GET /goals', 'GET', '/api/v1/goals', orgToken],
		['GET /payroll', 'GET', '/api/v1/payroll', orgToken],
		['GET /courses', 'GET', '/api/v1/courses', orgToken],
		['GET /courses/enrollments', 'GET', '/api/v1/courses/enrollments', orgToken],
		['GET /wellness', 'GET', '/api/v1/wellness', orgToken],
		['GET /notifications', 'GET', '/api/v1/notifications', empToken],
		['GET /attendance', 'GET', '/api/v1/attendance', orgToken],
		['GET /attendance/me', 'GET', '/api/v1/attendance/me', empToken],
		['GET /attendance/geo-fences', 'GET', '/api/v1/attendance/geo-fences', orgToken],
		['GET /dashboard/summary', 'GET', '/api/v1/dashboard/summary', orgToken],
		['GET /telemetry/agent/daily', 'GET', `/api/v1/telemetry/agent/daily?startDate=${day}&endDate=${day}`, orgToken],
		['GET /telemetry/agent/desk-latest', 'GET', `/api/v1/telemetry/agent/desk-latest?day=${day}`, orgToken],
		['GET /compliance/rules', 'GET', '/api/v1/compliance/rules', orgToken],
		['GET /compliance/violations', 'GET', '/api/v1/compliance/violations', orgToken],
		['GET /performance', 'GET', '/api/v1/performance', orgToken],
		['GET /analytics/overview', 'GET', '/api/v1/analytics/overview', orgToken],
		['GET /analytics/productivity', 'GET', '/api/v1/analytics/productivity', orgToken],
		['GET /analytics/team-performance', 'GET', '/api/v1/analytics/team-performance', orgToken],
		['GET /analytics/ai-performance-ranking', 'GET', '/api/v1/analytics/ai-performance-ranking', orgToken],
		['GET /departments', 'GET', '/api/v1/departments', orgToken],
		['GET /roles', 'GET', '/api/v1/roles', orgToken],
		['GET /users/profile', 'GET', '/api/v1/users/profile', empToken],
		['POST /agent/pairing-code', 'POST', '/api/v1/agent/pairing-code', empToken, { expiresInMinutes: 10 }],
	];

	for (const [name, method, path, token, body] of checks) {
		rows.push(await req(name, method, path, token, body));
	}

	const aiPayload = {
		employeeId: empId || '00000000-0000-4000-8000-000000000001',
		tasksCompleted: 5,
		attendanceDays: 12,
		idleHours: 3,
		workingHours: 40,
		taskProgress: 70,
		daysLeft: 5,
		lateArrivals: 1,
		absentDays: 0,
	};
	rows.push(await req('POST /ai/employee-data', 'POST', '/api/v1/ai/employee-data', empToken, aiPayload));
	rows.push(
		await req('POST /ai/report', 'POST', '/api/v1/ai/report', empToken, {
			...aiPayload,
			history: [],
		})
	);
	if (empId) {
		rows.push(await req('GET /ai/reports/:id', 'GET', `/api/v1/ai/reports/${empId}`, empToken));
		rows.push(
			await req('POST /analytics/ai-report/generate', 'POST', '/api/v1/analytics/ai-report/generate', orgToken, {
				employeeId: empId,
			})
		);
		rows.push(
			await req('GET /analytics/ai-reports/:id', 'GET', `/api/v1/analytics/ai-reports/${empId}`, orgToken)
		);
	}

	const pass = rows.filter((r) => r.ok).length;
	const fail = rows.filter((r) => !r.ok);
	for (const r of rows) {
		console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.status}] ${r.name}`);
		if (!r.ok) console.log(`      ${r.detail}`);
	}
	console.log(`\nSummary: ${pass}/${rows.length} passed, ${fail.length} failed`);
	if (fail.length) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
