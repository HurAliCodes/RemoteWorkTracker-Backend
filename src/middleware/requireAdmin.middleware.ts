import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import pool from '../config/db';

function normalizeRoleName(name: string): string {
	return name.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const MANAGER_ROLES = new Set(['manager', 'admin', 'super_admin']);

async function resolveRoleName(user: AuthRequest['user']): Promise<string> {
	if (!user) return '';
	if (typeof user.role === 'string' && user.role.trim()) {
		return normalizeRoleName(user.role);
	}
	if (typeof user.roleId === 'string' && user.roleId.trim()) {
		try {
			const result = await pool.query('SELECT name FROM roles WHERE role_id = $1 LIMIT 1', [
				user.roleId,
			]);
			return normalizeRoleName(result.rows[0]?.name || '');
		} catch {
			return '';
		}
	}
	return '';
}

/** Org-admin JWT (`admin: true`) or employee with exact Admin / SUPER_ADMIN role. */
export const requireOrgAdmin = async (req: Request, res: Response, next: NextFunction) => {
	const user = (req as AuthRequest).user;
	if (!user) {
		return res.status(403).json({ message: 'Admin access required' });
	}
	if (user.admin === true) {
		return next();
	}
	const roleName = await resolveRoleName(user);
	if (ADMIN_ROLES.has(roleName)) {
		return next();
	}
	return res.status(403).json({ message: 'Admin access required' });
};

export const requireManagerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
	const user = (req as AuthRequest).user;
	if (!user) {
		return res.status(403).json({ message: 'Manager or admin access required' });
	}
	if (user.admin === true) {
		return next();
	}
	const roleName = await resolveRoleName(user);
	if (MANAGER_ROLES.has(roleName)) {
		return next();
	}
	return res.status(403).json({ message: 'Manager or admin access required' });
};

/** True when the caller is an org-admin JWT or has Admin/Manager role. */
export async function isManagerOrAdmin(req: Request): Promise<boolean> {
	const user = (req as AuthRequest).user;
	if (!user) return false;
	if (user.admin === true) return true;
	const roleName = await resolveRoleName(user);
	return MANAGER_ROLES.has(roleName);
}

/** @deprecated Use requireOrgAdmin — kept for import compatibility. */
export const requireAdmin = requireOrgAdmin;
