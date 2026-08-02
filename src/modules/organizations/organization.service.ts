import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool, { getDb } from '../../config/db';
import logger from '../../config/logger';
import { hashPassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { sendResetPasswordEmail } from '../../services/email.service';
import {
  deleteUserByIdRepo,
  updateUserByIdForOrganizationRepo,
  getAllUsersRepo,
  registerUserRepo,
  findOrganizationById,
} from './organization.repo';

export const deleteUserByIdService = async (
  userId: string,
  organizationId: string,
  actorUserId?: string | null
) => {
  return await deleteUserByIdRepo(userId, organizationId, actorUserId);
};

export const updateUserByIdForOrganizationService = async (
  organizationId: string,
  userId: string,
  body: {
    name?: string;
    roleId?: string;
    role_id?: string;
    departmentId?: string;
    department_id?: string;
    region?: string;
    salary?: number | string;
  }
) => {
  const role_id = body.role_id ?? body.roleId;
  const department_id = body.department_id ?? body.departmentId;
  const updates: Partial<{
    name: string;
    role_id: string;
    department_id: string;
    region: string;
    salary: number | string | null;
  }> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (role_id !== undefined) updates.role_id = role_id;
  if (department_id !== undefined) updates.department_id = department_id;
  if (body.region !== undefined) updates.region = body.region;
  if (body.salary !== undefined) updates.salary = body.salary;
  return updateUserByIdForOrganizationRepo(userId, organizationId, updates);
};

export const getAllUsersService = async (organizationId: string) => {
  return await getAllUsersRepo(organizationId);
};

export const registerUserService = async (data: any, callerOrganizationId: string) => {
  const { name, email, password, roleId, departmentId, region, salary } = data;
  const organizationId = callerOrganizationId;
  const db = getDb();
  const department = await db.findOne('departments', { department_id: departmentId });
  if (!department) {
    throw new Error('Department not found. Please provide a valid departmentId.');
  }
  if (department.organization_id && department.organization_id !== organizationId) {
    throw new Error('Department does not belong to this organization.');
  }
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  await registerUserRepo({
    user_id: userId,
    name,
    email,
    password_hash: hashedPassword,
    role_id: roleId,
    department_id: departmentId,
    organization_id: organizationId,
    region,
    salary
  });
  const accessToken = signAccessToken({ userId, roleId, organizationId }, '15m', 'user');
  logger.info('Token generated for user', { userId });
  return {
    userId,
    accessToken,
    expiresIn: 900
  };
};

export const orgForgotPasswordService = async (email: string) => {
  const db = getDb();
  const org = await db.findOne('organizations', { admin_email: email });
  // Always return the same message to avoid user enumeration
  const generic = { message: 'If an account exists for this email, an OTP has been sent' };
  if (!org) return generic;
  const resetToken = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_resets (user_id, reset_token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET reset_token = EXCLUDED.reset_token, expires_at = EXCLUDED.expires_at`,
    [org.organization_id, resetToken, expiresAt.toISOString()]
  ).catch(async () => {
    // Fallback if FK still points at users: store against a synthetic path via organizations table extension
    await pool.query('DELETE FROM password_resets WHERE reset_token = $1', [resetToken]);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS org_password_resets (
        organization_id UUID PRIMARY KEY,
        reset_token VARCHAR(12) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )`
    );
    await pool.query(
      `INSERT INTO org_password_resets (organization_id, reset_token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id) DO UPDATE SET reset_token = EXCLUDED.reset_token, expires_at = EXCLUDED.expires_at`,
      [org.organization_id, resetToken, expiresAt.toISOString()]
    );
  });
  try {
    await sendResetPasswordEmail(email, resetToken);
  } catch (err) {
    logger.error('Failed to send reset email', { error: err });
  }
  return generic;
};

