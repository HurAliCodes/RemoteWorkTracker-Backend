export const getAllRolesService = async () => {
  const db = getDb();
  const result = await (db as any).selectAll('roles');
  return result;
};
import { getDb } from '../../config/db';
import pool from '../../config/db';
import logger from '../../config/logger';
import crypto from 'crypto';
export const createRoleService = async (data: { name: string, description?: string }) => {
  const db = getDb();
  if (!data.name || data.name.length < 3 || data.name.length > 100) {
    logger.warn('Invalid role creation input', { name: data.name });
    throw new Error('name (3-100 chars) is required.');
  }
  const roleId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert('roles', {
    role_id: roleId,
    name: data.name,
    description: data.description || null,
    created_at: now,
    updated_at: now
  });
  logger.info('Role created', { roleId, name: data.name });
  return {
    roleId,
    name: data.name,
    description: data.description || null,
    createdAt: now,
    updatedAt: now
  };
};

export const getRoleByIdService = async (id: string) => {
  const db = getDb();
  const role = await db.findOne('roles', { role_id: id });
  return role;
};

export const updateRoleService = async (id: string, data: { name?: string; description?: string }) => {
  const db = getDb();
  const existing = await db.findOne('roles', { role_id: id });
  if (!existing) throw new Error('Role not found.');
  const updateData: any = {};
  if (data.name !== undefined) {
    if (data.name.length < 3 || data.name.length > 100) throw new Error('Role name must be 3-100 chars.');
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (Object.keys(updateData).length === 0) throw new Error('No valid fields to update.');
  updateData.updated_at = new Date().toISOString();
  
  const keys = Object.keys(updateData);
  const values = Object.values(updateData);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const query = `UPDATE roles SET ${setClause} WHERE role_id = $${keys.length + 1} RETURNING *`;
  const result = await pool.query(query, [...values, id]);
  return result.rows[0];
};

export const deleteRoleService = async (id: string) => {
  const db = getDb();
  const existing = await db.findOne('roles', { role_id: id });
  if (!existing) throw new Error('Role not found.');
  const query = `DELETE FROM roles WHERE role_id = $1`;
  const result = await pool.query(query, [id]);
  return { message: 'Role deleted successfully.' };
};
