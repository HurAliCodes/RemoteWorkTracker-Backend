/**
 * Consumer / DLQ unit tests with mocked amqplib.
 */
const consumeHandlerRef: { current: ((msg: any) => Promise<void>) | null } = { current: null };

const mockChannel = {
	assertQueue: jest.fn(async () => undefined),
	prefetch: jest.fn(),
	consume: jest.fn((_q: string, cb: (msg: any) => Promise<void>) => {
		consumeHandlerRef.current = cb;
		return Promise.resolve({ consumerTag: 't' });
	}),
	ack: jest.fn(),
	nack: jest.fn(),
	sendToQueue: jest.fn(),
	get: jest.fn(),
	close: jest.fn(async () => undefined),
};

const mockConnection = {
	createChannel: jest.fn(async () => mockChannel),
	on: jest.fn(),
	close: jest.fn(async () => undefined),
};

jest.mock('amqplib', () => ({
	__esModule: true,
	default: {
		connect: jest.fn(async () => mockConnection),
	},
}));

jest.mock('./ai.service', () => ({
	generateAnalyticsReport: jest.fn(async () => ({ data: { ok: true } })),
}));

import amqp from 'amqplib';
import { generateAnalyticsReport } from './ai.service';
import {
	aiConsumerMetrics,
	setupAiReportConsumer,
	stopAiReportConsumer,
	inspectDlqMessages,
	replayDlqMessages,
} from './ai.consumer';

function makeMsg(body: unknown, headers: Record<string, unknown> = {}) {
	return {
		content: Buffer.from(JSON.stringify(body)),
		properties: { headers },
	};
}

describe('ai.consumer resilience', () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		consumeHandlerRef.current = null;
		aiConsumerMetrics.consumed = 0;
		aiConsumerMetrics.succeeded = 0;
		aiConsumerMetrics.retried = 0;
		aiConsumerMetrics.deadLettered = 0;
		aiConsumerMetrics.invalid = 0;
		await stopAiReportConsumer();
	});

	afterEach(async () => {
		await stopAiReportConsumer();
	});

	it('acks successful report events', async () => {
		await setupAiReportConsumer({ throwOnFailure: true });
		expect(amqp.connect).toHaveBeenCalled();
		const handler = consumeHandlerRef.current!;
		await handler(
			makeMsg({
				type: 'ai:report:generate',
				tenantId: '11111111-1111-1111-1111-111111111111',
				requestId: 'r1',
				data: {
					tenantId: '11111111-1111-1111-1111-111111111111',
					employeeId: '22222222-2222-2222-2222-222222222222',
					tasksCompleted: 1,
					attendanceDays: 1,
					idleHours: 0,
					workingHours: 8,
					taskProgress: 50,
					daysLeft: 1,
					lateArrivals: 0,
					absentDays: 0,
					history: [],
				},
			})
		);
		expect(generateAnalyticsReport).toHaveBeenCalled();
		expect(mockChannel.ack).toHaveBeenCalled();
		expect(aiConsumerMetrics.succeeded).toBe(1);
	});

	it('dead-letters invalid payloads without retrying forever', async () => {
		await setupAiReportConsumer({ throwOnFailure: true });
		const handler = consumeHandlerRef.current!;
		await handler(
			makeMsg({
				type: 'ai:report:generate',
				tenantId: 't',
				requestId: 'bad',
				data: { not: 'valid' },
			})
		);
		expect(aiConsumerMetrics.invalid).toBe(1);
		expect(aiConsumerMetrics.deadLettered).toBe(1);
		expect(mockChannel.sendToQueue).toHaveBeenCalled();
		expect(mockChannel.ack).toHaveBeenCalled();
	});

	it('retries then dead-letters on processing failure', async () => {
		(generateAnalyticsReport as jest.Mock).mockRejectedValueOnce(new Error('boom'));
		await setupAiReportConsumer({ throwOnFailure: true });
		const handler = consumeHandlerRef.current!;
		const payload = {
			type: 'ai:report:generate',
			tenantId: '11111111-1111-1111-1111-111111111111',
			requestId: 'r2',
			data: {
				tenantId: '11111111-1111-1111-1111-111111111111',
				employeeId: '22222222-2222-2222-2222-222222222222',
				tasksCompleted: 1,
				attendanceDays: 1,
				idleHours: 0,
				workingHours: 8,
				taskProgress: 50,
				daysLeft: 1,
				lateArrivals: 0,
				absentDays: 0,
				history: [],
			},
		};
		await handler(makeMsg(payload, { 'x-retry-count': 0 }));
		expect(aiConsumerMetrics.retried).toBe(1);

		(generateAnalyticsReport as jest.Mock).mockRejectedValue(new Error('boom'));
		await handler(makeMsg(payload, { 'x-retry-count': 3 }));
		expect(aiConsumerMetrics.deadLettered).toBeGreaterThanOrEqual(1);
	});

	it('inspectDlqMessages returns staged messages', async () => {
		const dlqBody = {
			failedAt: new Date().toISOString(),
			retryCount: 3,
			error: 'x',
			message: JSON.stringify({
				type: 'ai:report:generate',
				tenantId: 'org-1',
				requestId: 'rq',
			}),
		};
		mockChannel.get.mockResolvedValueOnce({
			content: Buffer.from(JSON.stringify(dlqBody)),
			properties: { headers: {} },
		});
		mockChannel.get.mockResolvedValueOnce(false);
		const msgs = await inspectDlqMessages(5);
		expect(msgs[0].tenantId).toBe('org-1');
		expect(mockChannel.nack).toHaveBeenCalled();
	});

	it('replayDlqMessages requeues original payload', async () => {
		const dlqBody = {
			failedAt: new Date().toISOString(),
			retryCount: 3,
			error: 'x',
			message: JSON.stringify({
				type: 'ai:report:generate',
				tenantId: 'org-1',
				requestId: 'rq',
			}),
		};
		mockChannel.get.mockResolvedValueOnce({
			content: Buffer.from(JSON.stringify(dlqBody)),
			properties: { headers: {} },
		});
		mockChannel.get.mockResolvedValueOnce(false);
		const result = await replayDlqMessages(5);
		expect(result.replayed).toBe(1);
		expect(mockChannel.sendToQueue).toHaveBeenCalled();
		expect(mockChannel.ack).toHaveBeenCalled();
	});
});
