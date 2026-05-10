import crypto from 'crypto';
import logger from '../../config/logger';
import { isAiIntegrationConfigured, syncEmployeeData } from '../ai/ai.service';
import {
  deleteAttendanceById,
  findAllAttendance,
  findAttendanceById,
  findAttendanceByUserId,
  getAiEmployeeSnapshotFromTelemetry,
  updateAttendanceById,
} from './attendance.repository';
export async function getAllAttendance() {
  return findAllAttendance();
}
export async function getAttendanceById(attendanceId: string) {
  return findAttendanceById(attendanceId);
}
export async function getAttendanceByUserId(userId: string) {
  return findAttendanceByUserId(userId);
}

export async function removeAttendanceById(attendanceId: string) {
  return deleteAttendanceById(attendanceId);
}

export async function patchAttendanceById(attendanceId: string, data: Record<string, any>) {
  const updated = await updateAttendanceById(attendanceId, data);
  if (!updated) return null;

  const userId = typeof updated.user_id === 'string' ? updated.user_id : '';
  if (!userId || !isAiIntegrationConfigured()) {
    return updated;
  }

  try {
    const snapshot = await getAiEmployeeSnapshotFromTelemetry(userId);
    if (snapshot) {
      await syncEmployeeData({
        ...snapshot,
        requestId: crypto.randomUUID(),
      });
    }
  } catch (err) {
    logger.warn('AI attendance autosync failed', {
      attendanceId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return updated;
}