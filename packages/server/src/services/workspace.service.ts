import { WorkspaceRole } from '@prisma/client';
import type { CreateWorkspaceInput, UpdateWorkspaceInput, InviteMemberInput, UpdateMemberRoleInput } from '@flowboard/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, ForbiddenError, NotFoundError } from '../lib/api-error.js';
import { cacheable, invalidateKey, CacheKey } from '../lib/cache.js';

// ─── Selects ─────────────────────────────────────────────────────────────────

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

const memberSelect = {
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

export const workspaceService = {
  async create(userId: string, input: CreateWorkspaceInput) {
    const slugTaken = await prisma.workspace.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new AppError(409, 'SLUG_TAKEN', 'This slug is already in use');

    const workspace = await prisma.workspace.create({
      data: {
        ...input,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
      select: workspaceSelect,
    });

    await invalidateKey(CacheKey.userWorkspaces(userId));
    return workspace;
  },

  async listForUser(userId: string) {
    return cacheable(CacheKey.userWorkspaces(userId), 5 * 60, async () => {
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId },
        select: { role: true, joinedAt: true, workspace: { select: workspaceSelect } },
        orderBy: { joinedAt: 'asc' },
      });
      return memberships.map(({ workspace, role, joinedAt }) => ({ ...workspace, role, joinedAt }));
    });
  },

  async getById(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ...workspaceSelect, members: { select: memberSelect } },
    });
    if (!workspace) throw new NotFoundError('Workspace not found');
    return workspace;
  },

  async update(workspaceId: string, input: UpdateWorkspaceInput) {
    if (input.slug) {
      const conflict = await prisma.workspace.findFirst({
        where: { slug: input.slug, id: { not: workspaceId } },
      });
      if (conflict) throw new AppError(409, 'SLUG_TAKEN', 'This slug is already in use');
    }
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: input,
      select: workspaceSelect,
    });
    // Invalidate every member's workspace list (all members see the updated name/slug)
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    await Promise.all(members.map((m) => invalidateKey(CacheKey.userWorkspaces(m.userId))));
    return workspace;
  },

  async delete(workspaceId: string) {
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await Promise.all(members.map((m) => invalidateKey(CacheKey.userWorkspaces(m.userId))));
  },

  // ── Members ────────────────────────────────────────────────────────────────

  async inviteMember(workspaceId: string, input: InviteMemberInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new NotFoundError('No user found with that email');

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member');

    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: input.role as WorkspaceRole },
      select: memberSelect,
    });
    await invalidateKey(CacheKey.userWorkspaces(user.id));
    return member;
  },

  async updateMemberRole(workspaceId: string, targetUserId: string, requesterId: string, input: UpdateMemberRoleInput) {
    // Can't demote the owner
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundError('Member not found');
    if (target.role === WorkspaceRole.OWNER) throw new ForbiddenError('Cannot change the role of the workspace owner');
    if (targetUserId === requesterId) throw new ForbiddenError('Cannot change your own role');

    const updated = await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role: input.role as WorkspaceRole },
      select: memberSelect,
    });
    await invalidateKey(CacheKey.userWorkspaces(targetUserId));
    return updated;
  },

  async removeMember(workspaceId: string, targetUserId: string, requesterId: string) {
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundError('Member not found');
    if (target.role === WorkspaceRole.OWNER) throw new ForbiddenError('Cannot remove the workspace owner');
    if (targetUserId === requesterId) throw new ForbiddenError('Cannot remove yourself; transfer ownership first');

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    await invalidateKey(CacheKey.userWorkspaces(targetUserId));
  },
};
