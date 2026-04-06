import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hash, verify } from '../lib/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import { AppError, UnauthorizedError } from '../lib/api-error.js';

export const authRouter = Router();

// 5 req / min per IP on all auth endpoints (brute-force protection)
authRouter.use(authRateLimit);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.string().url().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function issueTokenPair(userId: string, email: string) {
  const payload = { userId, email };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

function sanitizeUser(user: { id: string; email: string; name: string; avatarUrl: string | null; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/auth/register
authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body as z.infer<typeof registerSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await hash(password);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
    });

    const tokens = issueTokenPair(user.id, user.email);

    res.status(201).json({ success: true, data: { user: sanitizeUser(user), ...tokens } });
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    // Intentionally vague error — don't reveal whether email exists
    const passwordValid = user?.passwordHash ? await verify(password, user.passwordHash) : false;
    if (!user || !passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = issueTokenPair(user.id, user.email);

    res.json({ success: true, data: { user: sanitizeUser(user), ...tokens } });
  }),
);

// POST /api/auth/refresh  — token rotation: old refresh → new pair
authRouter.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

    const payload = verifyRefreshToken(refreshToken);

    // Re-fetch user to ensure account still exists and hasn't been suspended
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const tokens = issueTokenPair(user.id, user.email);

    res.json({ success: true, data: tokens });
  }),
);

// GET /api/auth/me
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });
    res.json({ success: true, data: { user } });
  }),
);
