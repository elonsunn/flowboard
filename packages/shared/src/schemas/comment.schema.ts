import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
