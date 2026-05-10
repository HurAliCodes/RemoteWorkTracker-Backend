import {
	mapEmployeeInputToAiPayload,
	mapReportInputToAiPayload,
	mapTaskInputToAiPayload,
} from './ai.mapper';

describe('ai.mapper', () => {
	it('maps employee sync to snake_case including telemetry extras', () => {
		const payload = mapEmployeeInputToAiPayload({
			tenantId: 'org-a',
			employeeId: 'user-b',
			tasksCompleted: 3,
			attendanceDays: 5,
			idleHours: 1.25,
			workingHours: 7.5,
			taskProgress: 42,
			daysLeft: 3,
			lateArrivals: 1,
			absentDays: 0,
			activeSeconds: 9000,
			idleSeconds: 1800,
			telemetryDaysWithData: 5,
			segmentCount: 42,
			focusFragmentationIndex: 0.33,
			firstSeenOffsetMinutes: 30,
			lastSeenOffsetMinutes: 45,
		});

		expect(payload).toEqual({
			tenant_id: 'org-a',
			employee_id: 'user-b',
			tasks_completed: 3,
			attendance_days: 5,
			idle_hours: 1.25,
			working_hours: 7.5,
			task_progress: 42,
			days_left: 3,
			late_arrivals: 1,
			absent_days: 0,
			active_seconds: 9000,
			idle_seconds: 1800,
			telemetry_days_with_data: 5,
			segment_count: 42,
			focus_fragmentation_index: 0.33,
			first_seen_offset_minutes: 30,
			last_seen_offset_minutes: 45,
		});
	});

	it('derives active_seconds idle_seconds when telemetry omitted', () => {
		const payload = mapEmployeeInputToAiPayload({
			tenantId: 't',
			employeeId: 'e',
			tasksCompleted: 0,
			attendanceDays: 1,
			idleHours: 2,
			workingHours: 8,
			taskProgress: 0,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
		});

		expect(payload.active_seconds).toBe(28800);
		expect(payload.idle_seconds).toBe(7200);
		expect(payload.telemetry_days_with_data).toBe(1);
		expect(payload.segment_count).toBe(0);
	});

	it('maps report payload with history baseline points', () => {
		const report = mapReportInputToAiPayload({
			tenantId: 't',
			employeeId: 'e',
			tasksCompleted: 0,
			attendanceDays: 1,
			idleHours: 0,
			workingHours: 8,
			taskProgress: 50,
			daysLeft: 0,
			lateArrivals: 0,
			absentDays: 0,
			history: [{ date: '2026-01-05', productivityScore: 72, workingHours: 8, idleHours: 2 }],
		});

		expect(report.history).toEqual([
			{
				date: '2026-01-05',
				productivity_score: 72,
				working_hours: 8,
				idle_hours: 2,
			},
		]);
		expect((report as Record<string, unknown>).tenant_id).toBe('t');
		expect((report as Record<string, unknown>).segment_count).toBe(0);
	});

	it('maps task payload to snake_case', () => {
		expect(
			mapTaskInputToAiPayload({
				tenantId: 't1',
				employeeId: 'e1',
				taskId: 'task-z',
				progressPercent: 88,
				daysLeft: 4,
			})
		).toEqual({
			tenant_id: 't1',
			employee_id: 'e1',
			task_id: 'task-z',
			progress_percent: 88,
			days_left: 4,
		});
	});
});
