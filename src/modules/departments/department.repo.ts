import pool, { getDb } from '../../config/db';
import crypto from 'crypto';
export const findDepartmentById = async (departmentId: string) => {
  const id = Array.isArray(departmentId) ? departmentId[0] : departmentId;
  const query = 'SELECT department_id, name, organization_id, created_at, updated_at FROM departments WHERE department_id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};
export const updateDepartmentById = async (departmentId: string, data: { name?: string; organizationId?: string }) => {
  const id = Array.isArray(departmentId) ? departmentId[0] : departmentId;
  const fields = [];
  const values = [];
  let idx = 1;
  if (data.name) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.organizationId) {
    fields.push(`organization_id = $${idx++}`);
    values.push(data.organizationId);
  }
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }
  fields.push(`updated_at = $${idx}`);
  values.push(new Date().toISOString());
  const query = `UPDATE departments SET ${fields.join(', ')} WHERE department_id = $${idx + 1} RETURNING department_id, name, organization_id, created_at, updated_at`;
  values.push(id);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};
export const insertDepartment = async (data: { name: string, organizationId: string }) => {
  const db = getDb();
  
  const departmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert('departments', {
    department_id: departmentId,
    name: data.name,
    organization_id: data.organizationId,
    created_at: now,
    updated_at: now
  });
  return {
    departmentId,
    name: data.name,
    createdAt: now
  };
};
