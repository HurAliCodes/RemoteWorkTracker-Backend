import { getDepartmentByIdService, updateDepartmentService } from './department.service';
import { validateDepartmentId, validateUpdateDepartment } from './department.validation';
import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
  assertResourceInCallerOrg,
  departmentBelongsToOrg,
  requireCallerOrgId,
} from '../../utils/org-access';
import { createDepartmentService, getAllDepartmentsService, deleteDepartmentService, reassignUsersDepartmentService } from './department.service';
import logger from '../../config/logger';
import { success, error as errorResponse } from '../../utils/response';

async function assertDepartmentAccess(req: Request, res: Response, departmentId: string) {
  return assertResourceInCallerOrg(
    req as AuthRequest,
    res,
    departmentId,
    departmentBelongsToOrg,
    'Department not found'
  );
}

export const getDepartmentByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const valid = validateDepartmentId(id);
    if (!valid.success) {
      return errorResponse(res, 'Invalid department id', 400, valid.error.issues);
    }
    if (!(await assertDepartmentAccess(req, res, id))) return;
    const result = await getDepartmentByIdService(id);
    return success(res, result, 'Department fetched successfully', 200);
  } catch (err: any) {
    logger.error('Failed to fetch department', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch department', 404);
  }
};
export const updateDepartmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const validId = validateDepartmentId(id);
    if (!validId.success) {
      return errorResponse(res, 'Invalid department id', 400, validId.error.issues);
    }
    if (!(await assertDepartmentAccess(req, res, id))) return;
    const validBody = validateUpdateDepartment(req.body);
    if (!validBody.success) {
      return errorResponse(res, 'Validation failed', 400, validBody.error.issues);
    }
    const result = await updateDepartmentService(id, validBody.data);
    return success(res, result, 'Department updated successfully', 200);
  } catch (err: any) {
    logger.error('Failed to update department', { error: err.message });
    return errorResponse(res, err.message || 'Failed to update department', 400);
  }
};
export const reassignUsersDepartmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await requireCallerOrgId(req as AuthRequest, res);
    if (!organizationId) return;
    const { fromDepartmentId, toDepartmentId } = req.body;
    if (!fromDepartmentId || !toDepartmentId) {
      return errorResponse(res, 'fromDepartmentId and toDepartmentId are required', 400);
    }
    if (!(await departmentBelongsToOrg(fromDepartmentId, organizationId))) {
      return errorResponse(res, 'Department not found', 404);
    }
    if (!(await departmentBelongsToOrg(toDepartmentId, organizationId))) {
      return errorResponse(res, 'Department not found', 404);
    }
    const result = await reassignUsersDepartmentService(fromDepartmentId, toDepartmentId);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('Failed to reassign users', { error: err.message });
    return errorResponse(res, err.message || 'Failed to reassign users', 400);
  }
};
export const createDepartmentController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await requireCallerOrgId(req, res);
    if (!organizationId) return;

    let results;
    if (typeof req.body === 'object' && req.body.names) {
      const names = String(req.body.names).split(',').map((n: string) => n.trim()).filter(Boolean);
      results = [];
      for (const name of names) {
        try {
          const result = await createDepartmentService({ name, organizationId });
          results.push(result);
        } catch (err: any) {
          if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
            results.push({ error: `Department '${name}' already exists.` });
          } else {
            results.push({ error: err.message || `Failed to create department '${name}'` });
          }
        }
      }
      return success(res, results, 'Departments created successfully', 201);
    } else if (Array.isArray(req.body)) {
      results = [];
      for (const dept of req.body) {
        const { name } = dept;
        try {
          const result = await createDepartmentService({ name, organizationId });
          results.push(result);
        } catch (err: any) {
          if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
            results.push({ error: `Department '${name}' already exists.` });
          } else {
            results.push({ error: err.message || `Failed to create department '${name}'` });
          }
        }
      }
      return success(res, results, 'Departments created successfully', 201);
    } else {
      const { name } = req.body;
      try {
        const result = await createDepartmentService({ name, organizationId });
        return success(res, result, 'Department created successfully', 201);
      } catch (err: any) {
        if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
          return errorResponse(res, `Department '${name}' already exists.`, 409);
        }
        return errorResponse(res, err.message || 'Failed to create department', 400);
      }
    }
  } catch (err: any) {
    logger.error('Failed to create department', { error: err.message });
    return errorResponse(res, err.message || 'Failed to create department', 400);
  }
};
export const getAllDepartmentsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const callerOrgId = await resolveCallerOrganizationId(req);
    if (!callerOrgId) {
      return errorResponse(res, 'Unauthorized or missing organization', 401);
    }
    const qOrg = typeof req.query.organization_id === 'string' ? req.query.organization_id.trim() : undefined;
    if (qOrg && qOrg !== callerOrgId) {
      return errorResponse(res, 'organization_id does not match caller organization', 403);
    }
    const result = await getAllDepartmentsService({ page, limit, organizationId: callerOrgId });
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('Failed to fetch departments', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch departments', 400);
  }
};
export const deleteDepartmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (!(await assertDepartmentAccess(req, res, id))) return;
    const result = await deleteDepartmentService(id);
    return res.status(200).json(result);
  } catch (err: any) {
    logger.error('Failed to delete department', { error: err.message });
    return res.status(404).json({ error: err.message || 'Failed to delete department' });
  }
};
