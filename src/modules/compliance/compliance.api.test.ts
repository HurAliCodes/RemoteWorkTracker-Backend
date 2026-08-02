import express from 'express';
import request from 'supertest';
import complianceRouter from './compliance.routes';
import * as service from './compliance.service';

jest.mock('./compliance.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (req: any, _res: unknown, next: () => void) => {
    req.user = { organizationId: 'org-1', admin: true, userId: 'user-1' };
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
  isManagerOrAdmin: async () => true,
}));
jest.mock('../../utils/resolve-org-from-auth', () => ({
  resolveCallerOrganizationId: async () => 'org-1',
}));

const app = express();
app.use(express.json());
app.use('/api/v1/compliance', complianceRouter);
const mocked = service as jest.Mocked<typeof service>;

describe('Compliance APIs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /rules creates a rule', async () => {
    mocked.createComplianceRuleService.mockResolvedValueOnce({
      ruleId: 'r1',
      region: 'EU',
      maxWeeklyHours: 48,
      overtimeAllowed: true,
      minBreakHours: 11,
      createdAt: new Date().toISOString(),
    } as any);
    const res = await request(app)
      .post('/api/v1/compliance/rules')
      .send({ region: 'EU', maxWeeklyHours: 48, overtimeAllowed: true, minBreakHours: 11 })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(mocked.createComplianceRuleService).toHaveBeenCalled();
  });

  it('GET /violations lists violations', async () => {
    mocked.listComplianceViolationsService.mockResolvedValueOnce({
      meta: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
      data: [],
    });
    const res = await request(app).get('/api/v1/compliance/violations').expect(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /rules/:id/acknowledge records acknowledgement for org rule', async () => {
    mocked.acknowledgeComplianceRuleService.mockResolvedValueOnce({
      message: 'Rule acknowledged',
      ruleId: 'r1',
    });
    const res = await request(app)
      .post('/api/v1/compliance/rules/r1/acknowledge')
      .send({ signatureData: 'Jane Doe' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(mocked.acknowledgeComplianceRuleService).toHaveBeenCalledWith(
      'user-1',
      'r1',
      'Jane Doe',
      'org-1'
    );
  });
});
