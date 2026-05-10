import { z } from 'zod';

const uuidLike = z.string().uuid({ message: 'Invalid UUID format' }).optional();

export const analyticsOverviewQuerySchema = z.object({
	organizationId: uuidLike,
	days: z.coerce.number().int().min(1).max(90).optional().default(7),
	employeeId: z.string().uuid({ message: 'Invalid employeeId' }).optional(),
	aiReportLimit: z.coerce.number().int().min(1).max(30).optional().default(7),
});

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;

export const analyticsDateRangeQuerySchema = z.object({
	organizationId: uuidLike,
	startDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
		.optional(),
	endDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
		.optional(),
});

export type AnalyticsDateRangeQuery = z.infer<typeof analyticsDateRangeQuerySchema>;

export const aiWeeklyReportsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(30).optional().default(14),
});

export type AiWeeklyReportsQuery = z.infer<typeof aiWeeklyReportsQuerySchema>;

export const generateAiReportBodySchema = z.object({
	employeeId: z.string().uuid({ message: 'Invalid employeeId' }),
});

export type GenerateAiReportBody = z.infer<typeof generateAiReportBodySchema>;
