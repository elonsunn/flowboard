import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  prefix: z
    .string()
    .min(1)
    .max(8)
    .regex(/^[A-Z0-9]+$/, 'Prefix must be uppercase letters and numbers'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  prefix: z
    .string()
    .min(1)
    .max(8)
    .regex(/^[A-Z0-9]+$/)
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
