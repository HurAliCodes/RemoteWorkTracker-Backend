import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { success, error as errorResponse } from '../../utils/response';
import * as checkin from './attendance.checkin.service';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  ipAddress: z.string().min(3).max(64),
  deviceId: z.string().optional(),
});

const checkOutSchema = z.object({
  sessionId: z.string().uuid(),
  deviceId: z.string().optional(),
});

const geoFenceSchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().positive(),
});

export const checkInController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const organizationId = await resolveCallerOrganizationId(req);
    if (!userId || !organizationId) return errorResponse(res, 'Employee authentication required', 401);
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const row = await checkin.checkIn({
      userId,
      organizationId,
      ...parsed.data,
    });
    return success(res, checkin.mapAttendanceSession(row), 'Checked in', 201);
  } catch (err: any) {
    return errorResponse(res, err.message || 'Check-in failed', 400);
  }
};

export const checkOutController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'Employee authentication required', 401);
    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const row = await checkin.checkOut({ userId, sessionId: parsed.data.sessionId });
    return success(res, checkin.mapAttendanceSession(row), 'Checked out');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Check-out failed', 400);
  }
};

export const listGeoFencesController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const rows = await checkin.listGeoFences(organizationId);
    return success(
      res,
      rows.map((r) => ({
        fenceId: r.fence_id,
        name: r.name,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        radiusMeters: Number(r.radius_meters),
      })),
      'Geo fences fetched'
    );
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to list fences', 400);
  }
};

export const createGeoFenceController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = geoFenceSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const row = await checkin.createGeoFence({ organizationId, ...parsed.data });
    return success(
      res,
      {
        fenceId: row.fence_id,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        radiusMeters: Number(row.radius_meters),
      },
      'Geo fence created',
      201
    );
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to create fence', 400);
  }
};

export const deleteGeoFenceController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await checkin.deleteGeoFence(id!, organizationId);
    if (!ok) return errorResponse(res, 'Fence not found', 404);
    return success(res, { message: 'Fence deleted' }, 'Fence deleted');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to delete fence', 400);
  }
};
