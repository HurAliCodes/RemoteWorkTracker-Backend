import express from 'express';
import {
  registerDevice,
  heartbeat,
  activity,
  idle,
  createPairingCode,
  refreshDeviceToken,
  revokeDeviceRefresh,
} from './agent.controller';
import {
  authenticateJWT,
  requireDeviceToken,
  requireEmployeeToken,
} from '../../middleware/auth.middleware';
import {
  agentRegisterRateLimiter,
  refreshRateLimiter,
} from '../../middleware/rateLimit.middleware';

const router = express.Router();
router.post('/pairing-code', authenticateJWT, requireEmployeeToken, createPairingCode);
router.post('/register', agentRegisterRateLimiter, registerDevice);
router.post('/refresh-token', refreshRateLimiter, refreshDeviceToken);
router.post('/revoke', authenticateJWT, requireDeviceToken, revokeDeviceRefresh);
router.post('/heartbeat', authenticateJWT, requireDeviceToken, heartbeat);
router.post('/activity', authenticateJWT, requireDeviceToken, activity);
router.post('/idle', authenticateJWT, requireDeviceToken, idle);
export default router;
