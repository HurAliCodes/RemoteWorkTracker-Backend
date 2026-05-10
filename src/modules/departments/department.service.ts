import { getDb } from '../../config/db';
import pool from '../../config/db';
import logger from '../../config/logger';
import crypto from 'crypto';
import { findDepartmentById, updateDepartmentById } from './department.repo';

export const getDepartmentByIdService = async (departmentId: string) => {
  const row = await findDepartmentById(departmentId);
  if (!row) throw new Error('Department not found');
  return {
    departmentId: row.department_id,
    name: row.name,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateDepartmentService = async (departmentId: string, data: { name?: string; organizationId?: string }) => {
  const row = await updateDepartmentById(departmentId, data);
  if (!row) throw new Error('Department not found');
  return {
    departmentId: row.department_id,
    name: row.name,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const reassignUsersDepartmentService = async (fromDepartmentId: string, toDepartmentId: string) => {
  
  const fromCheck = await pool.query('SELECT 1 FROM departments WHERE department_id = $1', [fromDepartmentId]);
  if (fromCheck.rowCount === 0) {
    throw new Error('Source department not found');
  }
  const toCheck = await pool.query('SELECT 1 FROM departments WHERE department_id = $1', [toDepartmentId]);
  if (toCheck.rowCount === 0) {
    throw new Error('Target department not found');
  }
  
  await pool.query('UPDATE users SET department_id = $1 WHERE department_id = $2', [toDepartmentId, fromDepartmentId]);
  return { message: 'All users reassigned successfully' };
};

export const createDepartmentService = async (data: { name: string, organizationId: string }) => {
  const db = getDb();
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    logger.warn('Invalid department name length', { name: data.name });
    throw new Error('Department name must be between 2 and 100 characters.');
  }
  const organization = await db.findOne('organizations', { organization_id: data.organizationId });
  if (!organization) {
    logger.warn('Organization not found', { organizationId: data.organizationId });
    throw new Error('Organization not found. Please provide a valid organizationId.');
  }
  const departmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert('departments', {
    department_id: departmentId,
    name: data.name,
    organization_id: data.organizationId,
    created_at: now,
    updated_at: now
  });
  logger.info('Department created', { departmentId, name: data.name });
  return {
    departmentId,
    name: data.name,
    createdAt: now
  };
};

export const getAllDepartmentsService = async ({
  page = 1,
  limit = 20,
  organizationId,
}: {
  page?: number;
  limit?: number;
  organizationId?: string;
}) => {
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let whereClause = '';
  if (organizationId) {
    params.push(organizationId);
    whereClause = 'WHERE organization_id = $1';
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM departments ${whereClause}`,
    organizationId ? params : [],
  );
  const totalRecords = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  const listParams = [...params, limit, offset];
  const limitIdx = listParams.length - 1;
  const offsetIdx = listParams.length;
  const result = await pool.query(
    `SELECT department_id, name, organization_id, created_at, updated_at FROM departments
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  return {
    meta: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
    data: result.rows.map((row: any) => ({
      departmentId: row.department_id,
      name: row.name,
      organizationId: row.organization_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
};

export const deleteDepartmentService = async (departmentId: string) => {
  
  const id = Array.isArray(departmentId) ? departmentId[0] : departmentId;
  
  const { rowCount } = await pool.query('SELECT 1 FROM departments WHERE department_id = $1', [id]);
  if (rowCount === 0) {
    throw new Error('Department not found');
  }
  
  const userCheck = await pool.query('SELECT COUNT(*) FROM users WHERE department_id = $1', [id]);
  if (parseInt(userCheck.rows[0].count, 10) > 0) {
    throw new Error('Cannot delete department: users are still assigned to this department. Please reassign or remove users first.');
  }
  await pool.query('DELETE FROM departments WHERE department_id = $1', [id]);
  return { message: 'Department deleted successfully' };
};
