import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import { success, error as errorResponse } from '../../utils/response';
import {
  createComplianceRuleSchema,
  updateComplianceRuleSchema,
  acknowledgeRuleSchema,
} from './compliance.validation';
import * as service from './compliance.service';

export const createRuleController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = createComplianceRuleSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const data = await service.createComplianceRuleService(organizationId, parsed.data);
    return success(res, data, 'Compliance rule created', 201);
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to create rule', 400);
  }
};

export const listRulesController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const data = await service.listComplianceRulesService(organizationId, {
      region: req.query.region as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return success(res, data, 'Rules fetched');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to list rules', 400);
  }
};

export const updateRuleController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = updateComplianceRuleSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await service.updateComplianceRuleService(organizationId, id!, parsed.data);
    return success(res, data, 'Rule updated');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to update rule', 400);
  }
};

export const deleteRuleController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await service.deleteComplianceRuleService(organizationId, id!);
    return success(res, data, 'Rule deleted');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to delete rule', 400);
  }
};

export const listViolationsController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    // Non-admins may only list their own violations (mobile "my violations").
    let userId = req.query.userId as string | undefined;
    if (req.user?.admin !== true && req.user?.userId) {
      userId = req.user.userId;
    }
    const data = await service.listComplianceViolationsService(organizationId, {
      userId,
      region: req.query.region as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return success(res, data, 'Violations fetched');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to list violations', 400);
  }
};

export const resolveViolationController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await service.resolveComplianceViolationService(organizationId, id!);
    return success(res, data, 'Violation resolved');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to resolve violation', 400);
  }
};

export const acknowledgeRuleController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'Employee token required', 401);
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) return errorResponse(res, 'Unauthorized', 401);
    const parsed = acknowledgeRuleSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = await service.acknowledgeComplianceRuleService(
      userId,
      id!,
      parsed.data.signatureData,
      organizationId
    );
    return success(res, data, 'Acknowledged');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to acknowledge', 400);
  }
};
