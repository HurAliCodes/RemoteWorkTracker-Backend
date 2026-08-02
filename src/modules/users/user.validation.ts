
import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10)
}).strict();

export function validateRefreshToken(data: unknown) {
  return refreshTokenSchema.safeParse(data);
}

export const userSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
}).strict();

export const userChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6)
}).strict();

export const updateUserProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  region: z.string().length(2).optional(),
  email: z.string().email().optional()
}).strict().refine(data => Object.keys(data).length > 0, {
  message: 'At least one field (name, region, or email) must be provided.'
});

export function validateUserSignIn(data: unknown) {
  return userSignInSchema.safeParse(data);
}

export function validateUserChangePassword(data: unknown) {
  return userChangePasswordSchema.safeParse(data);
}

export function validateUpdateUserProfile(data: unknown) {
  return updateUserProfileSchema.safeParse(data);
}