export const orgResetPasswordService = async (resetCode: string, newPassword: string) => {
  let organizationId: string | null = null;
  const resetEntry = await pool.query(
    'SELECT * FROM password_resets WHERE reset_token = $1',
    [resetCode]
  );
  if (resetEntry.rows[0]) {
    organizationId = resetEntry.rows[0].user_id;
    if (new Date(resetEntry.rows[0].expires_at) < new Date()) {
      await pool.query('DELETE FROM password_resets WHERE reset_token = $1', [resetCode]);
      throw new Error('Reset code expired');
    }
  } else {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS org_password_resets (
        organization_id UUID PRIMARY KEY,
        reset_token VARCHAR(12) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )`
    );
    const orgReset = await pool.query(
      'SELECT * FROM org_password_resets WHERE reset_token = $1',
      [resetCode]
    );
    if (!orgReset.rows[0]) throw new Error('Invalid or expired reset code');
    if (new Date(orgReset.rows[0].expires_at) < new Date()) {
      await pool.query('DELETE FROM org_password_resets WHERE reset_token = $1', [resetCode]);
      throw new Error('Reset code expired');
    }
    organizationId = orgReset.rows[0].organization_id;
  }
  if (!organizationId) throw new Error('Invalid or expired reset code');
  const org = await findOrganizationById(organizationId);
  if (!org) throw new Error('Organization not found');
  const hashedNewPassword = await hashPassword(newPassword);
  await pool.query('UPDATE organizations SET admin_password_hash = $1 WHERE organization_id = $2', [
    hashedNewPassword,
    organizationId,
  ]);
  await pool.query('DELETE FROM password_resets WHERE reset_token = $1', [resetCode]).catch(() => undefined);
  await pool.query('DELETE FROM org_password_resets WHERE reset_token = $1', [resetCode]).catch(() => undefined);
  return { message: 'Password reset successfully' };
};

export const organizationLoginService = async (email: string, password: string) => {
  const db = getDb();
  const org = await db.findOne('organizations', { admin_email: email });
  if (!org) throw new Error('Invalid email or password');
  const valid = await bcrypt.compare(password, org.admin_password_hash);
  if (!valid) throw new Error('Invalid email or password');
  const accessToken = signAccessToken({ organizationId: org.organization_id, admin: true }, '15m', 'org_admin');
  const refreshToken = signRefreshToken({ organizationId: org.organization_id, admin: true }, '7d', 'org_admin');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (token, organization_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [refreshToken, org.organization_id, expiresAt.toISOString(), new Date().toISOString()]
  );
  return {
    organizationId: org.organization_id,
    accessToken,
    refreshToken,
    expiresIn: 900,
    adminEmail: org.admin_email,
    organizationName: org.name
  };
};

export const organizationRefreshTokenService = async (refreshToken: string) => {
  const result = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [refreshToken]
  );
  if (result.rowCount === 0) throw new Error('Invalid refresh token');
  const payload = verifyRefreshToken(refreshToken);
  if (typeof payload !== 'object' || !payload || !('organizationId' in payload)) {
    throw new Error('Invalid refresh token payload');
  }
  const organizationId = (payload as { organizationId: string }).organizationId;
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  const accessToken = signAccessToken({ organizationId, admin: true }, '15m', 'org_admin');
  const nextRefresh = signRefreshToken({ organizationId, admin: true }, '7d', 'org_admin');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (token, organization_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
    [nextRefresh, organizationId, expiresAt.toISOString(), new Date().toISOString()]
  );
  return {
    accessToken,
    refreshToken: nextRefresh,
    expiresIn: 900
  };
};

export const organizationLogoutService = async (refreshToken: string) => {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  return true;
};

export const getOrganizationByIdService = async (id: string) => {
  const db = getDb();
  if (!id) throw new Error('Organization id is required');
  const organization = await db.findOne('organizations', { organization_id: id });
  return organization;
};

export const createOrganizationService = async (data: {
  name: string;
  address?: string;
  organization_type?: string;
  adminEmail: string;
  adminPassword: string;
}) => {
  const db = getDb();
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    logger.warn('Invalid organization name length', { name: data.name });
    throw new Error('Organization name must be between 2 and 100 characters.');
  }
  const organizationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(data.adminPassword);
  await db.insert('organizations', {
    organization_id: organizationId,
    name: data.name,
    address: data.address || null,
    organization_type: data.organization_type || null,
    admin_email: data.adminEmail,
    admin_password_hash: passwordHash,
    created_at: now,
    updated_at: now
  });
  logger.info('Organization and admin created', { organizationId, adminEmail: data.adminEmail });
  return {
    organizationId,
    name: data.name,
    address: data.address || null,
    organization_type: data.organization_type || null,
    adminEmail: data.adminEmail,
    createdAt: now
  };
};

export const changeAdminPasswordService = async (
  organizationId: string,
  oldPassword: string,
  newPassword: string
) => {
  const org = await findOrganizationById(organizationId);
  if (!org) throw new Error('Organization not found');
  const valid = await bcrypt.compare(oldPassword, org.admin_password_hash);
  if (!valid) throw new Error('Old password is incorrect');
  const hashedNewPassword = await hashPassword(newPassword);
  await pool.query('UPDATE organizations SET admin_password_hash = $1 WHERE organization_id = $2', [
    hashedNewPassword,
    organizationId,
  ]);
  return { message: 'Admin password changed successfully' };
};
