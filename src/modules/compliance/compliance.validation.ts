import { z } from 'zod';

export const createComplianceRuleSchema = z.object({
  region: z.string().min(1).max(64),
  maxWeeklyHours: z.number().positive(),
  overtimeAllowed: z.boolean().optional().default(true),
  minBreakHours: z.number().nonnegative().optional().default(11),
  description: z.string().max(255).optional(),
});

export const updateComplianceRuleSchema = z.object({
  region: z.string().min(1).max(64).optional(),
  maxWeeklyHours: z.number().positive().optional(),
  overtimeAllowed: z.boolean().optional(),
  minBreakHours: z.number().nonnegative().optional(),
  description: z.string().max(255).optional(),
});

export const resolveViolationSchema = z.object({
  status: z.enum(['PENDING', 'RESOLVED']).optional().default('RESOLVED'),
});

export const acknowledgeRuleSchema = z.object({
  signatureData: z.string().min(1),
});
