import { z } from 'zod';

export const departmentIdParamSchema = z.string().uuid();
export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  organizationId: z.string().uuid().optional(),
});

export function validateDepartmentId(id: unknown) {
  return departmentIdParamSchema.safeParse(id);
}

export function validateUpdateDepartment(data: unknown) {
  return updateDepartmentSchema.safeParse(data);
}

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
