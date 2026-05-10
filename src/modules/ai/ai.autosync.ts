import crypto from 'crypto';
import logger from '../../config/logger';
import { syncTaskData } from './ai.service';

type TaskSyncSnapshot = {
	tenantId: string;
	employeeId: string;
	taskId: string;
	progressPercent: number;
	daysLeft: number;
};

function toSafeProgress(status: unknown): number {
	if (typeof status !== 'string') return 0;
	const normalized = status.trim().toLowerCase();
	if (['done', 'completed', 'closed'].includes(normalized)) return 100;
	if (['in_progress', 'in progress', 'active'].includes(normalized)) return 50;
	return 0;
}

export function buildTaskSyncSnapshot(input: {
	tenantId: string;
	taskId: string;
	employeeId: string;
	status?: unknown;
}): TaskSyncSnapshot {
	return {
		tenantId: input.tenantId,
		taskId: input.taskId,
		employeeId: input.employeeId,
		progressPercent: toSafeProgress(input.status),
		daysLeft: 0,
	};
}

export async function syncTaskLifecycleToAi(snapshot: TaskSyncSnapshot): Promise<void> {
	try {
		await syncTaskData({ ...snapshot, requestId: crypto.randomUUID() });
	} catch (err) {
		logger.warn('AI task lifecycle auto-sync skipped/failed', {
			tenantId: snapshot.tenantId,
			taskId: snapshot.taskId,
			employeeId: snapshot.employeeId,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}
