/**
 * Manual smoke test: AI server health + service login.
 * Run from backend directory: npx ts-node scripts/check-ai-connection.ts
 * Does not run under Jest.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const baseUrl = String(process.env.AI_SERVER_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const clientId = process.env.AI_SERVICE_CLIENT_ID || '';
const clientSecret = process.env.AI_SERVICE_CLIENT_SECRET || '';
const tenantId = process.argv[2]?.trim() || 'smoke-test-tenant';

async function ping(pathname: string) {
	const res = await fetch(`${baseUrl}${pathname}`);
	const text = await res.text();
	return { ok: res.ok, status: res.status, text };
}

async function main() {
	console.log('[check-ai-connection] AI_SERVER_BASE_URL =', baseUrl);

	const live = await ping('/health/live');
	console.log('[check-ai-connection] GET /health/live', live.ok ? 'OK' : 'FAIL', live.status, live.text?.slice(0, 120));

	const ready = await ping('/health/ready');
	console.log('[check-ai-connection] GET /health/ready', ready.ok ? 'OK' : 'FAIL', ready.status, ready.text?.slice(0, 200));

	if (!clientId || !clientSecret) {
		console.warn('[check-ai-connection] AI_SERVICE_CLIENT_ID / AI_SERVICE_CLIENT_SECRET not set — skipping login probe.');
		process.exit(live.ok && ready.ok ? 0 : 1);
	}

	const loginUrl = `${baseUrl}/api/v1/auth/login`;
	const loginBody = JSON.stringify({
		client_id: clientId,
		client_secret: clientSecret,
		tenant_id: tenantId,
		scopes: (process.env.AI_DEFAULT_SCOPES || 'analytics:write analytics:read').split(' ').filter(Boolean),
	});

	const lr = await fetch(loginUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: loginBody,
	});
	const lj = (await lr.json()) as { data?: { access_token?: string }; message?: string };
	const tokenLen = lj?.data?.access_token?.length ?? 0;
	console.log(
		'[check-ai-connection] POST /api/v1/auth/login',
		lr.ok ? 'OK' : 'FAIL',
		lr.status,
		tokenLen ? `token length ${tokenLen}` : lj.message || lj
	);

	const okAll = live.ok && ready.ok && lr.ok && tokenLen > 0;
	process.exit(okAll ? 0 : 1);
}

main().catch((err) => {
	console.error('[check-ai-connection] error', err);
	process.exit(1);
});
