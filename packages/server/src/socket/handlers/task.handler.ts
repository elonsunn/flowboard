import type { IOServer } from '../../lib/socket.js';
import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@flowboard/shared';
import { prisma } from '../../lib/prisma.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerTaskHandlers(io: IOServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('task:subscribe', async (projectId) => {
    // Verify access before subscribing
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
    });
    if (!member) return;

    await socket.join(`project:${projectId}`);
  });

  socket.on('task:comment:subscribe', async (taskId) => {
    // Verify access before subscribing
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { project: { select: { workspaceId: true } } },
    });
    if (!task) return;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: task.project.workspaceId, userId } },
    });
    if (!member) return;

    await socket.join(`task:${taskId}`);
  });
}
