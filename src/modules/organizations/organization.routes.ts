import express from 'express';
import { deleteUserByIdController, getAllUsersController, updateUserByIdController } from './organization.controller';
import {
  createOrganizationController,
  getOrganizationByIdController,
  organizationLoginController,
  organizationRefreshTokenController,
  organizationLogoutController,
  orgForgotPasswordController,
  orgResetPasswordController,
  changeAdminPasswordController
} from './organization.controller';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';
import { validate } from '../../middleware/validate.middleware';
import { changeAdminPasswordSchema } from './organization.validation';
import { registerUserController } from './organization.controller';
import { registerUserSchema } from './organization.validation';
import {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
} from '../../middleware/rateLimit.middleware';

const router = express.Router();

router.post('/login', loginRateLimiter, organizationLoginController);
router.post('/refresh-token', refreshRateLimiter, organizationRefreshTokenController);
router.post('/logout', organizationLogoutController);
router.post('/forgot-password', forgotPasswordRateLimiter, orgForgotPasswordController);
router.post('/reset-password', resetPasswordRateLimiter, orgResetPasswordController);
router.post('/', registerRateLimiter, createOrganizationController);
router.post(
  '/register',
  authenticateJWT,
  requirePortalToken,
  requireOrgAdmin,
  registerRateLimiter,
  validate(registerUserSchema),
  registerUserController
);
router.get('/users', authenticateJWT, requirePortalToken, requireOrgAdmin, getAllUsersController);
router.patch('/users/:id', authenticateJWT, requirePortalToken, requireOrgAdmin, updateUserByIdController);
router.delete('/users/:id', authenticateJWT, requirePortalToken, requireOrgAdmin, deleteUserByIdController);
router.get('/:id', authenticateJWT, requirePortalToken, getOrganizationByIdController);
router.post(
  '/change-admin-password',
  authenticateJWT,
  requirePortalToken,
  requireOrgAdmin,
  validate(changeAdminPasswordSchema),
  changeAdminPasswordController
);
export default router;
