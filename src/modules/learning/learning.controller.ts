import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import { error as errorResponse, success } from '../../utils/response';
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

export const createCourseController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const body = req.body;
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

export const listCoursesController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const parsed = listCoursesQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
		}

		const result = await listCoursesService({
			page: parsed.data.page,
			limit: parsed.data.limit,
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
		const result = await getCourseByIdService(courseId);
		if (!result) return errorResponse(res, 'Course not found', 404);

		return success(res, result, 'Course fetched successfully');
	} catch (err: any) {
		logger.error('Failed to fetch course', { error: err.message });
		return errorResponse(res, err.message || 'Failed to fetch course', 400);
	}
};

export const updateCourseController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
		const body = req.body;

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
		const result = await deleteCourseService(courseId);
		return success(res, result, 'Course deleted successfully');
	} catch (err: any) {
		logger.error('Failed to delete course', { error: err.message });
		if (err.message === 'Course not found.') return errorResponse(res, 'Course not found', 404);
		return errorResponse(res, err.message || 'Failed to delete course', 400);
	}
};

export const enrollCourseController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
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

export const listEnrollmentsController = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const parsed = listEnrollmentsQuerySchema.safeParse(req.query);
		if (!parsed.success) {
			return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
		}

		const result = await listEnrollmentsService({
			page: parsed.data.page,
			limit: parsed.data.limit,
			userId: parsed.data.userId,
			courseId: parsed.data.courseId,
			status: parsed.data.status,
		});

		return success(res, result, 'Enrollments fetched successfully');
	} catch (err: any) {
		logger.error('Failed to fetch enrollments', { error: err.message });
		return errorResponse(res, err.message || 'Failed to fetch enrollments', 400);
	}
};