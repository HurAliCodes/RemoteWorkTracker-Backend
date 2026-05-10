import { z } from 'zod';
import { telemetryListQuerySchema } from '../telemetry/telemetry.validation';

export { telemetryListQuerySchema };

/** Same as org-wide list but omits `userId` — `/attendance/me` always scopes to JWT userId. */
export const attendanceMeListQuerySchema = telemetryListQuerySchema.omit({ userId: true });

export const attendancePatchSchema = z.object({
  check_in: z.string().datetime().optional(),
  check_out: z.string().datetime().optional(),
  location: z.string().max(255).optional(),
  device_id: z.string().uuid().optional(),
});
export const attendanceIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid attendance ID format' }),
});
export const userIdParamSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user ID format' }),
});
