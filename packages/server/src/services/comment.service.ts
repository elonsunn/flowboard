import { ActivityAction } from '@prisma/client';
import type { CreateCommentInput } from '@flowboard/shared';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/api-error.js';
import { emitToTask } from '../lib/realtime.js';

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, avatarUrl: true } },
} as const;

async function assertTaskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, project: { select: { workspaceId: true } } },
  });
  if (!task) throw new NotFoundError('Task not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: task.project.workspaceId, userId } },
  });
  if (!member) throw new ForbiddenError('Not a member of this workspace');

  return { task, member };
}

export const commentService = {
  async create(taskId: string, userId: string, input: CreateCommentInput) {
    await assertTaskAccess(taskId, userId);

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { taskId, authorId: userId, content: input.content },
        select: commentSelect,
      });
      await tx.activity.create({
        data: {
          taskId,
          actorId: userId,
          action: ActivityAction.COMMENTED,
          metadata: { commentId: created.id },
        },
      });
      return created;
    });

    // Broadcast to all clients subscribed to this task's comment feed
    emitToTask(taskId, 'task:comment:new', { ...comment, taskId });

    return comment;
  },

  async list(taskId: string, userId: string) {
    await assertTaskAccess(taskId, userId);
    return prisma.comment.findMany({
      where: { taskId },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  async delete(commentId: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, taskId: true, task: { select: { project: { select: { workspaceId: true } } } } },
    });
    if (!comment) throw new NotFoundError('Comment not found');

    // Allow author OR workspace admin/owner
    if (comment.authorId !== userId) {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: comment.task.project.workspaceId, userId } },
      });
      if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
        throw new ForbiddenError('Only the author or an admin can delete this comment');
      }
    }

    await prisma.comment.delete({ where: { id: commentId } });
  },
};
