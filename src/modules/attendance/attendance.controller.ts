import type { Response } from 'express';
import { getAttendanceById, removeAttendanceById, patchAttendanceById } from './attendance.service';
import {
	attendanceIdParamSchema,
	attendanceMeListQuerySchema,
	attendancePatchSchema,
	telemetryListQuerySchema,
} from './attendance.validation';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { success, error } from '../../utils/response';
import { findUserById } from '../users/user.repo';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { attendanceBelongsToOrg, assertResourceInCallerOrg } from '../../utils/org-access';
import { getDailyTelemetry, toAttendanceLikeRows } from '../telemetry/telemetry.service';

export async function getAttendanceController(req: AuthRequest, res: Response) {
	try {
		const callerOrganizationId = await resolveCallerOrganizationId(req);
		if (!callerOrganizationId) return error(res, 'Unauthorized', 401);

		const parsed = telemetryListQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}
		const q = parsed.data;
		if (q.organizationId && q.organizationId !== callerOrganizationId) {
			return error(res, 'Forbidden', 403);
		}

		const result = await getDailyTelemetry(callerOrganizationId, q);
		const attendanceLogs = toAttendanceLikeRows(result.data);
		return success(
			res,
			{ attendanceLogs, meta: result.meta },
			'Attendance (agent desk telemetry)',
		);
	} catch (err) {
		return error(res, 'Failed to fetch attendance records', 500, err);
	}
}

export async function getAttendanceByIdController(req: AuthRequest, res: Response) {
	try {
		let { id } = req.params;
		if (Array.isArray(id)) id = id[0];
		const parseResult = attendanceIdParamSchema.safeParse({ id });
		if (!parseResult.success) {
			return error(res, parseResult.error.issues[0]?.message || 'Invalid attendance ID', 400);
		}
		if (!(await assertResourceInCallerOrg(req, res, id, attendanceBelongsToOrg, 'Attendance record not found'))) {
			return;
		}
		const record = await getAttendanceById(id);
		if (!record) {
			return error(
				res,
				'Attendance record not found — agent-only installs use aggregated list and activity-detail endpoints.',
				404,
			);
		}
		return success(res, record, 'Attendance record fetched');
	} catch (err) {
		return error(res, 'Failed to fetch attendance record', 500, err);
	}
}

export async function getMyAttendanceController(req: AuthRequest, res: Response) {
	try {
		if (!req.user?.userId) return error(res, 'Unauthorized', 401);
		const caller = await findUserById(req.user.userId);
		if (!caller?.organization_id) return error(res, 'User organization not found', 400);

		const parsed = attendanceMeListQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return error(res, 'Invalid query parameters', 400, parsed.error.flatten());
		}

		const result = await getDailyTelemetry(caller.organization_id, {
			...parsed.data,
			userId: req.user.userId,
		});
		const attendanceLogs = toAttendanceLikeRows(result.data);
		return success(
			res,
			{ attendanceLogs, meta: result.meta },
			'Your attendance (agent desk telemetry)',
		);
	} catch (err) {
		return error(res, 'Failed to fetch your attendance records', 500, err);
	}
}

export async function deleteAttendanceByIdController(req: AuthRequest, res: Response) {
	try {
		let { id } = req.params;
		if (Array.isArray(id)) id = id[0];
		const parseResult = attendanceIdParamSchema.safeParse({ id });
		if (!parseResult.success) {
			return error(res, parseResult.error.issues[0]?.message || 'Invalid attendance ID', 400);
		}
		if (!(await assertResourceInCallerOrg(req, res, id, attendanceBelongsToOrg, 'Attendance record not found'))) {
			return;
		}
		const deleted = await removeAttendanceById(id);
		if (!deleted) return error(res, 'Attendance record not found', 404);
		return success(res, deleted, 'Attendance record deleted');
	} catch (err) {
		return error(res, 'Failed to delete attendance record', 500, err);
	}
}

export async function patchAttendanceByIdController(req: AuthRequest, res: Response) {
	try {
		let { id } = req.params;
		if (Array.isArray(id)) id = id[0];
		const paramResult = attendanceIdParamSchema.safeParse({ id });
		if (!paramResult.success) {
			return error(res, paramResult.error.issues[0]?.message || 'Invalid attendance ID', 400);
		}
		if (!(await assertResourceInCallerOrg(req, res, id, attendanceBelongsToOrg, 'Attendance record not found'))) {
			return;
		}
		const bodyResult = attendancePatchSchema.safeParse(req.body);
		if (!bodyResult.success) {
			return error(res, bodyResult.error.issues[0]?.message || 'Invalid data', 400, bodyResult.error.issues);
		}
		const updated = await patchAttendanceById(id, bodyResult.data);
		if (!updated) return error(res, 'Attendance record not found or not updated', 404);
		return success(res, updated, 'Attendance record updated');
	} catch (err) {
		return error(res, 'Failed to update attendance record', 500, err);
	}
}
