import { createUserRefreshToken, findUserRefreshToken, deleteUserRefreshToken, findUserByEmail, findUserById, findManagers, updateUserPassword, updateUserProfile } from './user.repo';
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';

export const generateTokens = (user: any) => {
  const accessToken = signAccessToken(
    {
      userId: user.user_id,
      email: user.email,
      roleId: user.role_id,
      organizationId: user.organization_id,
    },
    '15m',
    'user'
  );
  const refreshToken = signRefreshToken({ userId: user.user_id }, '7d', 'user');
  return { accessToken, refreshToken };
};

export const saveUserRefreshTokenService = async (userId: string, refreshToken: string) => {
  
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await createUserRefreshToken(userId, refreshToken, expiresAt);
};

export const refreshUserTokenService = async (refreshToken: string) => {
  let payload: any;
  try {
    payload = verifyRefreshToken(refreshToken) as any;
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }
  const userId = payload.userId;
  const tokenInDb = await findUserRefreshToken(userId, refreshToken);
  if (!tokenInDb) throw new Error('Refresh token not found or already used');
  
  await deleteUserRefreshToken(userId, refreshToken);
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  const tokens = generateTokens(user);
  await saveUserRefreshTokenService(userId, tokens.refreshToken);
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
};

export const logoutUserService = async (userId: string, refreshToken: string) => {
  await deleteUserRefreshToken(userId, refreshToken);
};


export const userSignInService = async ({ email, password }: { email: string; password: string }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error('Invalid email or password');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid email or password');
  
  const { accessToken, refreshToken } = generateTokens(user);
  
  await saveUserRefreshTokenService(user.user_id, refreshToken);
  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      roleId: user.role_id,
      departmentId: user.department_id,
      organizationId: user.organization_id
    }
  };
};

export const userChangePasswordService = async (userId: string, { oldPassword, newPassword }: { oldPassword: string; newPassword: string }) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new Error('Old password is incorrect');
  const newHash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword(userId, newHash);
};

export const userProfileService = async (userId: string) => {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  return {
    userId: user.user_id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    departmentId: user.department_id,
    organizationId: user.organization_id,
    region: user.region,
    salary: user.salary,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
};

export const updateUserProfileService = async (userId: string, data: { name?: string; region?: string; email?: string }) => {
  const row = await updateUserProfile(userId, data);
  if (!row) throw new Error('User not found');
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    departmentId: row.department_id,
    organizationId: row.organization_id,
    region: row.region,
    salary: row.salary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const getManagersService = async (organizationId?: string) => {
  const managers = await findManagers(organizationId);
  return managers.map((manager) => ({
    userId: manager.user_id,
    name: manager.name,
    email: manager.email,
    roleId: manager.role_id,
    departmentId: manager.department_id,
    organizationId: manager.organization_id,
    region: manager.region,
    createdAt: manager.created_at,
    updatedAt: manager.updated_at,
  }));
};
