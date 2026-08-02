import amqp from 'amqplib';
import { ENV } from '../config/env';
import logger from '../config/logger';

const RABBITMQ_URL = ENV.RABBITMQ_URL || 'amqp://localhost';
const QUEUE = 'task_events';
export const AI_QUEUE = 'ai_events';
export const AI_DLQ = 'ai_events_dlq';

/** amqplib typings vary by version; keep a structural connection handle. */
type AmqpConn = {
	createChannel: () => Promise<AmqpChannel>;
	createConfirmChannel?: () => Promise<AmqpConfirmChannel>;
	on: (event: string, listener: (...args: unknown[]) => void) => void;
	close: () => Promise<void>;
};

type AmqpChannel = {
	assertQueue: (queue: string, options?: { durable?: boolean }) => Promise<unknown>;
	sendToQueue: (queue: string, content: Buffer, options?: { persistent?: boolean }) => boolean;
	close: () => Promise<void>;
};

type AmqpConfirmChannel = AmqpChannel & {
	sendToQueue: (
		queue: string,
		content: Buffer,
		options?: { persistent?: boolean },
		cb?: (err: Error | null) => void
	) => boolean;
	waitForConfirms?: () => Promise<void>;
};

let sharedConnection: AmqpConn | null = null;
let connecting: Promise<AmqpConn> | null = null;

async function getConnection(): Promise<AmqpConn> {
	if (sharedConnection) return sharedConnection;
	if (connecting) return connecting;

	connecting = (async () => {
		const conn = (await amqp.connect(RABBITMQ_URL)) as unknown as AmqpConn;
		conn.on('error', (err: unknown) => {
			logger.warn('[rabbitmq] connection error', {
				error: err instanceof Error ? err.message : String(err),
			});
			sharedConnection = null;
		});
		conn.on('close', () => {
			logger.warn('[rabbitmq] connection closed');
			sharedConnection = null;
		});
		sharedConnection = conn;
		return conn;
	})().finally(() => {
		connecting = null;
	});

	return connecting;
}

async function withChannel<T>(fn: (ch: AmqpConfirmChannel | AmqpChannel) => Promise<T>): Promise<T> {
	const conn = await getConnection();
	const channel = conn.createConfirmChannel
		? await conn.createConfirmChannel()
		: await conn.createChannel();
	try {
		return await fn(channel);
	} finally {
		await channel.close().catch(() => undefined);
	}
}

async function publishPersistent(queue: string, payload: unknown) {
	await withChannel(async (channel) => {
		await channel.assertQueue(queue, { durable: true });
		const body = Buffer.from(JSON.stringify(payload));
		channel.sendToQueue(queue, body, { persistent: true });
		const confirm = channel as AmqpConfirmChannel;
		if (typeof confirm.waitForConfirms === 'function') {
			await confirm.waitForConfirms();
		}
	});
}

export async function publishTaskEvent(event: { type: string; userId?: string; projectId?: string; data: any }) {
	await publishPersistent(QUEUE, event);
}

export const publishProjectEvent = publishTaskEvent;

export async function publishAiEvent(event: {
	type: string;
	tenantId: string;
	requestId: string;
	data: any;
}) {
	await publishPersistent(AI_QUEUE, event);
}

export async function checkRabbitMqReady(): Promise<boolean> {
	if (!ENV.RABBITMQ_URL) return false;
	try {
		const conn = await getConnection();
		const ch = await conn.createChannel();
		await ch.close();
		return true;
	} catch {
		return false;
	}
}
