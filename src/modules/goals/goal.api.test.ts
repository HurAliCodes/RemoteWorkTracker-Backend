import express from 'express';
import request from 'supertest';
import goalRouter from './goal.routes';
import * as goalService from './goal.service';

const TEST_ORG_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

jest.mock('uuid', () => ({ v4: () => 'mock-goal-uuid' }));
jest.mock('./goal.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (req: { user?: { organizationId: string; admin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { organizationId: TEST_ORG_ID, admin: true };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1/goals', goalRouter);

const mockedService = goalService as jest.Mocked<typeof goalService>;

const goalId = '33333333-3333-3333-3333-333333333333';
const userId = '11111111-1111-1111-1111-111111111111';
const validCreatePayload = {
  title: 'Improve code quality',
  userId,
  description: 'Reduce code errors and increase unit test coverage',
  deadline: '2099-04-01',
};

describe('Goal APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/goals', () => {
    it('returns 201 for valid payload', async () => {
      mockedService.createGoalService.mockResolvedValueOnce({
        goalId,
        title: validCreatePayload.title,
        userId,
        description: validCreatePayload.description,
        progress: 0,
        deadline: validCreatePayload.deadline,
        status: 'AT_RISK',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app).post('/api/v1/goals').send(validCreatePayload).expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Goal created successfully');
      expect(mockedService.createGoalService).toHaveBeenCalledWith(validCreatePayload);
    });

    it('returns 400 for invalid body', async () => {
      const res = await request(app).post('/api/v1/goals').send({ title: 'x' }).expect(400);
      expect(res.body.error).toBeDefined();
      expect(mockedService.createGoalService).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/goals', () => {
    it('returns paginated list', async () => {
      mockedService.getAllGoalsService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [
          {
            goalId,
            title: validCreatePayload.title,
            userId,
            description: validCreatePayload.description,
            progress: 70,
            deadline: validCreatePayload.deadline,
            status: 'ON_TRACK',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app).get('/api/v1/goals').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meta.totalRecords).toBe(1);
      expect(mockedService.getAllGoalsService).toHaveBeenCalledWith({
        userId: undefined,
        status: undefined,
        page: undefined,
        limit: undefined,
        organizationId: TEST_ORG_ID,
      });
    });

    it('passes query filters to service', async () => {
      mockedService.getAllGoalsService.mockResolvedValueOnce({
        meta: { page: 2, limit: 10, totalRecords: 0, totalPages: 1 },
        data: [],
      });

      await request(app)
        .get(`/api/v1/goals?userId=${userId}&status=ON_TRACK&page=2&limit=10`)
        .expect(200);

      expect(mockedService.getAllGoalsService).toHaveBeenCalledWith({
        userId,
        status: 'ON_TRACK',
        page: 2,
        limit: 10,
        organizationId: TEST_ORG_ID,
      });
    });
  });

  describe('GET /api/v1/goals/:id', () => {
    it('returns 200 when found', async () => {
      mockedService.getGoalByIdService.mockResolvedValueOnce({
        goalId,
        title: validCreatePayload.title,
        userId,
        description: validCreatePayload.description,
        progress: 60,
        deadline: validCreatePayload.deadline,
        status: 'ON_TRACK',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app).get(`/api/v1/goals/${goalId}`).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goalId).toBe(goalId);
      expect(mockedService.getGoalByIdService).toHaveBeenCalledWith(goalId);
    });

    it('returns 404 when not found', async () => {
      mockedService.getGoalByIdService.mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v1/goals/${goalId}`).expect(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Goal not found');
    });
  });

  describe('PATCH /api/v1/goals/:id', () => {
    it('returns 200 for valid update', async () => {
      mockedService.updateGoalService.mockResolvedValueOnce({
        goalId,
        title: 'Improve code quality v2',
        userId,
        description: 'Updated description',
        progress: 45,
        deadline: '2099-05-01',
        status: 'AT_RISK',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const payload = {
        title: 'Improve code quality v2',
        description: 'Updated description',
        deadline: '2099-05-01',
      };

      const res = await request(app).patch(`/api/v1/goals/${goalId}`).send(payload).expect(200);
      expect(res.body.success).toBe(true);
      expect(mockedService.updateGoalService).toHaveBeenCalledWith(goalId, {
        title: payload.title,
        userId: undefined,
        description: payload.description,
        deadline: payload.deadline,
      });
    });
  });

  describe('DELETE /api/v1/goals/:id', () => {
    it('returns 200 for successful delete', async () => {
      mockedService.deleteGoalService.mockResolvedValueOnce({ message: 'Goal deleted successfully' });

      const res = await request(app).delete(`/api/v1/goals/${goalId}`).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('deleted');
      expect(mockedService.deleteGoalService).toHaveBeenCalledWith(goalId);
    });
  });

  describe('PATCH /api/v1/goals/:id/progress', () => {
    it('returns 200 for progress update', async () => {
      mockedService.updateGoalProgressService.mockResolvedValueOnce({
        goalId,
        title: validCreatePayload.title,
        userId,
        description: validCreatePayload.description,
        progress: 60,
        deadline: validCreatePayload.deadline,
        status: 'ON_TRACK',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .patch(`/api/v1/goals/${goalId}/progress`)
        .send({ progress: 60 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockedService.updateGoalProgressService).toHaveBeenCalledWith(goalId, 60);
    });

    it('returns 400 for invalid progress', async () => {
      await request(app)
        .patch(`/api/v1/goals/${goalId}/progress`)
        .send({ progress: 200 })
        .expect(400);

      expect(mockedService.updateGoalProgressService).not.toHaveBeenCalled();
    });
  });
});
