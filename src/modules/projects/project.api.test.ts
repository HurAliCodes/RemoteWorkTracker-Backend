import request from 'supertest';
import express from 'express';
import projectRouter from './project.routes';
import * as projectService from './project.service';
import { errorMiddleware } from '../../middleware/error.middleware';
import { AppError } from '../../utils/errors';
import { mapProjectToApi } from './project.mapper';
import type { ProjectRow } from './project.repository';

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (req: any, _res: unknown, next: () => void) => {
    req.user = { organizationId: 'org-test', admin: true };
    next();
  },
  requirePortalToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireDeviceToken: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireEmployeeToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../utils/org-access', () => ({
  requireCallerOrgId: async (_req: unknown, _res: unknown) => 'org-test',
  assertResourceInCallerOrg: async () => 'org-test',
  projectBelongsToOrg: async () => true,
  taskBelongsToOrg: async () => true,
  goalBelongsToOrg: async () => true,
  departmentBelongsToOrg: async () => true,
  payrollBelongsToOrg: async () => true,
  attendanceBelongsToOrg: async () => true,
  userBelongsToOrg: async () => true,
  courseInstructorInOrg: async () => true,
}));

jest.mock('../../utils/resolve-org-from-auth', () => ({
  resolveCallerOrganizationId: async () => 'org-test',
}));
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
jest.mock('./project.service');

const app = express();
app.use(express.json());
app.use('/api/v1/projects', projectRouter);
app.use(errorMiddleware);

const mockedService = projectService as jest.Mocked<typeof projectService>;

const validProject = {
  name: 'Alpha',
  manager_id: '11111111-1111-1111-1111-111111111111',
  organization_id: '22222222-2222-2222-2222-222222222222',
  start_date: '2025-01-01',
  end_date: '2025-12-31',
};
const projectId = '33333333-3333-3333-3333-333333333333';
const userId = '44444444-4444-4444-4444-444444444444';

function apiProject(overrides: Partial<ProjectRow> = {}) {
  return mapProjectToApi({
    project_id: projectId,
    name: 'Alpha',
    description: null,
    manager_id: validProject.manager_id,
    organization_id: validProject.organization_id,
    start_date: validProject.start_date,
    end_date: validProject.end_date,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  })!;
}

