import request from 'supertest';
import express from 'express';
jest.mock('../../middleware/auth.middleware', () => ({
	authenticateJWT: (req: { user?: Record<string, string> }, __res: unknown, next: () => void) => {
		const mod = jest.requireActual('./test-auth-behaviour') as typeof import('./test-auth-behaviour');
		if (mod.aiApiAuthState.attachOrgId) {
			req.user = { organizationId: mod.aiApiAuthState.orgId };
		}
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


jest.mock('./ai.service');

import aiRouter from './ai.routes';
import * as aiService from './ai.service';
import { aiApiAuthState } from './test-auth-behaviour';

const mockedAi = aiService as jest.Mocked<typeof aiService>;

const app = express();
app.use(express.json());
app.use('/api/v1/ai', aiRouter);

describe('POST /api/v1/ai', () => {
	beforeEach(() => {
		aiApiAuthState.attachOrgId = true;
		jest.clearAllMocks();
	});

	it('returns 400 tenantId is required when tenant cannot be resolved', async () => {
		aiApiAuthState.attachOrgId = false;

		const res = await request(app)
			.post('/api/v1/ai/employee-data')
			.send({
				employeeId: 'e',
				tasksCompleted: 0,
				attendanceDays: 0,
				idleHours: 0,
				workingHours: 0,
				taskProgress: 0,
				daysLeft: 0,
				lateArrivals: 0,
				absentDays: 0,
			})
			.expect(400);

		expect(res.body.success).toBe(false);
		expect(String(res.body.message)).toMatch(/tenantId/i);
		expect(mockedAi.syncEmployeeData).not.toHaveBeenCalled();
	});

	it('returns 400 on invalid employee-sync body', async () => {
		const res = await request(app)
			.post('/api/v1/ai/employee-data')
			.send({
				employeeId: 'not-a-full-payload',
			})
			.expect(400);

		expect(res.body.success).toBe(false);
		expect(mockedAi.syncEmployeeData).not.toHaveBeenCalled();
	});

	it('returns 400 on invalid report body', async () => {
		const res = await request(app)
			.post('/api/v1/ai/report')
			.send({
				tasksCompleted: -1,
			})
			.expect(400);

		expect(mockedAi.generateAnalyticsReport).not.toHaveBeenCalled();
	});

	it('syncs employee data with merged tenantId and forwards AI response', async () => {
		mockedAi.syncEmployeeData.mockResolvedValueOnce({
			data: { tenant_id: aiApiAuthState.orgId, employee_id: 'emp-99' },
			traceId: 'ai-trace-z',
		});

		const res = await request(app)
			.post('/api/v1/ai/employee-data')
			.send({
				employeeId: 'emp-99',
				tasksCompleted: 2,
				attendanceDays: 5,
				idleHours: 1,
				workingHours: 8,
				taskProgress: 60,
				daysLeft: 1,
				lateArrivals: 0,
				absentDays: 0,
			})
			.expect(200);

		expect(mockedAi.syncEmployeeData).toHaveBeenCalledTimes(1);
		const callArgs = mockedAi.syncEmployeeData.mock.calls[0][0];
		expect(callArgs.tenantId).toBe(aiApiAuthState.orgId);
		expect(callArgs.employeeId).toBe('emp-99');
		expect(res.body.success).toBe(true);
		expect(res.body.data.tenant_id).toBe(aiApiAuthState.orgId);
	});
});
