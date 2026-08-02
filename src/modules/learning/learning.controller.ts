import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import { error as errorResponse, success } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import {
	assertResourceInCallerOrg,
	courseInstructorInOrg,
	requireCallerOrgId,
	userBelongsToOrg,
} from '../../utils/org-access';
import {
	createCourseService,
	deleteCourseService,
	enrollUserInCourseService,
	getCourseByIdService,
	listCoursesService,
	listEnrollmentsService,
	updateCourseService,
} from './learning.service';
import { listCoursesQuerySchema, listEnrollmentsQuerySchema } from './learning.validation';

async function assertCourseAccess(req: Request, res: Response, courseId: string) {
	return assertResourceInCallerOrg(
		req as AuthRequest,
		res,
		courseId,
		courseInstructorInOrg,
		'Course not found'
	);
}

export const createCourseController = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const organizationId = await requireCallerOrgId(req, res);
		if (!organizationId) return;
		const body = req.body;
		if (!(await userBelongsToOrg(body.instructorId, organizationId))) {
			return errorResponse(res, 'Instructor not found', 404);
		}
		const result = await createCourseService({
			title: body.title,
			description: body.description,
			instructorId: body.instructorId,
		});

		return success(res, result, 'Course created successfully', 201);
	} catch (err: any) {
		logger.error('Failed to create course', { error: err.message });
		if (err.message === 'Instructor not found.') return errorResponse(res, 'Instructor not found', 404);
		return errorResponse(res, err.message || 'Failed to create course', 400);
	}
};

export const listCoursesController = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const organizationId = await requireCallerOrgId(req, res);
		if (!organizationId) return;

		const parsed = listCoursesQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
		}

		const result = await listCoursesService({
			page: parsed.data.page,
			limit: parsed.data.limit,
			organizationId,
		});

		return success(res, result, 'Courses fetched successfully');
	} catch (err: any) {
		logger.error('Failed to fetch courses', { error: err.message });
		return errorResponse(res, err.message || 'Failed to fetch courses', 400);
	}
};

export const getCourseByIdController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		if (!(await assertCourseAccess(req, res, courseId))) return;
		const result = await getCourseByIdService(courseId);
		if (!result) return errorResponse(res, 'Course not found', 404);

		return success(res, result, 'Course fetched successfully');
	} catch (err: any) {
		logger.error('Failed to fetch course', { error: err.message });
		return errorResponse(res, err.message || 'Failed to fetch course', 400);
	}
};

export const updateCourseController = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		const organizationId = await assertCourseAccess(req, res, courseId);
		if (!organizationId) return;
		const body = req.body;
		if (body.instructorId && !(await userBelongsToOrg(body.instructorId, organizationId))) {
			return errorResponse(res, 'Instructor not found', 404);
		}

		const result = await updateCourseService(courseId, {
			title: body.title,
			description: body.description,
			instructorId: body.instructorId,
		});

		return success(res, result, 'Course updated successfully');
	} catch (err: any) {
		logger.error('Failed to update course', { error: err.message });
		if (err.message === 'Course not found.') return errorResponse(res, 'Course not found', 404);
		if (err.message === 'Instructor not found.') return errorResponse(res, 'Instructor not found', 404);
		return errorResponse(res, err.message || 'Failed to update course', 400);
	}
};

export const deleteCourseController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		if (!(await assertCourseAccess(req, res, courseId))) return;
		const result = await deleteCourseService(courseId);
		return success(res, result, 'Course deleted successfully');
	} catch (err: any) {
		logger.error('Failed to delete course', { error: err.message });
		if (err.message === 'Course not found.') return errorResponse(res, 'Course not found', 404);
		return errorResponse(res, err.message || 'Failed to delete course', 400);
	}
};

export const enrollCourseController = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		const organizationId = await assertCourseAccess(req, res, courseId);
		if (!organizationId) return;
		if (!(await userBelongsToOrg(req.body.userId, organizationId))) {
			return errorResponse(res, 'User not found', 404);
		}
		const result = await enrollUserInCourseService(courseId, {
			userId: req.body.userId,
		});

		return success(res, result, 'User enrolled successfully', 201);
	} catch (err: any) {
		logger.error('Failed to enroll user in course', { error: err.message });
		if (err.message === 'Course not found.') return errorResponse(res, 'Course not found', 404);
		if (err.message === 'User not found.') return errorResponse(res, 'User not found', 404);
		if (err.message === 'User is already enrolled in this course.') {
			return errorResponse(res, 'User is already enrolled in this course', 409);
		}
		return errorResponse(res, err.message || 'Failed to enroll user in course', 400);
	}
};

export const listEnrollmentsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const organizationId = await requireCallerOrgId(req, res);
		if (!organizationId) return;

		const parsed = listEnrollmentsQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
		}

		const privileged = await isManagerOrAdmin(req);
		let userId = parsed.data.userId;
		if (!privileged) {
			const callerId = req.user?.userId;
			if (!callerId) return errorResponse(res, 'Unauthorized', 401);
			userId = callerId;
		}

		const result = await listEnrollmentsService({
			page: parsed.data.page,
			limit: parsed.data.limit,
			userId,
			courseId: parsed.data.courseId,
			status: parsed.data.status,
			organizationId,
		});

		return success(res, result, 'Enrollments fetched successfully');
	} catch (err: any) {
		logger.error('Failed to fetch enrollments', { error: err.message });
		return errorResponse(res, err.message || 'Failed to fetch enrollments', 400);
	}
};
