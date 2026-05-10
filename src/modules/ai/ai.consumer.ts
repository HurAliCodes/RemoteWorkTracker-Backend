import amqp from 'amqplib';
import logger from '../../config/logger';
import { generateAnalyticsReport } from './ai.service';
import { reportSyncSchema } from './ai.validation';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const AI_QUEUE = 'ai_events';
const AI_DLQ = 'ai_events_dlq';
const MAX_RETRIES = 3;
const metrics = {
	consumed: 0,
	succeeded: 0,
	retried: 0,
	deadLettered: 0,
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

function getRetryCount(msg: amqp.ConsumeMessage): number {
	const raw = msg.properties.headers?.['x-retry-count'];
	if (typeof raw === 'number') return raw;
	if (typeof raw === 'string') return Number(raw) || 0;
	return 0;
}

export async function setupAiReportConsumer() {
	try {
		const connection = await amqp.connect(RABBITMQ_URL);
		const channel = await connection.createChannel();
		await channel.assertQueue(AI_QUEUE, { durable: true });
		await channel.assertQueue(AI_DLQ, { durable: true });
		channel.prefetch(5);

		channel.consume(AI_QUEUE, async (msg: amqp.ConsumeMessage | null) => {
			if (!msg) return;
			metrics.consumed += 1;
			const retryCount = getRetryCount(msg);
			try {
				const event = JSON.parse(msg.content.toString()) as AiReportEvent;
				if (event.type !== 'ai:report:generate') {
					channel.ack(msg);
					return;
				}

				const parsed = reportSyncSchema.safeParse(event.data);
				if (!parsed.success) {
					logger.warn('Invalid AI report event payload', {
						requestId: event.requestId,
						errors: parsed.error.flatten(),
					});
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
					metrics,
				});
				metrics.succeeded += 1;
				channel.ack(msg);
			} catch (err) {
				if (retryCount < MAX_RETRIES) {
					channel.sendToQueue(AI_QUEUE, msg.content, {
						persistent: true,
						headers: {
							...msg.properties.headers,
							'x-retry-count': retryCount + 1,
						},
					});
					metrics.retried += 1;
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
				metrics.deadLettered += 1;
				logger.error('Failed to process ai_events message after retries', {
					retryCount,
					error: err instanceof Error ? err.message : String(err),
					metrics,
				});
				channel.ack(msg);
			}
		});

		logger.info('AI report consumer started', { queue: AI_QUEUE });
	} catch (err) {
		logger.error('Failed to start AI report consumer', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

export async function inspectDlqMessages(limit: number, tenantId?: string) {
	const connection = await amqp.connect(RABBITMQ_URL);
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
	const connection = await amqp.connect(RABBITMQ_URL);
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
