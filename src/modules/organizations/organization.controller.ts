import { NextFunction, Request, Response } from 'express';
import logger from '../../config/logger';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { success, error as errorResponse } from '../../utils/response';
import { resolveCallerOrganizationId } from '../../utils/resolve-org-from-auth';
import {
  changeAdminPasswordService,
  createOrganizationService,
  deleteUserByIdService,
  getAllUsersService,
  getOrganizationByIdService,
  orgForgotPasswordService,
  organizationLoginService,
  organizationLogoutService,
  organizationRefreshTokenService,
  orgResetPasswordService,
  registerUserService,
  updateUserByIdForOrganizationService,
} from './organization.service';
import {
  registerUserSchema,
  updateOrgUserBodySchema,
  validateChangeAdminPassword,
  validateCreateOrganization,
  validateOrgForgotPassword,
  validateOrgResetPassword,
  validateOrganizationLogin,
  validateOrganizationRefreshToken,
} from './organization.validation';

export const deleteUserByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const deletedUser = await deleteUserByIdService(userId);
    if (!deletedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.status(200).json({ success: true, data: deletedUser });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete user' });
  }
};

export const getAllUsersController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized or missing organization' });
    }
    const users = await getAllUsersService(organizationId);
    return res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch users' });
  }
};

export const updateUserByIdController = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = await resolveCallerOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized or missing organization' });
    }
    const rawId = req.params.id;
    const userId = Array.isArray(rawId) ? rawId[0] : rawId;
    const parsed = updateOrgUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 'Validation failed', 400, parsed.error.flatten());
    }
    const updated = await updateUserByIdForOrganizationService(organizationId, userId!, parsed.data);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found in this organization' });
    }
    return success(res, updated, 'User updated successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    logger.error('updateUserByIdController', { error: message });
    return errorResponse(res, message, 400);
  }
};

export const registerUserController = async (req: Request, res: Response, next: NextFunction) => {
  const result = registerUserSchema.safeParse(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const registerResult = await registerUserService(result.data);
    logger.info('User registered', { userId: registerResult.userId, email: result.data.email });
    res.status(201).json(registerResult);
  } catch (error: any) {
    logger.error('Register user failed', { error });
    if (error.code === '23505' && error.detail && error.detail.includes('already exists')) {
      res.status(409).json({ error: 'A user with this email already exists.' });
    } else {
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  }
};

export const orgForgotPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateOrgForgotPassword(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { email } = result.data;
    const response = await orgForgotPasswordService(email);
    return success(res, response, 'OTP has been sent to your email');
  } catch (err: any) {
    logger.error('Organization forgot password failed', { error: err.message });
    return errorResponse(res, err.message || 'Forgot password failed', 400);
  }
};

export const orgResetPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateOrgResetPassword(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { resetCode, newPassword } = result.data;
    const response = await orgResetPasswordService(resetCode, newPassword);
    return success(res, response, 'Password reset successfully');
  } catch (err: any) {
    logger.error('Organization reset password failed', { error: err.message });
    return errorResponse(res, err.message || 'Reset password failed', 400);
  }
};

export const organizationRefreshTokenController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateOrganizationRefreshToken(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { refreshToken } = result.data;
    const refreshResult = await organizationRefreshTokenService(refreshToken);
    return success(res, refreshResult, 'Token refreshed successfully');
  } catch (err: any) {
    logger.error('Organization refresh token failed', { error: err.message });
    return errorResponse(res, err.message || 'Refresh failed', 401);
  }
};

export const organizationLogoutController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    await organizationLogoutService(refreshToken);
    return success(res, { message: 'Logged out successfully' });
  } catch (err: any) {
    logger.error('Organization logout failed', { error: err.message });
    return errorResponse(res, err.message || 'Logout failed', 400);
  }
};

export const organizationLoginController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateOrganizationLogin(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { email, password } = result.data;
    const loginResult = await organizationLoginService(email,password);
    return success(res, loginResult, 'Organization admin logged in successfully');
  } catch (err: any) {
    logger.error('Organization login failed', { error: err.message });
    return errorResponse(res, err.message || 'Login failed', 401);
  }
};

export const createOrganizationController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateCreateOrganization(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { name, address, organization_type, adminEmail, adminPassword } = result.data;
    const resultData = await createOrganizationService({ name, address, organization_type, adminEmail, adminPassword });
    return success(res, resultData, 'Organization created successfully', 201);
  } catch (err: any) {
    logger.error('Failed to create organization', { error: err.message });
    if (err.code === '23505' && err.detail && err.detail.includes('already exists')) {
      return errorResponse(res, 'An organization with this name already exists.', 409);
    }
    return errorResponse(res, err.message || 'Failed to create organization', 400);
  }
};

export const changeAdminPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  const result = validateChangeAdminPassword(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { organizationId, oldPassword, newPassword } = result.data;
    const response = await changeAdminPasswordService(organizationId, oldPassword, newPassword);
    return success(res, response, 'Admin password changed successfully');
  } catch (err: any) {
    logger.error('Failed to change admin password', { error: err.message });
    return errorResponse(res, err.message || 'Failed to change admin password', 400);
  }
};

export const getOrganizationByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = Array.isArray(id) ? id[0] : id;
    const organization = await getOrganizationByIdService(orgId);
    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }
    const {
      organization_id,
      name,
      address,
      organization_type,
      created_at,
      updated_at
    } = organization;
    return success(res, {
      organization_id,
      name,
      address,
      organization_type,
      created_at,
      updated_at
    }, 'Organization details fetched successfully');
  } catch (err: any) {
    logger.error('Failed to fetch organization', { error: err.message });
    return errorResponse(res, err.message || 'Failed to fetch organization', 400);
  }
};
