/**
 * Shared test helpers.
 *
 * Each test file is responsible for its own cleanup in afterAll so that
 * parallel CI shards don't stomp on each other. Use the `uid` helper to
 * generate unique email/slug prefixes scoped to a single test run.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { hash } from '../lib/password.js';
import { generateAccessToken, generateRefreshToken } from '../lib/jwt.js';

// ─── Unique-per-run prefix ────────────────────────────────────────────────────

// Uses randomUUID so parallel vitest workers never collide, even at the same ms.
export function uid(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

export async function createTestUser(overrides: Partial<{ email: string; name: string; password: string }> = {}): Promise<TestUser> {
  const email = overrides.email ?? `${uid()}@test.example`;
  const name = overrides.name ?? 'Test User';
  const password = overrides.password ?? 'Password123';

  const passwordHash = await hash(password);
  const user = await prisma.user.create({ data: { email, name, passwordHash } });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accessToken: generateAccessToken({ userId: user.id, email: user.email }),
    refreshToken: generateRefreshToken({ userId: user.id, email: user.email }),
  };
}

// ─── Workspace / project hierarchy ───────────────────────────────────────────

export async function createTestWorkspace(ownerId: string, slug?: string) {
  const s = slug ?? uid();
  return prisma.workspace.create({
    data: {
      name: `Workspace ${s}`,
      slug: s,
      members: { create: { userId: ownerId, role: 'OWNER' } },
    },
  });
}

export async function createTestProject(workspaceId: string, prefix?: string) {
  const p = prefix ?? uid().slice(-4).toUpperCase();
  return prisma.project.create({
    data: {
      workspaceId,
      name: `Project ${p}`,
      prefix: p,
      statuses: {
        create: [
          { name: 'Todo', color: '#6b7280', position: 0 },
          { name: 'In Progress', color: '#3b82f6', position: 1 },
          { name: 'Done', color: '#22c55e', position: 2 },
        ],
      },
    },
    include: { statuses: true },
  });
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

export async function deleteUsers(ids: string[]): Promise<void> {
  if (!ids.length) return;
  // Delete membership + workspace records first so FK constraints don't block user deletion
  await prisma.workspaceMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export { prisma };
