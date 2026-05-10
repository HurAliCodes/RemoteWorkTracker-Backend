import type { AiEmployeeSnapshot } from './ai.snapshot.types';

export type TelemetryOptionalForSync = Partial<
	Pick<
		AiEmployeeSnapshot,
		| 'activeSeconds'
		| 'idleSeconds'
		| 'telemetryDaysWithData'
		| 'segmentCount'
		| 'focusFragmentationIndex'
		| 'firstSeenOffsetMinutes'
		| 'lastSeenOffsetMinutes'
	>
>;

export type EmployeeSyncInput = Omit<AiEmployeeSnapshot, keyof TelemetryOptionalForSync> & TelemetryOptionalForSync;

type TaskSyncInput = {
	tenantId: string;
	employeeId: string;
	taskId: string;
	progressPercent: number;
	daysLeft: number;
};

type ReportSyncInput = EmployeeSyncInput & {
	history: Array<{
		date: string;
		productivityScore: number;
		workingHours: number;
		idleHours: number;
	}>;
};

export function telemetryExtrasForAiPayload(input: Partial<AiEmployeeSnapshot>) {
	const wh = Number(input.workingHours ?? 0);
	const ih = Number(input.idleHours ?? 0);
	const activeSeconds = input.activeSeconds ?? Math.round(wh * 3600);
	const idleSeconds = input.idleSeconds ?? Math.round(ih * 3600);
	const attendanceDays = input.attendanceDays ?? 0;

	return {
		active_seconds: activeSeconds,
		idle_seconds: idleSeconds,
		telemetry_days_with_data:
			input.telemetryDaysWithData !== undefined ? input.telemetryDaysWithData : attendanceDays,
		segment_count: input.segmentCount ?? 0,
		focus_fragmentation_index: input.focusFragmentationIndex ?? 0,
		first_seen_offset_minutes: input.firstSeenOffsetMinutes ?? 0,
		last_seen_offset_minutes: input.lastSeenOffsetMinutes ?? 0,
	};
}

export function mapEmployeeInputToAiPayload(input: EmployeeSyncInput): Record<string, unknown> {
	return {
		tenant_id: input.tenantId,
		employee_id: input.employeeId,
		tasks_completed: input.tasksCompleted,
		attendance_days: input.attendanceDays,
		idle_hours: input.idleHours,
		working_hours: input.workingHours,
		task_progress: input.taskProgress,
		days_left: input.daysLeft,
		late_arrivals: input.lateArrivals,
		absent_days: input.absentDays,
		...telemetryExtrasForAiPayload(input),
	};
}

export function mapTaskInputToAiPayload(input: TaskSyncInput) {
	return {
		tenant_id: input.tenantId,
		employee_id: input.employeeId,
		task_id: input.taskId,
		progress_percent: input.progressPercent,
		days_left: input.daysLeft,
	};
}

export function mapReportInputToAiPayload(input: ReportSyncInput) {
	return {
		...mapEmployeeInputToAiPayload(input),
		history: input.history.map((point) => ({
			date: point.date,
			productivity_score: point.productivityScore,
			working_hours: point.workingHours,
			idle_hours: point.idleHours,
		})),
	};
}
