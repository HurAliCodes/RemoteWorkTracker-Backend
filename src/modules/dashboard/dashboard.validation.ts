import { z } from 'zod';

const uuidLike = z.string().uuid({ message: 'Invalid UUID format' }).optional();

export const dashboardSummaryQuerySchema = z.object({
	organizationId: uuidLike,
	days: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
