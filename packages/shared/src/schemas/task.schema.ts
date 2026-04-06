import { z } from 'zod';

const priority = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: priority.default('NONE'),
  statusId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  priority: priority.optional(),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const queryTaskSchema = z.object({
  statusId: z.string().uuid().optional(),
  priority: priority.optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reorderTaskSchema = z.object({
  tasks: z
    .array(
      z.object({
        taskId: z.string().uuid(),
        statusId: z.string().uuid(),
        position: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type QueryTaskInput = z.infer<typeof queryTaskSchema>;
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
