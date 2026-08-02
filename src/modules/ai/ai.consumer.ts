import amqp from 'amqplib';
import logger from '../../config/logger';
import { ENV } from '../../config/env';
import { generateAnalyticsReport } from './ai.service';
import { reportSyncSchema } from './ai.validation';
import { AI_DLQ, AI_QUEUE } from '../../utils/rabbitmq';

const RABBITMQ_URL = ENV.RABBITMQ_URL || 'amqp://localhost';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export const aiConsumerMetrics = {
	consumed: 0,
	succeeded: 0,
	retried: 0,
	deadLettered: 0,
	invalid: 0,
	reconnects: 0,
};

type AiReportEvent = {
	type: 'ai:report:generate';
	tenantId: string;
	requestId: string;
	data: unknown;
};

type DlqStoredMessage = {
	failedAt: string;
	retryCount: number;
	error: string;
	message: string;
	headers?: Record<string, unknown>;
};

let consumerStarted = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let activeConnection: { close: () => Promise<void>; on: (e: string, fn: (...args: unknown[]) => void) => void } | null =
	null;

function getRetryCount(msg: amqp.ConsumeMessage): number {
	const raw = msg.properties.headers?.['x-retry-count'];
	if (typeof raw === 'number') return raw;
	if (typeof raw === 'string') return Number(raw) || 0;
	return 0;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processMessage(channel: amqp.Channel, msg: amqp.ConsumeMessage) {
	aiConsumerMetrics.consumed += 1;
	const retryCount = getRetryCount(msg);
	try {
		const event = JSON.parse(msg.content.toString()) as AiReportEvent;
		if (event.type !== 'ai:report:generate') {
			channel.ack(msg);
			return;
		}

		const parsed = reportSyncSchema.safeParse(event.data);
		if (!parsed.success) {
			aiConsumerMetrics.invalid += 1;
			logger.warn('Invalid AI report event payload', {
				requestId: event.requestId,
				errors: parsed.error.flatten(),
			});
			// Invalid payloads are not retryable — ack and optionally DLQ for diagnosis
			const failedAt = new Date().toISOString();
			channel.sendToQueue(
				AI_DLQ,
				Buffer.from(
					JSON.stringify({
						failedAt,
						retryCount,
						error: 'Invalid payload',
						message: msg.content.toString(),
						headers: msg.properties.headers ?? {},
					})
				),
				{
					persistent: true,
					headers: {
						...msg.properties.headers,
						'x-original-queue': AI_QUEUE,
						'x-failed-at': failedAt,
						'x-reason': 'invalid_payload',
					},
				}
			);
			aiConsumerMetrics.deadLettered += 1;
			channel.ack(msg);
			return;
		}

		await generateAnalyticsReport({
			...parsed.data,
			requestId: event.requestId,
			tenantId: event.tenantId,
		});
		logger.info('Processed ai:report:generate event', {
			requestId: event.requestId,
			tenantId: event.tenantId,
			metrics: { ...aiConsumerMetrics },
		});
		aiConsumerMetrics.succeeded += 1;
		channel.ack(msg);
	} catch (err) {
		if (retryCount < MAX_RETRIES) {
			const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
			await sleep(delay);
			channel.sendToQueue(AI_QUEUE, msg.content, {
				persistent: true,
				headers: {
					...msg.properties.headers,
					'x-retry-count': retryCount + 1,
					'x-last-error': err instanceof Error ? err.message : String(err),
				},
			});
			aiConsumerMetrics.retried += 1;
			channel.ack(msg);
			return;
		}

		const failedAt = new Date().toISOString();
		const deadLetterPayload = {
			failedAt,
			retryCount,
			error: err instanceof Error ? err.message : String(err),
			message: msg.content.toString(),
			headers: msg.properties.headers ?? {},
		};
		channel.sendToQueue(AI_DLQ, Buffer.from(JSON.stringify(deadLetterPayload)), {
			persistent: true,
			headers: {
				...msg.properties.headers,
				'x-original-queue': AI_QUEUE,
				'x-failed-at': failedAt,
			},
		});
		aiConsumerMetrics.deadLettered += 1;
		logger.error('Failed to process ai_events message after retries', {
			retryCount,
			error: err instanceof Error ? err.message : String(err),
			metrics: { ...aiConsumerMetrics },
		});
		channel.ack(msg);
	}
}

function scheduleReconnect(fatal: boolean) {
	if (reconnectTimer) return;
	const delay = ENV.RABBITMQ_RECONNECT_MS;
	logger.warn('Scheduling AI consumer reconnect', { delayMs: delay, fatal });
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		aiConsumerMetrics.reconnects += 1;
		consumerStarted = false;
		void setupAiReportConsumer({ throwOnFailure: false });
	}, delay);
}

