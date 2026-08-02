import { Router } from 'express';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import {
  getNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
} from './notification.controller';
import {
  registerPushTokenController,
  unregisterPushTokenController,
} from './push.controller';

const router = Router();

router.use(authenticateJWT, requirePortalToken);

router.post('/push-token', registerPushTokenController);
router.delete('/push-token', unregisterPushTokenController);
router.get('/', getNotificationsController);
router.patch('/read-all', markAllNotificationsReadController);
router.patch('/:id/read', markNotificationReadController);
router.delete('/:id', deleteNotificationController);

export default router;
