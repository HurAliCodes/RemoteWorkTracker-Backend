import { z } from 'zod';

export const createTaskSchema = z.object({
  project_id: z.uuid(),
  assigned_to: z.uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
});

export const updateTaskSchema = z.object({
  assigned_to: z.uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  priority: z.string().max(50).optional().nullable(),
});

export const createTaskCommentSchema = z.object({
  comment: z.string().min(1),
});

export const createTaskAttachmentSchema = z.object({
  file_path: z.string().min(1).max(255),
});
