import { z } from 'zod';

export const generatePerformanceSchema = z.object({
  userId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-Q[1-4]$/, 'period must be YYYY-QN'),
});

export const finalizePerformanceSchema = z.object({
  comments: z.string().optional(),
  signatureData: z.string().min(1).optional(),
});
