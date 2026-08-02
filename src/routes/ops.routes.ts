import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { ENV } from '../config/env';
import { isAiIntegrationConfigured } from '../modules/ai/ai.service';
import { checkRabbitMqReady } from '../utils/rabbitmq';
import { AI_SLOS, renderPrometheusMetrics } from '../utils/metrics';
import { aiConsumerMetrics } from '../modules/ai/ai.consumer';

const router = Router();

async function checkDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
	const start = Date.now();
	try {
		await pool.query('SELECT 1');
		return { ok: true, latencyMs: Date.now() - start };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

async function checkAi(): Promise<{ ok: boolean; configured: boolean; error?: string }> {
	const configured = isAiIntegrationConfigured();
	if (!configured) return { ok: true, configured: false };
	try {
		const base = ENV.AI_SERVER_BASE_URL.replace(/\/+$/, '');
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		const res = await fetch(`${base}/health/live`, { signal: controller.signal });
		clearTimeout(timer);
		return { ok: res.ok, configured: true };
	} catch (err) {
		return {
			ok: false,
			configured: true,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

router.get('/health/ready', async (_req: Request, res: Response) => {
	const [db, ai] = await Promise.all([checkDb(), checkAi()]);
	const queueConfigured = Boolean(ENV.RABBITMQ_URL);
	const queueOk = queueConfigured ? await checkRabbitMqReady() : true;
	const ready = db.ok && (!queueConfigured || queueOk);

	res.status(ready ? 200 : 503).json({
		status: ready ? 'ready' : 'not_ready',
		checks: {
			database: db,
			rabbitmq: { configured: queueConfigured, ok: queueOk },
			ai: ai,
		},
		slos: AI_SLOS,
		aiConsumerMetrics,
		uptime: process.uptime(),
		env: ENV.NODE_ENV,
	});
});

router.get('/metrics', (_req: Request, res: Response) => {
	res.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
	res.send(renderPrometheusMetrics());
});

export default router;
