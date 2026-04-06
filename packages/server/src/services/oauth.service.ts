import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { generateAccessToken, generateRefreshToken } from '../lib/jwt.js';
import { AppError, UnauthorizedError } from '../lib/api-error.js';

// ─── Env helpers ──────────────────────────────────────────────────────────────

function cfg(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function issueTokenPair(userId: string, email: string) {
  const payload = { userId, email };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

// ─── GitHub API types ─────────────────────────────────────────────────────────

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const STATE_PREFIX = 'oauth:state:';
const STATE_TTL = 600; // 10 minutes

/**
 * Build the GitHub OAuth authorization URL and persist a CSRF state token
 * in Redis (TTL 10 min).
 */
export async function getGitHubAuthUrl(): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');
  await redis.set(`${STATE_PREFIX}${state}`, '1', 'EX', STATE_TTL);

  const params = new URLSearchParams({
    client_id: cfg('GITHUB_CLIENT_ID'),
    redirect_uri: cfg('GITHUB_CALLBACK_URL'),
    scope: 'user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Complete the GitHub OAuth flow:
 *  1. Verify CSRF state
 *  2. Exchange code → GitHub access token
 *  3. Fetch GitHub user + emails
 *  4. Find-or-create User and Account records
 *  5. Return JWT token pair
 */
export async function handleGitHubCallback(
  code: string,
  state: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // ── 1. CSRF state check ──────────────────────────────────────────────────
  const stateKey = `${STATE_PREFIX}${state}`;
  const stored = await redis.get(stateKey);
  if (!stored) {
    throw new UnauthorizedError('Invalid or expired OAuth state');
  }
  await redis.del(stateKey); // single-use

  // ── 2. Exchange code for GitHub access token ─────────────────────────────
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: cfg('GITHUB_CLIENT_ID'),
      client_secret: cfg('GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: cfg('GITHUB_CALLBACK_URL'),
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new AppError(
      400,
      'OAUTH_TOKEN_ERROR',
      tokenData.error_description ?? 'Failed to exchange GitHub OAuth code',
    );
  }

  const githubAccessToken = tokenData.access_token;

  // ── 3. Fetch user profile and email list in parallel ─────────────────────
  const authHeader = { Authorization: `Bearer ${githubAccessToken}`, 'User-Agent': 'FlowBoard' };

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers: authHeader }),
    fetch('https://api.github.com/user/emails', { headers: authHeader }),
  ]);

  if (!userRes.ok) {
    throw new AppError(502, 'GITHUB_API_ERROR', 'Failed to fetch GitHub user profile');
  }

  const githubUser = (await userRes.json()) as GitHubUser;
  const emails = emailsRes.ok ? ((await emailsRes.json()) as GitHubEmail[]) : [];

  // Prefer primary + verified email; fall back to public profile email
  const primaryEmail =
    emails.find((e) => e.primary && e.verified)?.email ??
    emails.find((e) => e.verified)?.email ??
    githubUser.email;

  if (!primaryEmail) {
    throw new AppError(
      400,
      'OAUTH_NO_EMAIL',
      'Your GitHub account has no verified email address. Please add a verified email to your GitHub profile.',
    );
  }

  // ── 4. Find-or-create User + Account (single transaction) ────────────────
  const providerAccountId = String(githubUser.id);

  const user = await prisma.$transaction(async (tx) => {
    // Check if this GitHub account is already linked
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      // Update the stored GitHub token and return the linked user
      await tx.account.update({
        where: { id: existingAccount.id },
        data: { accessToken: githubAccessToken },
      });
      return existingAccount.user;
    }

    // No linked account — find by email or create a new user
    let dbUser = await tx.user.findUnique({ where: { email: primaryEmail } });
    if (!dbUser) {
      dbUser = await tx.user.create({
        data: {
          email: primaryEmail,
          name: githubUser.name ?? githubUser.login,
          avatarUrl: githubUser.avatar_url,
          // passwordHash intentionally null — OAuth-only account
        },
      });
    }

    // Link GitHub account to this user
    await tx.account.create({
      data: {
        userId: dbUser.id,
        provider: 'github',
        providerAccountId,
        accessToken: githubAccessToken,
      },
    });

    return dbUser;
  });

  // ── 5. Issue FlowBoard JWT pair ──────────────────────────────────────────
  return issueTokenPair(user.id, user.email);
}
