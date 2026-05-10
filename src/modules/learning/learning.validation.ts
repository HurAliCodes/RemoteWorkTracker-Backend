import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(3, 'title must be at least 3 characters').max(255, 'title cannot exceed 255 characters'),
  description: z.string().max(2000, 'description cannot exceed 2000 characters').optional(),
  instructorId: z.string().uuid('instructorId must be a valid UUID'),
});

export const updateCourseSchema = z
  .object({
    title: z.string().min(3, 'title must be at least 3 characters').max(255, 'title cannot exceed 255 characters').optional(),
    description: z.string().max(2000, 'description cannot exceed 2000 characters').optional(),
    instructorId: z.string().uuid('instructorId must be a valid UUID').optional(),
  })
  .refine((value: Record<string, unknown>) => Object.keys(value).length > 0, {
    message: 'At least one field is required for update',
  });

export const enrollCourseSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const listCoursesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listEnrollmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  userId: z.string().uuid('userId must be a valid UUID').optional(),
  courseId: z.string().uuid('courseId must be a valid UUID').optional(),
  status: z.enum(['ENROLLED', 'COMPLETED', 'DROPPED']).optional(),
});
