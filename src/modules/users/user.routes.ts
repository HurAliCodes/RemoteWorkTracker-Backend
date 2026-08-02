import { Router } from 'express';
import { userSignInController, userChangePasswordController, userProfileController, updateUserProfileController, refreshTokenController, logoutController, getManagersController } from './user.controller';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { loginRateLimiter, apiRateLimiter, refreshRateLimiter } from '../../middleware/rateLimit.middleware';
const router = Router();
router.post('/refresh-token', refreshRateLimiter, refreshTokenController);
router.post('/logout', apiRateLimiter, authenticateJWT, requirePortalToken, logoutController);
router.post('/sign-in', loginRateLimiter, userSignInController);
router.post('/change-password', apiRateLimiter, authenticateJWT, requirePortalToken, userChangePasswordController);
router.get('/profile', authenticateJWT, requirePortalToken, userProfileController);
router.patch('/profile', authenticateJWT, requirePortalToken, updateUserProfileController);
router.get('/managers', authenticateJWT, requirePortalToken, getManagersController);

export default router;
