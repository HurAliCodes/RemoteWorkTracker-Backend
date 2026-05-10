import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import {
  getNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  deleteNotificationController,
} from './notification.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', getNotificationsController);
router.patch('/read-all', markAllNotificationsReadController);
router.patch('/:id/read', markNotificationReadController);
router.delete('/:id', deleteNotificationController);

export default router;
