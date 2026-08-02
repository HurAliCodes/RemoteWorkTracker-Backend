import { Router } from 'express';
import {
  getAttendanceController,
  getAttendanceByIdController,
  getMyAttendanceController,
  deleteAttendanceByIdController,
  patchAttendanceByIdController,
} from './attendance.controller';
import {
  checkInController,
  checkOutController,
  listGeoFencesController,
  createGeoFenceController,
  deleteGeoFenceController,
} from './attendance.checkin.controller';
import { authenticateJWT, requirePortalToken } from '../../middleware/auth.middleware';
import { requireOrgAdmin } from '../../middleware/requireAdmin.middleware';

const router = Router();
router.use(authenticateJWT, requirePortalToken);
router.post('/check-in', checkInController);
router.post('/check-out', checkOutController);
router.get('/geo-fences', listGeoFencesController);
router.post('/geo-fences', requireOrgAdmin, createGeoFenceController);
router.delete('/geo-fences/:id', requireOrgAdmin, deleteGeoFenceController);
router.get('/', getAttendanceController);
router.get('/me', getMyAttendanceController);
router.get('/:id', getAttendanceByIdController);
router.delete('/:id', deleteAttendanceByIdController);
router.patch('/:id', patchAttendanceByIdController);
export default router;
