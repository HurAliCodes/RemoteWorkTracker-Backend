import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
  assertResourceInCallerOrg,
  projectBelongsToOrg,
  userBelongsToOrg,
} from '../../utils/org-access';
import { AppError } from '../../utils/errors';
import {
  createProjectService,
  getAllProjectsService,
  getProjectByIdService,
  updateProjectService,
  deleteProjectService,
  addProjectMemberService,
  removeProjectMemberService,
  listProjectMembersService,
} from './project.service';

async function requireProjectAccess(req: Request, res: Response, projectId: string) {
  return assertResourceInCallerOrg(
    req as AuthRequest,
    res,
    projectId,
    projectBelongsToOrg,
    'Project not found'
  );
}

export const createProjectController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) throw AppError.unauthorized('Unauthorized or missing organization');
    const body = req.body;
    const result = await createProjectService({
      name: body.name,
      description: body.description,
      manager_id: body.manager_id ?? body.managerId,
      organization_id: organizationId,
      start_date: body.start_date ?? body.startDate,
      end_date: body.end_date ?? body.endDate,
    });
    return success(res, result, 'Project created successfully', 201);
  } catch (err) {
    return next(err);
  }
};

export const getAllProjectsController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) throw AppError.unauthorized('Unauthorized or missing organization');
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const result = await getAllProjectsService({ page, limit, organization_id: organizationId });
    return success(res, result, 'Projects fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const listProjectMembersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireProjectAccess(req, res, id))) return;
    const members = await listProjectMembersService(id);
    return success(res, members, 'Project members fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const getProjectByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireProjectAccess(req, res, id))) return;
    const project = await getProjectByIdService(id);
    if (!project) throw AppError.notFound('Project not found.', 'PROJECT_NOT_FOUND');
    return success(res, project, 'Project fetched successfully');
  } catch (err) {
    return next(err);
  }
};

export const updateProjectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireProjectAccess(req, res, id))) return;
    const body = req.body;
    const result = await updateProjectService(id, {
      name: body.name,
      description: body.description,
      manager_id: body.manager_id ?? body.managerId,
      start_date: body.start_date ?? body.startDate,
      end_date: body.end_date ?? body.endDate,
    });
    return success(res, result, 'Project updated successfully');
  } catch (err) {
    return next(err);
  }
};

export const deleteProjectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireProjectAccess(req, res, id))) return;
    const authReq = req as AuthRequest;
    const result = await deleteProjectService(id, {
      userId: authReq.user?.userId,
      organizationId: authReq.user?.organizationId,
    });
    return success(res, result, 'Project deleted successfully');
  } catch (err) {
    return next(err);
  }
};

export const addProjectMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const organizationId = await requireProjectAccess(req, res, projectId);
    if (!organizationId) return;
    const userId = req.body.user_id ?? req.body.userId;
    if (!userId) throw AppError.badRequest('user_id is required');
    if (!(await userBelongsToOrg(userId, organizationId))) {
      throw AppError.notFound('User not found.', 'USER_NOT_FOUND');
    }
    const result = await addProjectMemberService(projectId, userId, req.body.role);
    return success(res, result, 'Member added to project successfully', 201);
  } catch (err) {
    return next(err);
  }
};

export const removeProjectMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const result = await removeProjectMemberService(projectId, userId);
    return success(res, result, 'Member removed from project successfully');
  } catch (err) {
    return next(err);
  }
};
