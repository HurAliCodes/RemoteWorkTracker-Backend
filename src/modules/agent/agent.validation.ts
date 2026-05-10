import { z } from 'zod';

export const registerDeviceSchema = z
  .object({
    deviceId: z.string().min(1, 'deviceId is required'),
    userId: z.string().uuid('userId must be a valid UUID').optional(),
    pairingCode: z
      .string()
      .min(6, 'pairingCode must be at least 6 characters')
      .max(12, 'pairingCode is too long')
      .optional(),
    hostname: z.string().min(1, 'hostname is required'),
    os: z.string().min(1, 'os is required'),
  })
  .refine((data) => Boolean(data.userId) || Boolean(data.pairingCode), {
    message: 'Either userId or pairingCode is required',
    path: ['userId'],
  });

export const heartbeatSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
  status: z.string().optional(),
});

const activityItemSchema = z
  .object({
    deviceId: z.string().min(1, 'deviceId is required'),
    userId: z.string().uuid('userId must be a valid UUID'),
    action: z.string().max(500).optional(),
    description: z.string().optional(),
    timestamp: z.string().optional(),
    app: z.string().optional(),
    windowTitle: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    duration: z.number().optional(),
    isIdle: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const hasDirect = Boolean(data.action?.trim() && data.timestamp?.trim());
      const hasAgentShape = Boolean(data.startTime || data.windowTitle || data.app);
      return hasDirect || hasAgentShape;
    },
    {
      message:
        'Provide action and timestamp together, or at least one of startTime, windowTitle, or app',
      path: ['startTime'],
    }
  );

export const activitySchema = z.object({
  activities: z.array(activityItemSchema).min(1, 'activities must be a non-empty array'),
});

export const idleSchema = z
  .object({
    deviceId: z.string().min(1, 'deviceId is required'),
    idleDuration: z.number().optional(),
    idleTime: z.number().optional(),
    userId: z.string().uuid().optional(),
    timestamp: z.string().optional(),
  })
  .refine((data) => data.idleDuration != null || data.idleTime != null, {
    message: 'Either idleDuration or idleTime is required',
    path: ['idleDuration'],
  });

export const createPairingCodeSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60).optional(),
});
