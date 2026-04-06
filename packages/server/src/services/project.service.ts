import type { CreateProjectInput, UpdateProjectInput } from '@flowboard/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, NotFoundError } from '../lib/api-error.js';

const DEFAULT_STATUSES = [
  { name: 'Backlog', color: '#94a3b8', position: 0 },
  { name: 'Todo', color: '#60a5fa', position: 1 },
  { name: 'In Progress', color: '#f59e0b', position: 2 },
  { name: 'Done', color: '#22c55e', position: 3 },
];

const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  prefix: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const projectService = {
  async create(workspaceId: string, input: CreateProjectInput) {
    const prefixTaken = await prisma.project.findFirst({
      where: { workspaceId, prefix: input.prefix },
    });
    if (prefixTaken) throw new AppError(409, 'PREFIX_TAKEN', 'A project with this prefix already exists in the workspace');

    return prisma.project.create({
      data: {
        workspaceId,
        ...input,
        statuses: { createMany: { data: DEFAULT_STATUSES } },
      },
      select: { ...projectSelect, statuses: { orderBy: { position: 'asc' } } },
    });
  },

  async listForWorkspace(workspaceId: string) {
    return prisma.project.findMany({
      where: { workspaceId },
      select: projectSelect,
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(workspaceId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: {
        ...projectSelect,
        statuses: { orderBy: { position: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundError('Project not found');
    return project;
  },

  async update(workspaceId: string, projectId: string, input: UpdateProjectInput) {
    await this.getById(workspaceId, projectId); // existence check

    if (input.prefix) {
      const conflict = await prisma.project.findFirst({
        where: { workspaceId, prefix: input.prefix, id: { not: projectId } },
      });
      if (conflict) throw new AppError(409, 'PREFIX_TAKEN', 'A project with this prefix already exists');
    }

    return prisma.project.update({
      where: { id: projectId },
      data: input,
      select: projectSelect,
    });
  },

  async delete(workspaceId: string, projectId: string) {
    await this.getById(workspaceId, projectId); // existence + ownership check
    await prisma.project.delete({ where: { id: projectId } });
  },
};
