import express from 'express';
import request from 'supertest';
import payrollRouter from './payroll.routes';
import * as payrollService from './payroll.service';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
jest.mock('./payroll.service');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateJWT: (req: any, _res: unknown, next: () => void) => {
    req.user = { organizationId: 'org-test-id', admin: true, userId: 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb' };
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
jest.mock('../../utils/resolve-org-from-auth', () => ({
  resolveCallerOrganizationId: async () => 'org-test-id',
}));

const app = express();
app.use(express.json());
app.use('/api/v1/payroll', payrollRouter);

const mockedService = payrollService as jest.Mocked<typeof payrollService>;

const payrollId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';

const mockPayrollRecord = {
  payrollId,
  userId,
  employeeName: 'Ali Khan',
  month: '2026-03',
  basicSalary: 1200,
  overtime: 50,
  bonus: 100,
  deductions: 20,
  netPay: 1330,
  generatedAt: '2026-03-07T12:00:00.000Z',
};

describe('Payroll APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/payroll/generate', () => {
    it('returns 201 for valid month', async () => {
      mockedService.generatePayrollService.mockResolvedValueOnce({
        month: '2026-03',
        generatedAt: '2026-03-07T12:00:00.000Z',
        entriesGenerated: 25,
      });

      const res = await request(app)
        .post('/api/v1/payroll/generate')
        .send({ month: '2026-03' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Payroll generated successfully');
      expect(res.body.data.entriesGenerated).toBe(25);
      expect(mockedService.generatePayrollService).toHaveBeenCalledWith('2026-03', 'org-test-id');
    });

    it('returns 400 for invalid month format', async () => {
      const res = await request(app)
        .post('/api/v1/payroll/generate')
        .send({ month: '03-2026' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockedService.generatePayrollService).not.toHaveBeenCalled();
    });

    it('returns 400 when month is missing', async () => {
      const res = await request(app)
        .post('/api/v1/payroll/generate')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockedService.generatePayrollService).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/payroll', () => {
    it('returns paginated payroll list', async () => {
      mockedService.listPayrollService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [mockPayrollRecord],
      });

      const res = await request(app).get('/api/v1/payroll').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.meta.totalRecords).toBe(1);
      expect(res.body.data.data[0].payrollId).toBe(payrollId);
      expect(mockedService.listPayrollService).toHaveBeenCalledWith({
        userId: undefined,
        month: undefined,
        page: undefined,
        limit: undefined,
        organizationId: 'org-test-id',
      });
    });

    it('filters by userId and month', async () => {
      mockedService.listPayrollService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [mockPayrollRecord],
      });

      await request(app)
        .get(`/api/v1/payroll?userId=${userId}&month=2026-03`)
        .expect(200);

      expect(mockedService.listPayrollService).toHaveBeenCalledWith({
        userId,
        month: '2026-03',
        page: undefined,
        limit: undefined,
        organizationId: 'org-test-id',
      });
    });

    it('returns 400 for invalid userId query param', async () => {
      const res = await request(app)
        .get('/api/v1/payroll?userId=not-a-uuid')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(mockedService.listPayrollService).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/payroll/:id', () => {
    it('returns 200 when payroll exists', async () => {
      mockedService.getPayrollByIdService.mockResolvedValueOnce(mockPayrollRecord);

      const res = await request(app).get(`/api/v1/payroll/${payrollId}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.payrollId).toBe(payrollId);
      expect(mockedService.getPayrollByIdService).toHaveBeenCalledWith(payrollId);
    });

    it('returns 404 when payroll does not exist', async () => {
      mockedService.getPayrollByIdService.mockResolvedValueOnce(null);

      const res = await request(app).get(`/api/v1/payroll/${payrollId}`).expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Payroll not found');
    });
  });

  describe('GET /api/v1/payroll/user/:userId', () => {
    it('returns paginated payroll for user', async () => {
      mockedService.getUserPayrollService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [mockPayrollRecord],
      });

      const res = await request(app).get(`/api/v1/payroll/user/${userId}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data[0].userId).toBe(userId);
      expect(mockedService.getUserPayrollService).toHaveBeenCalledWith(userId, {
        month: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('filters by month', async () => {
      mockedService.getUserPayrollService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [mockPayrollRecord],
      });

      await request(app)
        .get(`/api/v1/payroll/user/${userId}?month=2026-03`)
        .expect(200);

      expect(mockedService.getUserPayrollService).toHaveBeenCalledWith(userId, {
        month: '2026-03',
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('GET /api/v1/payroll/me', () => {
    it('returns payroll for the authenticated employee', async () => {
      mockedService.getUserPayrollService.mockResolvedValueOnce({
        meta: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 },
        data: [mockPayrollRecord],
      });

      const res = await request(app).get('/api/v1/payroll/me').expect(200);

      expect(res.body.success).toBe(true);
      expect(mockedService.getUserPayrollService).toHaveBeenCalledWith(userId, {
        month: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });
});
