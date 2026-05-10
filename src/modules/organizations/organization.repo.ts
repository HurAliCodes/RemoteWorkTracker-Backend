import pool from '../../config/db';
import { getDb } from '../../config/db';

export const getAllUsersRepo = async (organizationId: string) => {
	const result = await pool.query(
		'SELECT * FROM users WHERE organization_id = $1 ORDER BY name ASC NULLS LAST',
		[organizationId]
	);
	return result.rows;
};

export const deleteUserByIdRepo = async (userId: string) => {
	const result = await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING *', [userId]);
	return result.rows[0] || null;
};

export const updateUserByIdForOrganizationRepo = async (
	userId: string,
	organizationId: string,
	updates: Partial<{
		name: string;
		role_id: string;
		department_id: string;
		region: string;
		salary: number | string | null;
	}>
) => {
	const existing = await pool.query(
		'SELECT * FROM users WHERE user_id = $1 AND organization_id = $2',
		[userId, organizationId]
	);
	if (!existing.rows[0]) return null;
	const row = existing.rows[0];
	const name = updates.name !== undefined ? updates.name : row.name;
	const role_id = updates.role_id !== undefined ? updates.role_id : row.role_id;
	const department_id = updates.department_id !== undefined ? updates.department_id : row.department_id;
	const region = updates.region !== undefined ? updates.region : row.region;
	const salary = updates.salary !== undefined ? updates.salary : row.salary;
	const now = new Date().toISOString();

	const result = await pool.query(
		`UPDATE users SET name = $1, role_id = $2, department_id = $3, region = $4, salary = $5, updated_at = $6
     WHERE user_id = $7 AND organization_id = $8
     RETURNING *`,
		[name, role_id, department_id, region, salary, now, userId, organizationId]
	);
	return result.rows[0] || null;
};

export const registerUserRepo = async (user: any) => {
	const db = getDb();
	await db.insert('users', user);
	return user.userId;
};

export const findOrganizationById = async (organizationId: string) => {
	const result = await pool.query('SELECT * FROM organizations WHERE organization_id = $1', [organizationId]);
	return result.rows[0] || null;
};

export const updateOrganizationAdminPassword = async (organizationId: string, newPasswordHash: string) => {
	const adminUser = await pool.query(
		'SELECT user_id FROM users WHERE organization_id = $1 AND name = $2',
		[organizationId, 'Admin']
	);
	if (!adminUser.rows[0]) throw new Error('Admin user not found for this organization');
	await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [
		newPasswordHash,
		adminUser.rows[0].user_id,
	]);
	return true;
};
