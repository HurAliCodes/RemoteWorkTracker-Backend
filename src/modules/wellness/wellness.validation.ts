import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const moodValues = [
  'VERY_LOW',
  'LOW',
  'NEUTRAL',
  'GOOD',
  'GREAT',
  'STRESSED',
  'FOCUSED',
  'TIRED',
] as const;

export const moodSchema = z.enum(moodValues);

export type MoodType =
  | 'VERY_LOW'
  | 'LOW'
  | 'NEUTRAL'
  | 'GOOD'
  | 'GREAT'
  | 'STRESSED'
  | 'FOCUSED'
  | 'TIRED';

export const createWellnessLogSchema = z.object({
  date: z.string().regex(dateRegex, 'date must be in YYYY-MM-DD format'),
  mood: moodSchema.optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const listWellnessLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format').optional(),
  mood: moodSchema.optional(),
  minEnergy: z.coerce.number().int().min(1).max(5).optional(),
  maxEnergy: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listMyWellnessLogsQuerySchema = z.object({
  startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format').optional(),
  mood: moodSchema.optional(),
  minEnergy: z.coerce.number().int().min(1).max(5).optional(),
  maxEnergy: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateWellnessLogInput = z.infer<typeof createWellnessLogSchema>;
export type ListWellnessLogsQuery = z.infer<typeof listWellnessLogsQuerySchema>;
export type ListMyWellnessLogsQuery = z.infer<typeof listMyWellnessLogsQuerySchema>;

export const validateCreateWellnessLog = (data: unknown) => createWellnessLogSchema.safeParse(data);
export const validateListWellnessLogsQuery = (data: unknown) => listWellnessLogsQuerySchema.safeParse(data);
export const validateListMyWellnessLogsQuery = (data: unknown) => listMyWellnessLogsQuerySchema.safeParse(data);
