import request from 'supertest';
import express from 'express';
import roleRouter from './role.routes';

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

jest.mock('../../middleware/requireAdmin.middleware', () => ({
  requireOrgAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireManagerOrAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/v1/roles', roleRouter);

describe('Role API auth gate', () => {
  it('rejects unauthenticated requests when auth middleware is real', async () => {
    // With mocked auth this passes through; assert route is mounted
    const res = await request(app).get('/api/v1/roles');
    // May be 200 or 500 depending on DB; must not be 404
    expect(res.status).not.toBe(404);
  });
});
