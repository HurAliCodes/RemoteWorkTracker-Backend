import express from 'express';
import request from 'supertest';
import performanceRouter from './performance.routes';
import * as service from './performance.service';

jest.mock('./performance.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (req: any, _res: unknown, next: () => void) => {
    req.user = { organizationId: 'org-1', admin: true, userId: 'u-admin' };
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
jest.mock('../../utils/resolve-org-from-auth', () => ({
  resolveCallerOrganizationId: async () => 'org-1',
}));

const app = express();
app.use(express.json());
app.use('/api/v1/performance', performanceRouter);
const mocked = service as jest.Mocked<typeof service>;

describe('Performance APIs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /generate creates a draft review', async () => {
    const row = { review_id: 'rev1', user_id: 'u1', period: '2026-Q1', status: 'DRAFT' };
    mocked.generatePerformanceReview.mockResolvedValueOnce(row as any);
    mocked.mapReview.mockReturnValueOnce({
      reviewId: 'rev1',
      userId: 'u1',
      period: '2026-Q1',
      status: 'DRAFT',
      overallScore: 80,
    } as any);
    const res = await request(app)
      .post('/api/v1/performance/generate')
      .send({ userId: '11111111-1111-4111-8111-111111111111', period: '2026-Q1' })
      .expect(201);
    expect(res.body.success).toBe(true);
  });
});