/**
 * Start the AI report consumer with reconnect/backoff.
 * When `throwOnFailure` is true (worker mode), startup failure exits the process path to the caller.
 */
export async function setupAiReportConsumer(opts: { throwOnFailure?: boolean } = {}) {
	const throwOnFailure = opts.throwOnFailure ?? false;
	if (consumerStarted) return;
	consumerStarted = true;

	try {
		const connection = (await amqp.connect(RABBITMQ_URL)) as unknown as {
			createChannel: () => Promise<amqp.Channel>;
			on: (event: string, listener: (...args: unknown[]) => void) => void;
			close: () => Promise<void>;
		};
		activeConnection = connection;
		const channel = await connection.createChannel();
		await channel.assertQueue(AI_QUEUE, { durable: true });
		await channel.assertQueue(AI_DLQ, { durable: true });
		channel.prefetch(ENV.RABBITMQ_PREFETCH);

		connection.on('error', (err) => {
			logger.warn('AI consumer connection error', {
				error: err instanceof Error ? err.message : String(err),
			});
		});
		connection.on('close', () => {
			logger.warn('AI consumer connection closed');
			activeConnection = null;
			consumerStarted = false;
			scheduleReconnect(false);
		});

		channel.consume(AI_QUEUE, async (msg: amqp.ConsumeMessage | null) => {
			if (!msg) return;
			await processMessage(channel, msg);
		});

		logger.info('AI report consumer started', { queue: AI_QUEUE, prefetch: ENV.RABBITMQ_PREFETCH });
	} catch (err) {
		consumerStarted = false;
		logger.error('Failed to start AI report consumer', {
			error: err instanceof Error ? err.message : String(err),
		});
		if (throwOnFailure) {
			throw err instanceof Error ? err : new Error(String(err));
		}
		scheduleReconnect(true);
	}
}

export async function stopAiReportConsumer() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (activeConnection) {
		await activeConnection.close().catch(() => undefined);
		activeConnection = null;
	}
	consumerStarted = false;
}

export async function inspectDlqMessages(limit: number, tenantId?: string) {
	const connection = (await amqp.connect(RABBITMQ_URL)) as unknown as {
		createChannel: () => Promise<amqp.Channel>;
		close: () => Promise<void>;
	};
	const channel = await connection.createChannel();
	try {
		await channel.assertQueue(AI_DLQ, { durable: true });
		const messages: Array<Record<string, unknown>> = [];
		const staged: Array<amqp.GetMessage> = [];
		for (let i = 0; i < limit; i++) {
			const msg = await channel.get(AI_DLQ, { noAck: false });
			if (!msg) break;
			staged.push(msg);
			try {
				const parsed = JSON.parse(msg.content.toString()) as DlqStoredMessage;
				const originalEvent = JSON.parse(parsed.message) as Partial<AiReportEvent>;
				if (tenantId && originalEvent.tenantId !== tenantId) {
					continue;
				}
				messages.push({
					failedAt: parsed.failedAt,
					error: parsed.error,
					retryCount: parsed.retryCount,
					tenantId: originalEvent.tenantId,
					requestId: originalEvent.requestId,
					eventType: originalEvent.type,
				});
			} catch {
				messages.push({
					failedAt: null,
					error: 'Unparseable DLQ payload',
					retryCount: null,
				});
			}
		}
		for (const msg of staged) {
			channel.nack(msg, false, true);
		}
		return messages;
	} finally {
		await channel.close();
		await connection.close();
	}
}

export async function replayDlqMessages(limit: number, tenantId?: string) {
	const connection = (await amqp.connect(RABBITMQ_URL)) as unknown as {
		createChannel: () => Promise<amqp.Channel>;
		close: () => Promise<void>;
	};
	const channel = await connection.createChannel();
	try {
		await channel.assertQueue(AI_DLQ, { durable: true });
		await channel.assertQueue(AI_QUEUE, { durable: true });
		let replayed = 0;
		let scanned = 0;

		while (scanned < limit) {
			const msg = await channel.get(AI_DLQ, { noAck: false });
			if (!msg) break;
			scanned += 1;
			try {
				const parsed = JSON.parse(msg.content.toString()) as DlqStoredMessage;
				const originalEvent = JSON.parse(parsed.message) as Partial<AiReportEvent>;
				if (tenantId && originalEvent.tenantId !== tenantId) {
					channel.nack(msg, false, true);
					continue;
				}

				channel.sendToQueue(AI_QUEUE, Buffer.from(parsed.message), {
					persistent: true,
					headers: {
						...(msg.properties.headers || {}),
						'x-retry-count': 0,
						'x-replayed-at': new Date().toISOString(),
					},
				});
				channel.ack(msg);
				replayed += 1;
			} catch {
				channel.ack(msg);
			}
		}

		return { replayed, scanned };
	} finally {
		await channel.close();
		await connection.close();
	}
}
