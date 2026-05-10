import express from 'express';
const router = express.Router();
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
import { authenticateJWT } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { changeAdminPasswordSchema } from './organization.validation';
import { registerUserController } from './organization.controller';
import { registerUserSchema } from './organization.validation';
import {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
  registerRateLimiter,
} from '../../middleware/rateLimit.middleware';

router.post('/login', loginRateLimiter, organizationLoginController);
router.post('/refresh-token', organizationRefreshTokenController);
router.post('/logout', organizationLogoutController);
router.post('/forgot-password', forgotPasswordRateLimiter, orgForgotPasswordController);
router.post('/reset-password', resetPasswordRateLimiter, orgResetPasswordController);
router.post('/', createOrganizationController);
router.post('/register', registerRateLimiter, validate(registerUserSchema), registerUserController);
router.get('/users', authenticateJWT, getAllUsersController);
router.patch('/users/:id', authenticateJWT, updateUserByIdController);
router.delete('/users/:id', authenticateJWT, deleteUserByIdController);
router.get('/:id', authenticateJWT, getOrganizationByIdController);
router.post(
  '/change-admin-password',
  authenticateJWT,
  validate(changeAdminPasswordSchema),
  changeAdminPasswordController
);
export default router;