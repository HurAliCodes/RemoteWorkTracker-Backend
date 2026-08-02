
export const createUserRefreshToken = async (userId: string, token: string, expiresAt: Date) => {
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
};

export const findUserRefreshToken = async (userId: string, token: string) => {
  const result = await pool.query(
    'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2',
    [userId, token]
  );
  return result.rows[0] || null;
};

export const deleteUserRefreshToken = async (userId: string, token: string) => {
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2',
    [userId, token]
  );
};
import pool from '../../config/db';
import bcrypt from 'bcryptjs';

export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    'SELECT user_id, email, password_hash, name, role_id, department_id, organization_id FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  return result.rows[0] || null;
};

export const findUserById = async (userId: string) => {
  const result = await pool.query(
    'SELECT user_id, name, email, role_id, department_id, organization_id, region, salary, created_at, updated_at, password_hash FROM users WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  );
  return result.rows[0] || null;
};

export const findManagers = async (organizationId?: string) => {
  const values: string[] = [];
  let query = `
    SELECT
      u.user_id,
      u.name,
      u.email,
      u.role_id,
      u.department_id,
      u.organization_id,
      u.region,
      u.created_at,
      u.updated_at
    FROM users u
    INNER JOIN roles r ON r.role_id = u.role_id
    WHERE (
      LOWER(TRIM(r.name)) = 'manager'
      OR LOWER(TRIM(r.name)) LIKE '%manager%'
      OR LOWER(TRIM(r.name)) = 'admin'
    )
  `;

  if (organizationId) {
    values.push(organizationId);
    query += ` AND u.organization_id = $1`;
  }

  query += ` AND u.deleted_at IS NULL ORDER BY u.name ASC`;
  const result = await pool.query(query, values);
  return result.rows;
};

export const updateUserPassword = async (userId: string, newPasswordHash: string) => {
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2', [newPasswordHash, userId]);
};

export const updateUserProfile = async (userId: string, data: { name?: string; region?: string; email?: string }) => {
  const fields = [];
  const values = [];
  let idx = 1;
  if (data.name) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.region) {
    fields.push(`region = $${idx++}`);
    values.push(data.region);
  }
  if (data.email) {
    fields.push(`email = $${idx++}`);
    values.push(data.email);
  }
  if (fields.length === 0) throw new Error('No valid fields to update');
  fields.push(`updated_at = $${idx}`);
  values.push(new Date().toISOString());
  const query = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx + 1} RETURNING user_id, name, email, role_id, department_id, organization_id, region, salary, created_at, updated_at`;
  values.push(userId);
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};
