import { z } from 'zod';

const isValidDateString = (value: string) => !isNaN(new Date(value).getTime());
const isFutureDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  return date.getTime() > now.getTime();
};

export const createGoalSchema = z.object({
  title: z.string().min(3, 'title must be at least 3 characters'),
  userId: z.string().uuid('userId must be a valid UUID'),
  description: z.string().max(500, 'description cannot exceed 500 characters').optional(),
  deadline: z
    .string()
    .refine(isValidDateString, 'deadline must be a valid date')
    .refine(isFutureDate, 'deadline must be a future date'),
});

export const updateGoalSchema = z
  .object({
    title: z.string().min(3, 'title must be at least 3 characters').optional(),
    userId: z.string().uuid('userId must be a valid UUID').optional(),
    description: z.string().max(500, 'description cannot exceed 500 characters').optional(),
    deadline: z
      .string()
      .refine(isValidDateString, 'deadline must be a valid date')
      .refine(isFutureDate, 'deadline must be a future date')
      .optional(),
  })
  .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update',
  });

export const updateGoalProgressSchema = z.object({
  progress: z.coerce.number().min(0, 'progress must be >= 0').max(100, 'progress must be <= 100'),
});

export const getGoalsQuerySchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  organizationId: z.string().uuid('organizationId must be a valid UUID').optional(),
  status: z.enum(['ON_TRACK', 'AT_RISK']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
