import { refreshUserTokenService, logoutUserService } from './user.service';
import { validateRefreshToken } from './user.validation';
export const refreshTokenController = async (req: Request, res: Response) => {
  const result = validateRefreshToken(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const { refreshToken } = result.data;
    const tokens = await refreshUserTokenService(refreshToken);
    return success(res, tokens, 'Token refreshed successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to refresh token', 401);
  }
};

export const logoutController = async (req: AuthRequest, res: Response) => {
  const result = validateRefreshToken(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User not authenticated', 401);
    const { refreshToken } = result.data;
    await logoutUserService(userId, refreshToken);
    return success(res, null, 'Logged out successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to logout', 400);
  }
};
import { Request, Response } from 'express';
import { userSignInService, userChangePasswordService, userProfileService, updateUserProfileService, getManagersService } from './user.service';
import { validateUserSignIn, validateUserChangePassword, validateUpdateUserProfile } from './user.validation';
import { success, error as errorResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';

export const userSignInController = async (req: Request, res: Response) => {
  const result = validateUserSignIn(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const data = await userSignInService(result.data);
    return success(res, data, 'Sign in successful');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Sign in failed', 401);
  }
};

export const userChangePasswordController = async (req: AuthRequest, res: Response) => {
  const result = validateUserChangePassword(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User not authenticated', 401);
    await userChangePasswordService(userId, result.data);
    return success(res, null, 'Password changed successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Password change failed', 400);
  }
};

export const userProfileController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User not authenticated', 401);
    const profile = await userProfileService(userId);
    return success(res, profile, 'Profile fetched successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to fetch profile', 400);
  }
};

export const updateUserProfileController = async (req: AuthRequest, res: Response) => {
  const result = validateUpdateUserProfile(req.body);
  if (!result.success) {
    return errorResponse(res, 'Validation failed', 400, result.error.issues);
  }
  try {
    const userId = req.user?.userId;
    if (!userId) return errorResponse(res, 'User not authenticated', 401);
    const updated = await updateUserProfileService(userId, result.data);
    return success(res, updated, 'Profile updated successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to update profile', 400);
  }
};

export const getManagersController = async (req: Request, res: Response) => {
  try {
    const rawOrganizationId = req.query.organizationId;
    const organizationId = typeof rawOrganizationId === 'string' ? rawOrganizationId : undefined;
    const managers = await getManagersService(organizationId);
    return success(res, managers, 'Managers fetched successfully');
  } catch (err: any) {
    return errorResponse(res, err.message || 'Failed to fetch managers', 400);
  }
};
