import { z } from 'zod';

export const registerUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/),
  roleId: z.string().uuid(),
  departmentId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  region: z.string().length(2),
  salary: z.number().min(0)
}).strict();
export const orgForgotPasswordSchema = z.object({
  email: z.string().email()
}).strict();

export const orgResetPasswordSchema = z.object({
  resetCode: z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
}).strict();

export function validateOrgForgotPassword(data: unknown) {
  return orgForgotPasswordSchema.safeParse(data);
}

export function validateOrgResetPassword(data: unknown) {
  return orgResetPasswordSchema.safeParse(data);
}
export const organizationRefreshTokenSchema = z.object({
  refreshToken: z.string().min(10)
}).strict();

export function validateOrganizationRefreshToken(data: unknown) {
  return organizationRefreshTokenSchema.safeParse(data);
}
export const organizationLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
}).strict();

export function validateOrganizationLogin(data: unknown) {
  return organizationLoginSchema.safeParse(data);
}

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  organization_type: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6)
}).strict();

export function validateCreateOrganization(data: unknown) {
  return createOrganizationSchema.safeParse(data);
}

export const changeAdminPasswordSchema = z.object({
  organizationId: z.string().uuid(),
  oldPassword: z.string().min(8),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
}).strict();

export function validateChangeAdminPassword(data: unknown) {
  return changeAdminPasswordSchema.safeParse(data);
}

/** PATCH body for org admin updating an employee in their tenant */
export const updateOrgUserBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    roleId: z.string().uuid().optional(),
    role_id: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    region: z.string().max(100).optional(),
    salary: z.union([z.number(), z.string()]).optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.name !== undefined ||
      d.roleId !== undefined ||
      d.role_id !== undefined ||
      d.departmentId !== undefined ||
      d.department_id !== undefined ||
      d.region !== undefined ||
      d.salary !== undefined,
    { message: 'At least one field is required' }
  );
