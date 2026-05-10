import { Router } from 'express';
import { userSignInController, userChangePasswordController, userProfileController, updateUserProfileController, refreshTokenController, logoutController, getManagersController } from './user.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { loginRateLimiter, apiRateLimiter } from '../../middleware/rateLimit.middleware';
const router = Router();
router.post('/refresh-token', apiRateLimiter, refreshTokenController);
router.post('/logout', apiRateLimiter, authenticateJWT, logoutController);
router.post('/sign-in', loginRateLimiter, userSignInController);
router.post('/change-password', apiRateLimiter, authenticateJWT, userChangePasswordController);
router.get('/profile', authenticateJWT, userProfileController);
router.patch('/profile', authenticateJWT, updateUserProfileController);
router.get('/managers', authenticateJWT, getManagersController);

export default router;
