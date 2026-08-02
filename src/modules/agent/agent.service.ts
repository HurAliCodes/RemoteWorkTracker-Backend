import { normalizeActivityRecord } from './agent.mapper';
import { insertActivityLogWithClient } from './agent.repository';
import { withTransaction } from '../../utils/withTransaction';
import { findIdempotencyResponse, saveIdempotencyResponse } from '../../utils/idempotency';

type ActivityItem = {
	deviceId: string;
	userId?: string;
	[key: string]: unknown;
};

/**
 * Persist an activity batch with optional idempotency.
 * Keeps agent HTTP envelope flat (`{ status, count, received }`) — documented exception.
 */
export async function recordActivityBatch(input: {
	tokenDeviceId: string;
	tokenUserId: string;
	activities: ActivityItem[];
	idempotencyKey?: string;
}) {
	const { tokenDeviceId, tokenUserId, activities, idempotencyKey } = input;

	if (idempotencyKey) {
		const cached = await findIdempotencyResponse('agent.activity', idempotencyKey);
		if (cached) return cached as { status: string; count: number; received: number };
	}

	return withTransaction(async (client) => {
		if (idempotencyKey) {
			const cached = await findIdempotencyResponse('agent.activity', idempotencyKey, client);
			if (cached) return cached as { status: string; count: number; received: number };
		}

		let saved = 0;
		for (const log of activities) {
			if (log.deviceId !== tokenDeviceId) continue;
			const row = normalizeActivityRecord({
				...log,
				userId: tokenUserId,
				deviceId: tokenDeviceId,
			});
			if (row) {
				await insertActivityLogWithClient(client, row);
				saved += 1;
			}
		}
		const payload = { status: 'ok', count: saved, received: activities.length };
		if (idempotencyKey) {
			await saveIdempotencyResponse(
				{
					scope: 'agent.activity',
					key: idempotencyKey,
					response: payload,
					deviceId: tokenDeviceId,
				},
				client
			);
		}
		return payload;
	});
}
