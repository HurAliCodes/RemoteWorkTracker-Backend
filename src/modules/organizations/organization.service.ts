import { deleteUserByIdRepo, updateUserByIdForOrganizationRepo } from './organization.repo';
export const deleteUserByIdService = async (userId: string) => {
  return await deleteUserByIdRepo(userId);
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
import { getAllUsersRepo } from './organization.repo';
export const getAllUsersService = async (organizationId: string) => {
  return await getAllUsersRepo(organizationId);
};
import { hashPassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { registerUserRepo } from './organization.repo';
import crypto from 'crypto';
export const registerUserService = async (data: any) => {
  const { name, email, password, roleId, departmentId, organizationId, region, salary } = data;
  const db = getDb();
  const department = await db.findOne('departments', { department_id: departmentId });
  if (!department) {
    throw new Error('Department not found. Please provide a valid departmentId.');
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
  const accessToken = signAccessToken({ userId, roleId });
  logger.info('Token generated for user', { userId });
  return {
    userId,
    accessToken,
    expiresIn: 900
  };
};
import { sendResetPasswordEmail } from '../../services/email.service';
export const orgForgotPasswordService = async (email: string) => {
  const db = getDb();
  const org = await db.findOne('organizations', { admin_email: email });
  if (!org) throw new Error('Organization admin not found');
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 
  await pool.query('DELETE FROM password_resets WHERE user_id = $1', [org.organization_id]);
  await db.insert('password_resets', {
    user_id: org.organization_id,
    reset_token: resetToken,
    expires_at: expiresAt.toISOString()
  });
  await sendResetPasswordEmail(email, resetToken);
  return { message: 'OTP has been sent to your email' };
};
export const orgResetPasswordService = async (resetCode: string, newPassword: string) => {
  const db = getDb();
  
  const resetEntry = await db.findOne('password_resets', { reset_token: resetCode });
  if (!resetEntry) throw new Error('Invalid or expired reset code');
  if (new Date(resetEntry.expires_at) < new Date()) {
    await pool.query('DELETE FROM password_resets WHERE reset_token = $1', [resetCode]);
    throw new Error('Reset code expired');
  }
  const org = await db.findOne('organizations', { organization_id: resetEntry.user_id });
  if (!org) throw new Error('Organization not found');
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE organizations SET admin_password_hash = $1 WHERE organization_id = $2', [hashedNewPassword, resetEntry.user_id]);
  await pool.query('DELETE FROM password_resets WHERE reset_token = $1', [resetCode]);
  return { message: 'Password reset successfully' };
};
export const organizationLoginService = async (email: string, password: string) => {
  const db = getDb();
  const org = await db.findOne('organizations', { admin_email: email });
  if (!org) throw new Error('Invalid email or password');
  const valid = await bcrypt.compare(password, org.admin_password_hash);
  if (!valid) throw new Error('Invalid email or password');
  const accessToken = signAccessToken({ organizationId: org.organization_id, admin: true });
  const refreshToken = signRefreshToken({ organizationId: org.organization_id, admin: true });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
  await pool.query('INSERT INTO refresh_tokens (token, organization_id, expires_at, created_at) VALUES ($1, $2, $3, $4)', [refreshToken, org.organization_id, expiresAt.toISOString(), new Date().toISOString()]);
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
  const result = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
  if (result.rowCount === 0) throw new Error('Invalid refresh token');
  const payload = verifyRefreshToken(refreshToken);
  if (typeof payload !== 'object' || !payload || !('organizationId' in payload)) throw new Error('Invalid refresh token payload');
  const accessToken = signAccessToken({ organizationId: (payload as any).organizationId, admin: true });
  return {
    accessToken,
    expiresIn: 900
  };
};
export const organizationLogoutService = async (refreshToken: string) => {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  return true;
};
import bcrypt from 'bcryptjs';
import pool, { getDb } from '../../config/db';
import logger from '../../config/logger';

export const getOrganizationByIdService = async (id: string) => {
  const db = getDb();
  if (!id) throw new Error('Organization id is required');
  const organization = await db.findOne('organizations', { organization_id: id });
  return organization;
};

export const createOrganizationService = async (data: { name: string, address?: string, organization_type?: string, adminEmail: string, adminPassword: string }) => {
  const db = getDb();
  if (!data.name || data.name.length < 2 || data.name.length > 100) {
    logger.warn('Invalid organization name length', { name: data.name });
    throw new Error('Organization name must be between 2 and 100 characters.');
  }
  const organizationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(data.adminPassword, 10);
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

import { findOrganizationById, updateOrganizationAdminPassword } from './organization.repo';

export const changeAdminPasswordService = async (organizationId: string, oldPassword: string, newPassword: string) => {
  
  const org = await findOrganizationById(organizationId);
  if (!org) throw new Error('Organization not found');
  
  const valid = await bcrypt.compare(oldPassword, org.admin_password_hash);
  if (!valid) throw new Error('Old password is incorrect');
  
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE organizations SET admin_password_hash = $1 WHERE organization_id = $2', [hashedNewPassword, organizationId]);
  return { message: 'Admin password changed successfully' };
};
