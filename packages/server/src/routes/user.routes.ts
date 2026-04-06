import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';

export const userRouter: import("express").Router = Router();

// All user routes require authentication
userRouter.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const updateMeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  avatarUrl: z.string().url('Must be a valid URL').optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// PATCH /api/users/me
userRouter.patch(
  '/me',
  validate({ body: updateMeSchema }),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof updateMeSchema>;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
    });

    res.json({ success: true, data: { user } });
  }),
);