describe('Project APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/projects', () => {
    it('returns 201 and created project when body is valid', async () => {
      const created = apiProject();
      mockedService.createProjectService.mockResolvedValueOnce(created);

      const res = await request(app)
        .post('/api/v1/projects')
        .send(validProject)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.data.project_id).toBe(projectId);
      expect(res.body.data.projectId).toBe(projectId);
      expect(res.body.data.name).toBe(validProject.name);
      expect(mockedService.createProjectService).toHaveBeenCalledWith({
        name: validProject.name,
        description: undefined,
        manager_id: validProject.manager_id,
        organization_id: 'org-test',
        start_date: validProject.start_date,
        end_date: validProject.end_date,
      });
    });

    it('returns 404 when service throws AppError.notFound', async () => {
      mockedService.createProjectService.mockRejectedValueOnce(
        AppError.notFound('Organization not found.', 'ORG_NOT_FOUND')
      );

      const res = await request(app)
        .post('/api/v1/projects')
        .send(validProject)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Organization not found');
      expect(res.body.code).toBe('ORG_NOT_FOUND');
    });
  });

  describe('GET /api/v1/projects', () => {
    it('returns 200 and list with meta when service returns data', async () => {
      const list = {
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [apiProject()],
      };
      mockedService.getAllProjectsService.mockResolvedValueOnce(list);

      const res = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.meta).toEqual(list.meta);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].name).toBe('Alpha');
      expect(mockedService.getAllProjectsService).toHaveBeenCalledWith({ page: undefined, limit: undefined, organization_id: 'org-test' });
    });

    it('passes query params page, limit and forces caller organization', async () => {
      mockedService.getAllProjectsService.mockResolvedValueOnce({ meta: { page: 2, limit: 10, totalRecords: 0, totalPages: 0 }, data: [] });

      await request(app)
        .get('/api/v1/projects?page=2&limit=10&organization_id=org-123')
        .expect(200);

      expect(mockedService.getAllProjectsService).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        organization_id: 'org-test',
      });
    });

    it('returns 500 when service throws unexpected error', async () => {
      mockedService.getAllProjectsService.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/api/v1/projects')
        .expect(500);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('returns 200 and project when found', async () => {
      const project = apiProject();
      mockedService.getProjectByIdService.mockResolvedValueOnce(project);

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.project_id).toBe(projectId);
      expect(mockedService.getProjectByIdService).toHaveBeenCalledWith(projectId);
    });

    it('returns 404 when project not found', async () => {
      mockedService.getProjectByIdService.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project not found.');
    });

    it('returns 400 when service throws AppError.badRequest', async () => {
      mockedService.getProjectByIdService.mockRejectedValueOnce(AppError.badRequest('Invalid id'));

      await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(400);
    });
  });

  describe('PATCH /api/v1/projects/:id', () => {
    it('returns 200 and updated project when body is valid', async () => {
      const updated = apiProject({ name: 'Beta', description: 'Updated' });
      mockedService.updateProjectService.mockResolvedValueOnce(updated);

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .send({ name: 'Beta', description: 'Updated' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Beta');
      expect(mockedService.updateProjectService).toHaveBeenCalledWith(projectId, { name: 'Beta', description: 'Updated', manager_id: undefined, start_date: undefined, end_date: undefined });
    });

    it('returns 404 when project not found', async () => {
      mockedService.updateProjectService.mockRejectedValueOnce(
        AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND')
      );

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .send({ name: 'Beta' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project not found.');
    });

    it('returns 400 when service throws other error', async () => {
      mockedService.updateProjectService.mockRejectedValueOnce(
        AppError.badRequest('Invalid start_date.')
      );

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .send({ start_date: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('returns 200 and message when delete succeeds', async () => {
      mockedService.deleteProjectService.mockResolvedValueOnce({ message: 'Project deleted successfully.' });

      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('deleted');
      expect(mockedService.deleteProjectService).toHaveBeenCalledWith(projectId, {
        organizationId: 'org-test',
        userId: undefined,
      });
    });

    it('returns 404 when project not found', async () => {
      mockedService.deleteProjectService.mockRejectedValueOnce(
        AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND')
      );

      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project not found.');
    });
  });
});

describe('Project Member APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/projects/:id/members', () => {
    it('returns 200 and member rows when service succeeds', async () => {
      const rows = [{ userId, name: 'Test User', role: 'developer' }];
      mockedService.listProjectMembersService.mockResolvedValueOnce(rows);

      const res = await request(app).get(`/api/v1/projects/${projectId}/members`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(rows);
      expect(mockedService.listProjectMembersService).toHaveBeenCalledWith(projectId);
    });

    it('returns 404 when project not found', async () => {
      mockedService.listProjectMembersService.mockRejectedValueOnce(
        AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND')
      );

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/members`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/projects/:id/members', () => {
    it('returns 201 and member when body has user_id', async () => {
      const member = { member_id: '55555555-5555-5555-5555-555555555555', project_id: projectId, user_id: userId, role: 'developer', joined_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      mockedService.addProjectMemberService.mockResolvedValueOnce(member);

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .send({ user_id: userId, role: 'developer' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Member added to project successfully');
      expect(res.body.data.user_id).toBe(userId);
      expect(mockedService.addProjectMemberService).toHaveBeenCalledWith(projectId, userId, 'developer');
    });

    it('returns 400 when user_id is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .send({ role: 'developer' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('user_id is required');
      expect(mockedService.addProjectMemberService).not.toHaveBeenCalled();
    });

    it('returns 404 when project not found', async () => {
      mockedService.addProjectMemberService.mockRejectedValueOnce(
        AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND')
      );

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .send({ user_id: userId })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project not found.');
    });

    it('returns 409 when user already member', async () => {
      mockedService.addProjectMemberService.mockRejectedValueOnce(
        AppError.conflict('User is already a member of this project.')
      );

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .send({ user_id: userId })
        .expect(409);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/projects/:id/members/:userId', () => {
    it('returns 200 and message when remove succeeds', async () => {
      mockedService.removeProjectMemberService.mockResolvedValueOnce({ message: 'Member removed from project successfully.' });

      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/members/${userId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('removed');
      expect(mockedService.removeProjectMemberService).toHaveBeenCalledWith(projectId, userId);
    });

    it('returns 404 when project not found', async () => {
      mockedService.removeProjectMemberService.mockRejectedValueOnce(
        AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND')
      );

      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/members/${userId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project not found.');
    });

    it('returns 404 when project member not found', async () => {
      mockedService.removeProjectMemberService.mockRejectedValueOnce(
        AppError.notFound('Project member not found.')
      );

      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/members/${userId}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Project member not found.');
    });
  });
});
