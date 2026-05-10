export const getRolesController = async (req: Request, res: Response) => {
  try {
    const roles = await getAllRolesService();
    res.status(200).json({ roles });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch roles' });
  }
};
import { Request, Response, NextFunction } from 'express';
import { createRoleService, getAllRolesService } from './role.service';
import { getRoleByIdService, updateRoleService, deleteRoleService } from './role.service';
import logger from '../../config/logger';
import { success, error as errorResponse } from '../../utils/response';

export const createRoleController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    const result = await createRoleService({ name, description });
    return success(res, result, 'Role created successfully', 201);
  } catch (err: any) {
    logger.error('Failed to create role', { error: err.message });
    if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
      return errorResponse(res, 'A role with this name already exists.', 409);
    }
    return errorResponse(res, err.message || 'Failed to create role', 400);
  }
};

export const getRoleByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const role = await getRoleByIdService(id);
    if (!role) return errorResponse(res, 'Role not found', 404);
    return success(res, role, 'Role fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch role', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch role', 400);
  }
};

export const updateRoleController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = req.body;
    const result = await updateRoleService(id, {
      name: body.name,
      description: body.description,
    });
    return success(res, result, 'Role updated successfully');
  } catch (err: any) {
    logger.error('Failed to update role', { error: err.message });
    if (err.message === 'Role not found.') return errorResponse(res, 'Role not found', 404);
    if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
      return errorResponse(res, 'A role with this name already exists.', 409);
    }
    return errorResponse(res, err.message || 'Failed to update role', 400);
  }
};

export const deleteRoleController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await deleteRoleService(id);
    return success(res, result, 'Role deleted successfully');
  } catch (err: any) {
    logger.error('Failed to delete role', { error: err.message });
    if (err.message === 'Role not found.') return errorResponse(res, 'Role not found', 404);
    return errorResponse(res, err.message || 'Failed to delete role', 400);
  }
};
