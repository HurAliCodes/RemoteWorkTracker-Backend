import type { AuthRequest } from '../middleware/auth.middleware';
import { findUserById } from '../modules/users/user.repo';

/** Employee JWT carries `userId`; org-admin JWT carries `organizationId` + `admin`. */
export async function resolveCallerOrganizationId(req: AuthRequest): Promise<string | null> {
  const u = req.user;
  if (!u) return null;
  const userId = u.userId;
  if (typeof userId === 'string' && userId.trim()) {
    const row = await findUserById(userId);
    return row?.organization_id ?? null;
  }
  if (u.admin === true && typeof u.organizationId === 'string' && u.organizationId.trim()) {
    return u.organizationId.trim();
  }
  return null;
}
