/** Fields sent to the AI server (camelCase); extends base engagement metrics with telemetry scalars. */
export type AiEmployeeSnapshot = {
	tenantId: string;
	employeeId: string;
	tasksCompleted: number;
	attendanceDays: number;
	idleHours: number;
	workingHours: number;
	taskProgress: number;
	daysLeft: number;
	lateArrivals: number;
	absentDays: number;
	activeSeconds: number;
	idleSeconds: number;
	telemetryDaysWithData: number;
	segmentCount: number;
	focusFragmentationIndex: number;
	firstSeenOffsetMinutes: number;
	lastSeenOffsetMinutes: number;
};
