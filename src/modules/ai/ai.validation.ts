import { z } from 'zod';

const telemetryExtrasSchema = z.object({
	activeSeconds: z.number().nonnegative().optional(),
	idleSeconds: z.number().nonnegative().optional(),
	telemetryDaysWithData: z.number().int().nonnegative().optional(),
	segmentCount: z.number().int().nonnegative().optional(),
	focusFragmentationIndex: z.number().nonnegative().optional(),
	firstSeenOffsetMinutes: z.number().int().nonnegative().optional(),
	lastSeenOffsetMinutes: z.number().int().nonnegative().optional(),
});

export const employeeSyncSchema = z.object({
	tenantId: z.string().min(1),
	employeeId: z.string().min(1),
	tasksCompleted: z.number().int().nonnegative(),
	attendanceDays: z.number().int().nonnegative(),
	idleHours: z.number().nonnegative(),
	workingHours: z.number().nonnegative(),
	taskProgress: z.number().min(0).max(100),
	daysLeft: z.number().int().nonnegative(),
	lateArrivals: z.number().int().nonnegative(),
	absentDays: z.number().int().nonnegative(),
	...telemetryExtrasSchema.shape,
});

export const taskSyncSchema = z.object({
	tenantId: z.string().min(1),
	employeeId: z.string().min(1),
	taskId: z.string().min(1),
	progressPercent: z.number().min(0).max(100),
	daysLeft: z.number().int().nonnegative(),
});

export const analyticsBaselinePointSchema = z.object({
	date: z.string().min(1),
	productivityScore: z.number(),
	workingHours: z.number().nonnegative(),
	idleHours: z.number().nonnegative(),
});

export const reportSyncSchema = employeeSyncSchema.extend({
	history: z.array(analyticsBaselinePointSchema).default([]),
});

export const reportsQuerySchema = z.object({
	tenantId: z.string().min(1),
	limit: z.number().int().min(1).max(30).default(7),
});

export const replayReportSchema = z.object({
	requestId: z.string().min(1).optional(),
	report: reportSyncSchema,
});

export const dlqQuerySchema = z.object({
	limit: z.number().int().min(1).max(100).default(20),
});
