import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import { error as errorResponse, success } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isManagerOrAdmin } from '../../middleware/requireAdmin.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
  assertResourceInCallerOrg,
  payrollBelongsToOrg,
  userBelongsToOrg,
  requireCallerOrgId,
} from '../../utils/org-access';
import {
  generatePayrollService,
  getPayrollByIdService,
  getUserPayrollService,
  listPayrollService,
} from './payroll.service';
import {
  generatePayrollSchema,
  getUserPayrollQuerySchema,
  listPayrollQuerySchema,
} from './payroll.validation';

export const generatePayrollController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) {
      return errorResponse(res, 'Unauthorized or missing organization', 401);
    }
    const parsed = generatePayrollSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid request body', 400, parsed.error.issues);
    }

    const result = await generatePayrollService(parsed.data.month, organizationId);
    return success(res, result, 'Payroll generated successfully', 201);
  } catch (err: any) {
    logger.error('Failed to generate payroll', { error: err.message });
    return errorResponse(res, err.message || 'Failed to generate payroll', 500);
  }
};

export const listPayrollController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const organizationId = await requireCallerOrgId(req, res);
    if (!organizationId) return;

    const parsed = listPayrollQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
    }

    const result = await listPayrollService({
      userId: parsed.data.userId,
      month: parsed.data.month,
      page: parsed.data.page,
      limit: parsed.data.limit,
      organizationId,
    });

    return success(res, result, 'Payroll records fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch payroll records', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch payroll records', 500);
  }
};

export const getPayrollByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payrollId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (
      !(await assertResourceInCallerOrg(
        req as AuthRequest,
        res,
        payrollId,
        payrollBelongsToOrg,
        'Payroll not found'
      ))
    ) {
      return;
    }
    const result = await getPayrollByIdService(payrollId);

    if (!result) {
      return errorResponse(res, 'Payroll not found', 404);
    }

    return success(res, result, 'Payroll record fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch payroll record', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch payroll record', 500);
  }
};

export const getMyPayrollController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const organizationId = await requireCallerOrgId(req, res);
    if (!organizationId) return;

    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'Employee authentication required', 401);

    if (!(await userBelongsToOrg(userId, organizationId))) {
      return errorResponse(res, 'User not found', 404);
    }

    const parsed = getUserPayrollQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
    }

    const result = await getUserPayrollService(userId, {
      month: parsed.data.month,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return success(res, result, 'My payroll records fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch my payroll records', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch payroll records', 500);
  }
};

export const getUserPayrollController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const organizationId = await requireCallerOrgId(req, res);
    if (!organizationId) return;

    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    // Employees may only read their own payroll via /user/:userId; admins/managers may read any org member.
    const privileged = await isManagerOrAdmin(req);
    if (!privileged && req.user?.userId && userId !== req.user.userId) {
      return errorResponse(res, 'Forbidden', 403);
    }

    if (!(await userBelongsToOrg(userId, organizationId))) {
      return errorResponse(res, 'User not found', 404);
    }

    const parsed = getUserPayrollQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return errorResponse(res, 'Invalid query parameters', 400, parsed.error.issues);
    }

    const result = await getUserPayrollService(userId, {
      month: parsed.data.month,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return success(res, result, 'User payroll records fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch user payroll records', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch user payroll records', 500);
  }
};
