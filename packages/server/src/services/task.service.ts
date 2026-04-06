import { ActivityAction } from '@prisma/client';
import type { CreateTaskInput, UpdateTaskInput, QueryTaskInput, ReorderTaskInput } from '@flowboard/shared';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../lib/api-error.js';
import { cacheable, invalidateKey, CacheKey } from '../lib/cache.js';
import { emitToProject } from '../lib/realtime.js';

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });
  if (!project) throw new NotFoundError('Project not found');

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
  });
  if (!member) throw new ForbiddenError('Not a member of this workspace');

  return { project, member };
}

// ─── Selects ─────────────────────────────────────────────────────────────────

const taskSummarySelect = {
  id: true,
  number: true,
  title: true,
  priority: true,
  position: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  status: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
} as const;

const taskDetailSelect = {
  ...taskSummarySelect,
  description: true,
  parentTaskId: true,
  creator: { select: { id: true, name: true, avatarUrl: true } },
  subTasks: { select: { id: true, number: true, title: true, priority: true, status: { select: { id: true, name: true, color: true } } } },
  comments: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  activities: {
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// ─── Cursor helpers ───────────────────────────────────────────────────────────

function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const taskService = {
  async create(projectId: string, userId: string, input: CreateTaskInput) {
    await assertProjectAccess(projectId, userId);

    // Verify statusId belongs to this project
    const status = await prisma.taskStatus.findFirst({ where: { id: input.statusId, projectId } });
    if (!status) throw new NotFoundError('Status not found in this project');

    const task = await prisma.$transaction(async (tx) => {

      const agg = await tx.task.aggregate({ where: { projectId }, _max: { number: true, position: true } });
      const number = (agg._max.number ?? 0) + 1;

      // Position at end of target status column
      const colMax = await tx.task.aggregate({ where: { projectId, statusId: input.statusId }, _max: { position: true } });
      const position = (colMax._max.position ?? -1) + 1;

      const created = await tx.task.create({
        data: {
          projectId,
          creatorId: userId,
          number,
          position,
          title: input.title,
          description: input.description,
          priority: input.priority ?? 'NONE',
          statusId: input.statusId,
          assigneeId: input.assigneeId ?? null,
          parentTaskId: input.parentTaskId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
        select: taskSummarySelect,
      });

      await tx.activity.create({
        data: {
          taskId: created.id,
          actorId: userId,
          action: ActivityAction.CREATED,
          metadata: { title: created.title },
        },
      });

      return created;
    });

    // Invalidate task list cache and broadcast to subscribed clients
    await invalidateKey(CacheKey.projectTasks(projectId));
    emitToProject(projectId, 'task:created', { ...task, projectId });

    return task;
  },

  async list(projectId: string, userId: string, query: QueryTaskInput) {
    await assertProjectAccess(projectId, userId);

    const { statusId, priority, assigneeId, search, cursor, limit } = query;

    const where = {
      projectId,
      ...(statusId && { statusId }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
      ...(search && { title: { contains: search, mode: 'insensitive' as const } }),
    };

    const tasks = await prisma.task.findMany({
      where,
      select: taskSummarySelect,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: decodeCursor(cursor) }, skip: 1 }),
    });

    const hasMore = tasks.length > limit;
    const items = hasMore ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1].id) : null;

    return { items, nextCursor, hasMore };
  },

  async getById(projectId: string, taskId: string, userId: string) {
    await assertProjectAccess(projectId, userId);

    return cacheable(CacheKey.task(taskId), 5 * 60, async () => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
        select: taskDetailSelect,
      });
      if (!task) throw new NotFoundError('Task not found');
      return task;
    });
  },

  async update(projectId: string, taskId: string, userId: string, input: UpdateTaskInput) {
    await assertProjectAccess(projectId, userId);

    const old = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!old) throw new NotFoundError('Task not found');

    const activities: { action: ActivityAction; metadata: object }[] = [];

    // Compute position if status changed
    let position = old.position;
    if (input.statusId && input.statusId !== old.statusId) {
      const colMax = await prisma.task.aggregate({
        where: { projectId, statusId: input.statusId, id: { not: taskId } },
        _max: { position: true },
      });
      position = (colMax._max.position ?? -1) + 1;
      activities.push({
        action: ActivityAction.STATUS_CHANGED,
        metadata: { from: old.statusId, to: input.statusId },
      });
    }

    if (input.assigneeId !== undefined && input.assigneeId !== old.assigneeId) {
      activities.push({
        action: ActivityAction.ASSIGNED,
        metadata: { from: old.assigneeId, to: input.assigneeId },
      });
    }

    const hasOtherChanges =
      (input.title && input.title !== old.title) ||
      (input.description !== undefined && input.description !== old.description) ||
      (input.priority && input.priority !== old.priority) ||
      (input.dueDate !== undefined);

    if (hasOtherChanges) {
      activities.push({ action: ActivityAction.UPDATED, metadata: { fields: Object.keys(input) } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: {
          ...input,
          position,
          dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
        },
        select: taskSummarySelect,
      });

      if (activities.length > 0) {
        await tx.activity.createMany({
          data: activities.map((a) => ({ taskId, actorId: userId, ...a })),
        });
      }

      return result;
    });

    // Invalidate caches and broadcast
    await Promise.all([
      invalidateKey(CacheKey.task(taskId)),
      invalidateKey(CacheKey.projectTasks(projectId)),
    ]);
    emitToProject(projectId, 'task:updated', { ...updated, projectId });

    return updated;
  },

  async delete(projectId: string, taskId: string, userId: string) {
    await assertProjectAccess(projectId, userId);
    const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundError('Task not found');
    await prisma.task.delete({ where: { id: taskId } });
    await Promise.all([
      invalidateKey(CacheKey.task(taskId)),
      invalidateKey(CacheKey.projectTasks(projectId)),
    ]);
    emitToProject(projectId, 'task:deleted', { taskId, projectId });
  },

  async reorder(projectId: string, userId: string, input: ReorderTaskInput) {
    await assertProjectAccess(projectId, userId);

    await prisma.$transaction(
      input.tasks.map(({ taskId, statusId, position }) =>
        prisma.task.update({
          where: { id: taskId, projectId },
          data: { statusId, position },
        }),
      ),
    );

    // Invalidate detail caches for all reordered tasks + the list, then broadcast
    await Promise.all([
      ...input.tasks.map(({ taskId }) => invalidateKey(CacheKey.task(taskId))),
      invalidateKey(CacheKey.projectTasks(projectId)),
    ]);
    emitToProject(projectId, 'task:reordered', { tasks: input.tasks, projectId });
  },
};
