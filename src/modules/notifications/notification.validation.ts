import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .refine((v) => v > 0, { message: 'page must be a positive integer' }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .refine((v) => v > 0 && v <= 100, {
      message: 'limit must be between 1 and 100',
    }),
  status: z.enum(['READ', 'UNREAD']).optional(),
});
