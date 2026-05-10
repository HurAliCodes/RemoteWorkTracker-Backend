import { getDb } from '../../config/db';
import dbPool from '../../config/db';
import { ENV } from '../../config/env';
import type { AiEmployeeSnapshot } from '../ai/ai.snapshot.types';
import { fetchActivitySegmentsInRange, fetchIdleAggregates } from '../telemetry/telemetry.repository';
import {
	averageSeenOffsetsUtc,
	dayFirstLastFromActivities,
	giniCoefficient,
	parseDurationFromDescription,
	utcCalendarDay,
} from '../telemetry/telemetry.service';

export async function deleteAttendanceById(attendanceId: string) {
	const query = 'DELETE FROM attendance WHERE attendance_id = $1 RETURNING *';
	const result = await dbPool.query(query, [attendanceId]);
	return result.rows[0] || null;
}

export async function updateAttendanceById(attendanceId: string, data: Record<string, any>) {
	const keys = Object.keys(data);
	if (keys.length === 0) return null;
	const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
	const values = [attendanceId, ...Object.values(data)];
	const query = `UPDATE attendance SET ${setClause} WHERE attendance_id = $1 RETURNING *`;
	const result = await dbPool.query(query, values);
	return result.rows[0] || null;
}

export async function findAllAttendance() {
	const db = getDb();
	return db.selectAll('attendance');
}

export async function findAttendanceById(attendanceId: string) {
	const db = getDb();
	return db.findOne('attendance', { attendance_id: attendanceId });
}

export async function findAttendanceByUserId(userId: string) {
	const query = `SELECT * FROM attendance WHERE user_id = $1 ORDER BY created_at DESC`;
	const result = await dbPool.query(query, [userId]);
	return result.rows;
}

const ROLLUP_MS = () => ENV.AI_SNAPSHOT_ROLLUP_DAYS * 24 * 60 * 60 * 1000;

/**
 * AI snapshot from agent `activity_logs` + `idle_logs` (telemetry attendance).
 * Use this for sync to the AI server; `attendance` table is legacy for manual check-ins.
 */
export async function getAiEmployeeSnapshotFromTelemetry(userId: string): Promise<AiEmployeeSnapshot | null> {
	const userResult = await dbPool.query(
		`SELECT user_id, organization_id
		 FROM users
		 WHERE user_id = $1
		 LIMIT 1`,
		[userId]
	);
	const userRow = userResult.rows[0];
	if (!userRow) return null;

	const orgId = String(userRow.organization_id);
	const start = new Date(Date.now() - ROLLUP_MS());
	const exclusiveEnd = new Date(Date.now() + 1000);

	const [activities, idles] = await Promise.all([
		fetchActivitySegmentsInRange({
			organizationId: orgId,
			userId,
			start,
			end: exclusiveEnd,
		}),
		fetchIdleAggregates({
			organizationId: orgId,
			userId,
			start,
			end: exclusiveEnd,
		}),
	]);

	const presenceDays = new Set<string>();
	let activeSeconds = 0;
	const durations: number[] = [];

	for (const row of activities) {
		const day = utcCalendarDay(row.created_at);
		presenceDays.add(day);
		const dur = parseDurationFromDescription(row.description);
		activeSeconds += dur;
		durations.push(dur);
	}

	for (const ir of idles) {
		presenceDays.add(ir.day);
	}

	const dayBounds = dayFirstLastFromActivities(activities);
	const sortedPresenceDesc = Array.from(presenceDays).sort((a, b) => b.localeCompare(a));

	const offsets = averageSeenOffsetsUtc(
		dayBounds,
		sortedPresenceDesc,
		ENV.AI_SNAPSHOT_POLICY_START_HOUR_UTC,
		ENV.AI_SNAPSHOT_POLICY_END_HOUR_UTC,
		ENV.AI_SNAPSHOT_LATE_GRACE_MINUTES,
		14
	);

	const idleSecondsSum = idles.reduce((s, r) => s + (parseInt(r.idle_seconds, 10) || 0), 0);
	const idleHours = Number((idleSecondsSum / 3600).toFixed(2));
	const workingHours = Number((activeSeconds / 3600).toFixed(2));
	const attendanceDays = presenceDays.size;
	const segmentCount = activities.length;
	const focusFragmentationIndex = Number(giniCoefficient(durations).toFixed(4));

	const taskAggResult = await dbPool.query(
		`SELECT
		   COUNT(*)::int AS total_tasks,
		   COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) IN ('done', 'completed', 'closed'))::int AS completed_tasks,
		   COALESCE(AVG(
		     CASE
		       WHEN LOWER(COALESCE(status, '')) IN ('done', 'completed', 'closed') THEN 100
		       WHEN LOWER(COALESCE(status, '')) IN ('in_progress', 'in progress', 'active') THEN 50
		       ELSE 0
		     END
		   ), 0)::float AS avg_progress
		 FROM tasks
		 WHERE assigned_to = $1`,
		[userId]
	);
	const taskAgg = taskAggResult.rows[0] as {
		total_tasks: number;
		completed_tasks: number;
		avg_progress: number;
	};

	const rollupDays = ENV.AI_SNAPSHOT_ROLLUP_DAYS;

	return {
		tenantId: String(userRow.organization_id),
		employeeId: String(userRow.user_id),
		tasksCompleted: Number(taskAgg?.completed_tasks || 0),
		attendanceDays,
		idleHours,
		workingHours,
		taskProgress: Number((taskAgg?.avg_progress || 0).toFixed(2)),
		daysLeft: 0,
		lateArrivals: offsets.lateArrivals,
		absentDays: Math.max(0, rollupDays - attendanceDays),
		activeSeconds,
		idleSeconds: idleSecondsSum,
		telemetryDaysWithData: attendanceDays,
		segmentCount,
		focusFragmentationIndex,
		firstSeenOffsetMinutes: offsets.firstSeenOffsetMinutes,
		lastSeenOffsetMinutes: offsets.lastSeenOffsetMinutes,
	};
}

/** @deprecated Prefer getAiEmployeeSnapshotFromTelemetry — same implementation. */
export async function getAiEmployeeSnapshotFromAttendance(userId: string) {
	return getAiEmployeeSnapshotFromTelemetry(userId);
}
