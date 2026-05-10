import request from 'supertest';
import express from 'express';
import tasksRouter from './tasks.routes';
import * as tasksService from './tasks.service';

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('uuid', () => ({ v4: () => 'mock-task-uuid' }));
jest.mock('./tasks.service');

const app = express();
app.use(express.json());
app.use('/api/v1/tasks', tasksRouter);

const mocked = tasksService as jest.Mocked<typeof tasksService>;

const taskId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const projectId = '6ba7b810-9dad-41d1-a503-00c04fd430c8';
const userId = '550e8400-e29b-41d4-a716-446655440000';

describe('Task APIs', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api/v1/tasks', () => {
    it('returns 201 when service succeeds', async () => {
      const row = { task_id: taskId, project_id: projectId, assigned_to: userId, title: 'T1', description: null, status: null, priority: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      mocked.createTaskService.mockResolvedValueOnce(row);

      const res = await request(app)
        .post('/api/v1/tasks')
        .send({ project_id: projectId, assigned_to: userId, title: 'T1' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.task_id).toBe(taskId);
    });

    it('returns 400 on invalid body (validation)', async () => {
      await request(app)
        .post('/api/v1/tasks')
        .send({ title: 'x' })
        .expect(400);
      expect(mocked.createTaskService).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('returns 200 with list', async () => {
      mocked.getAllTasksService.mockResolvedValueOnce({ meta: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 }, data: [] });
      const res = await request(app).get('/api/v1/tasks').expect(200);
      expect(res.body.data.meta.totalRecords).toBe(0);
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('returns 404 when not found', async () => {
      mocked.getTaskByIdService.mockResolvedValueOnce(null);
      await request(app).get(`/api/v1/tasks/${taskId}`).expect(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('returns 200 when updated', async () => {
      const row = { task_id: taskId, title: 'Updated', project_id: projectId, assigned_to: userId, description: null, status: null, priority: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      mocked.updateTaskService.mockResolvedValueOnce(row);
      const res = await request(app).patch(`/api/v1/tasks/${taskId}`).send({ title: 'Updated' }).expect(200);
      expect(res.body.data.title).toBe('Updated');
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('returns 200 when deleted', async () => {
      mocked.deleteTaskService.mockResolvedValueOnce({ message: 'Task deleted successfully.' });
      await request(app).delete(`/api/v1/tasks/${taskId}`).expect(200);
    });
  });
});

describe('Task comments & attachments APIs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /tasks/:id/comments returns 403 without userId on token (middleware mock leaves no user)', async () => {
    await request(app)
      .post(`/api/v1/tasks/${taskId}/comments`)
      .send({ comment: 'hi' })
      .expect(403);
  });

  it('DELETE /tasks/:id/attachments/:attachmentId calls service', async () => {
    mocked.deleteTaskAttachmentService.mockResolvedValueOnce({ message: 'Attachment deleted successfully.' });
    const aid = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    await request(app).delete(`/api/v1/tasks/${taskId}/attachments/${aid}`).expect(200);
    expect(mocked.deleteTaskAttachmentService).toHaveBeenCalledWith(taskId, aid);
  });
});
