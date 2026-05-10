import express from 'express';
import { validate } from '../../middleware/validate.middleware';
import {
	createCourseController,
	deleteCourseController,
	enrollCourseController,
	getCourseByIdController,
	listCoursesController,
	listEnrollmentsController,
	updateCourseController,
} from './learning.controller';
import { createCourseSchema, enrollCourseSchema, updateCourseSchema } from './learning.validation';

const router = express.Router();

router.post('/', validate(createCourseSchema), createCourseController);
router.get('/', listCoursesController);
router.get('/enrollments', listEnrollmentsController);
router.get('/:id', getCourseByIdController);
router.patch('/:id', validate(updateCourseSchema), updateCourseController);
router.delete('/:id', deleteCourseController);
router.post('/:id/enroll', validate(enrollCourseSchema), enrollCourseController);

export default router;
