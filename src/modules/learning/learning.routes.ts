import express from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';
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

router.use(authenticateJWT, requirePortalToken);
router.post('/', requireOrgAdmin, validate(createCourseSchema), createCourseController);
router.get('/', listCoursesController);
router.get('/enrollments', listEnrollmentsController);
router.get('/:id', getCourseByIdController);
router.patch('/:id', requireOrgAdmin, validate(updateCourseSchema), updateCourseController);
router.delete('/:id', requireOrgAdmin, deleteCourseController);
router.post('/:id/enroll', validate(enrollCourseSchema), enrollCourseController);

export default router;
