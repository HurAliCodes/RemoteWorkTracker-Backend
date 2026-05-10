import { z } from 'zod';

/** Matches web `useTelemetryDaily` (single-page fetch of all person-day rows in range). */
const TELEMETRY_LIST_MAX_LIMIT = 100_000;

const uuidLike = z.string().uuid({ message: 'Invalid UUID format' }).optional();

export const telemetryListQuerySchema = z.object({
  organizationId: uuidLike,
  userId: uuidLike,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(TELEMETRY_LIST_MAX_LIMIT).optional(),
});

export const telemetryDetailQuerySchema = z
  .object({
    organizationId: uuidLike,
    userId: z.string().uuid({ message: 'userId required' }),
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'day must be YYYY-MM-DD' }),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    windowStartHourUtc: z.coerce.number().int().min(0).max(23).optional(),
    windowEndHourUtc: z.coerce.number().int().min(0).max(23).optional(),
  })
  .refine(
    (d) =>
      (d.windowStartHourUtc === undefined && d.windowEndHourUtc === undefined) ||
      (d.windowStartHourUtc !== undefined && d.windowEndHourUtc !== undefined),
    { message: 'Provide both windowStartHourUtc and windowEndHourUtc or neither' }
  );

const dayYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'day must be YYYY-MM-DD' });

export const telemetryAppsByDayQuerySchema = z.object({
  organizationId: uuidLike,
  day: dayYmd,
});

export const telemetryDeskLatestQuerySchema = z.object({
  organizationId: uuidLike,
  day: dayYmd,
  userId: uuidLike,
});

export type TelemetryListQuery = z.infer<typeof telemetryListQuerySchema>;
export type TelemetryDetailQuery = z.infer<typeof telemetryDetailQuerySchema>;
