import express from 'express';
import request from 'supertest';
import learningRouter from './learning.routes';
import * as learningService from './learning.service';

jest.mock('uuid', () => ({ v4: () => 'mock-course-uuid' }));
jest.mock('./learning.service');
jest.mock('../../middleware/auth.middleware', () => ({
	authenticateJWT: (req: any, _res: unknown, next: () => void) => {
		req.user = { organizationId: 'org-test-id', admin: true };
		next();
	},
  requirePortalToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireDeviceToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireEmployeeToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../utils/org-access', () => ({
  requireCallerOrgId: async (_req: unknown, _res: unknown) => 'org-test-id',
  assertResourceInCallerOrg: async () => 'org-test-id',
  projectBelongsToOrg: async () => true,
  taskBelongsToOrg: async () => true,
  goalBelongsToOrg: async () => true,
  departmentBelongsToOrg: async () => true,
  payrollBelongsToOrg: async () => true,
  attendanceBelongsToOrg: async () => true,
  userBelongsToOrg: async () => true,
  courseInstructorInOrg: async () => true,
}));

jest.mock('../../middleware/requireAdmin.middleware', () => ({
  requireOrgAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireManagerOrAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  isManagerOrAdmin: async () => true,
}));

const app = express();
app.use(express.json());
app.use('/api/v1/courses', learningRouter);

const mockedService = learningService as jest.Mocked<typeof learningService>;

const courseId = '33333333-3333-4333-8333-333333333333';
const instructorId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

describe('Learning APIs', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /api/v1/courses', () => {
		it('returns 201 for valid payload', async () => {
			const payload = {
				title: 'TypeScript Fundamentals',
				description: 'Learn TS basics and best practices.',
				instructorId,
			};

			mockedService.createCourseService.mockResolvedValueOnce({
				courseId,
				title: payload.title,
				description: payload.description,
				instructorId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			const res = await request(app).post('/api/v1/courses').send(payload).expect(201);

			expect(res.body.success).toBe(true);
			expect(res.body.message).toBe('Course created successfully');
			expect(mockedService.createCourseService).toHaveBeenCalledWith(payload);
		});

		it('returns 400 for invalid payload', async () => {
			await request(app).post('/api/v1/courses').send({ title: 'x' }).expect(400);
			expect(mockedService.createCourseService).not.toHaveBeenCalled();
		});
	});

	describe('GET /api/v1/courses', () => {
		it('returns paginated courses list', async () => {
			mockedService.listCoursesService.mockResolvedValueOnce({
				meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
				data: [
					{
						courseId,
						title: 'TypeScript Fundamentals',
						description: 'Learn TS basics and best practices.',
						instructorId,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				],
			});

			const res = await request(app).get('/api/v1/courses').expect(200);

			expect(res.body.success).toBe(true);
			expect(res.body.data.meta.totalRecords).toBe(1);
			expect(mockedService.listCoursesService).toHaveBeenCalledWith({
				page: undefined,
				limit: undefined,
				organizationId: 'org-test-id',
			});
		});
	});

	describe('GET /api/v1/courses/:id', () => {
		it('returns 200 when course exists', async () => {
			mockedService.getCourseByIdService.mockResolvedValueOnce({
				courseId,
				title: 'TypeScript Fundamentals',
				description: 'Learn TS basics and best practices.',
				instructorId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			const res = await request(app).get(`/api/v1/courses/${courseId}`).expect(200);

			expect(res.body.success).toBe(true);
			expect(res.body.data.courseId).toBe(courseId);
			expect(mockedService.getCourseByIdService).toHaveBeenCalledWith(courseId);
		});

		it('returns 404 when course does not exist', async () => {
			mockedService.getCourseByIdService.mockResolvedValueOnce(null);

			const res = await request(app).get(`/api/v1/courses/${courseId}`).expect(404);

			expect(res.body.success).toBe(false);
			expect(res.body.message).toBe('Course not found');
		});
	});

	describe('POST /api/v1/courses/:id/enroll', () => {
		it('returns 201 when enroll succeeds', async () => {
			mockedService.enrollUserInCourseService.mockResolvedValueOnce({
				enrollmentId: '44444444-4444-4444-4444-444444444444',
				courseId,
				userId,
				status: 'ENROLLED',
				progress: 0,
				completedAt: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				course: {
					courseId,
					title: 'TypeScript Fundamentals',
				},
			});

			const res = await request(app)
				.post(`/api/v1/courses/${courseId}/enroll`)
				.send({ userId })
				.expect(201);

			expect(res.body.success).toBe(true);
			expect(res.body.message).toBe('User enrolled successfully');
			expect(mockedService.enrollUserInCourseService).toHaveBeenCalledWith(courseId, { userId });
		});

		it('returns 400 for invalid enroll payload', async () => {
			await request(app)
				.post(`/api/v1/courses/${courseId}/enroll`)
				.send({ userId: 'bad-id' })
				.expect(400);

			expect(mockedService.enrollUserInCourseService).not.toHaveBeenCalled();
		});
	});

	describe('GET /api/v1/courses/enrollments', () => {
		it('returns all enrollments with pagination', async () => {
			mockedService.listEnrollmentsService.mockResolvedValueOnce({
				meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
				data: [
					{
						enrollmentId: '44444444-4444-4444-4444-444444444444',
						courseId,
						userId,
						status: 'ENROLLED',
						progress: 0,
						completedAt: null,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						course: {
							courseId,
							title: 'TypeScript Fundamentals',
						},
					},
				],
			});

			const res = await request(app).get('/api/v1/courses/enrollments').expect(200);

			expect(res.body.success).toBe(true);
			expect(res.body.data.meta.totalRecords).toBe(1);
			expect(mockedService.listEnrollmentsService).toHaveBeenCalledWith({
				page: undefined,
				limit: undefined,
				userId: undefined,
				courseId: undefined,
				status: undefined,
				organizationId: 'org-test-id',
			});
		});
	});
});
