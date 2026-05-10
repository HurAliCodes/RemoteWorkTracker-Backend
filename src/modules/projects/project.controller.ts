import { Request, Response, NextFunction } from 'express';
import logger from '../../config/logger';
import { success, error as errorResponse } from '../../utils/response';
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

export const createProjectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const result = await createProjectService({
      name: body.name,
      description: body.description,
      manager_id: body.manager_id,
      organization_id: body.organization_id,
      start_date: body.start_date,
      end_date: body.end_date,
    });
    return success(res, result, 'Project created successfully', 201);
  } catch (err: any) {
    logger.error('Failed to create project', { error: err.message });
    if (err.code === '23503') return errorResponse(res, 'Invalid manager_id or organization_id.', 400);
    return errorResponse(res, err.message || 'Failed to create project', 400);
  }
};

export const getAllProjectsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const organization_id = req.query.organization_id as string | undefined;
    const result = await getAllProjectsService({ page, limit, organization_id });
    return success(res, result, 'Projects fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch projects', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch projects', 400);
  }
};

export const listProjectMembersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const members = await listProjectMembersService(id);
    return success(res, members, 'Project members fetched successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch project members';
    logger.error('Failed to fetch project members', { error: message });
    const status = message.includes('not found') ? 404 : 400;
    return errorResponse(res, message, status);
  }
};

export const getProjectByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await getProjectByIdService(id);
    if (!project) return errorResponse(res, 'Project not found', 404);
    return success(res, project, 'Project fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch project', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch project', 400);
  }
};

export const updateProjectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body;
    const result = await updateProjectService(id, {
      name: body.name,
      description: body.description,
      manager_id: body.manager_id,
      start_date: body.start_date,
      end_date: body.end_date,
    });
    return success(res, result, 'Project updated successfully');
  } catch (err: any) {
    logger.error('Failed to update project', { error: err.message });
    if (err.message === 'Project not found.') return errorResponse(res, 'Project not found', 404);
    if (err.code === '23503') return errorResponse(res, 'Invalid manager_id.', 400);
    return errorResponse(res, err.message || 'Failed to update project', 400);
  }
};

export const deleteProjectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await deleteProjectService(id);
    return success(res, result, 'Project deleted successfully');
  } catch (err: any) {
    logger.error('Failed to delete project', { error: err.message });
    if (err.message === 'Project not found.') return errorResponse(res, 'Project not found', 404);
    return errorResponse(res, err.message || 'Failed to delete project', 400);
  }
};

export const addProjectMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { user_id, role } = req.body;
    if (!user_id) return errorResponse(res, 'user_id is required', 400);
    const result = await addProjectMemberService(projectId, user_id, role);
    return success(res, result, 'Member added to project successfully', 201);
  } catch (err: any) {
    logger.error('Failed to add project member', { error: err.message });
    if (err.message === 'Project not found.') return errorResponse(res, 'Project not found', 404);
    if (err.message === 'User not found.') return errorResponse(res, 'User not found', 404);
    if (err.message === 'User is already a member of this project.') return errorResponse(res, err.message, 409);
    return errorResponse(res, err.message || 'Failed to add project member', 400);
  }
};

export const removeProjectMemberController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const result = await removeProjectMemberService(projectId, userId);
    return success(res, result, 'Member removed from project successfully');
  } catch (err: any) {
    logger.error('Failed to remove project member', { error: err.message });
    if (err.message === 'Project not found.') return errorResponse(res, 'Project not found', 404);
    if (err.message === 'Project member not found.') return errorResponse(res, err.message, 404);
    return errorResponse(res, err.message || 'Failed to remove project member', 400);
  }
};
