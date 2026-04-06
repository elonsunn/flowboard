import type { RequestHandler } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/api-error.js';

// Role hierarchy: higher index = more permissions
const ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.MEMBER]: 1,
  [WorkspaceRole.ADMIN]: 2,
  [WorkspaceRole.OWNER]: 3,
};

/**
 * Middleware factory that checks the authenticated user's role in the target
 * workspace (read from req.params.workspaceId). Pass one or more roles that
 * should be allowed; the user's role must be at or above the minimum.
 *
 * Usage: router.delete('/:workspaceId', authenticate, authorize('OWNER', 'ADMIN'), handler)
 */
export function authorize(...allowedRoles: WorkspaceRole[]): RequestHandler {
  const minRank = Math.min(...allowedRoles.map((r) => ROLE_RANK[r]));

  return async (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const { workspaceId } = req.params;
    if (!workspaceId) {
      return next(new ForbiddenError('workspaceId param is required for authorization'));
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.userId } },
      select: { role: true },
    });

    if (!membership) {
      return next(new ForbiddenError('You are not a member of this workspace'));
    }

    if (ROLE_RANK[membership.role] < minRank) {
      return next(new ForbiddenError('Insufficient role'));
    }

    next();
  };
}
