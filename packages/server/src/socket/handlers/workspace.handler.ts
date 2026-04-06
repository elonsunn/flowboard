import type { IOServer } from '../../lib/socket.js';
import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@flowboard/shared';
import { prisma } from '../../lib/prisma.js';
import { presenceService } from '../../services/presence.service.js';
import { emitToWorkspace } from '../../lib/realtime.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

async function broadcastPresence(workspaceId: string): Promise<void> {
  const onlineUserIds = await presenceService.getOnlineUsers(workspaceId);
  emitToWorkspace(workspaceId, 'workspace:presence', { workspaceId, onlineUserIds });
}

export function registerWorkspaceHandlers(io: IOServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('workspace:join', async (workspaceId, callback) => {
    try {
      // Verify membership before letting the socket into the room
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!member) {
        callback?.('Not a member of this workspace');
        return;
      }

      await socket.join(`workspace:${workspaceId}`);

      if (!socket.data.joinedWorkspaces.includes(workspaceId)) {
        socket.data.joinedWorkspaces.push(workspaceId);
      }

      await presenceService.heartbeat(workspaceId, userId);
      await broadcastPresence(workspaceId);

      callback?.();
    } catch (err) {
      callback?.('Internal error');
    }
  });

  socket.on('workspace:leave', async (workspaceId) => {
    await socket.leave(`workspace:${workspaceId}`);
    socket.data.joinedWorkspaces = socket.data.joinedWorkspaces.filter((id) => id !== workspaceId);
    await presenceService.removeUser(workspaceId, userId);
    await broadcastPresence(workspaceId);
  });

  socket.on('heartbeat', async (workspaceId) => {
    await presenceService.heartbeat(workspaceId, userId);
  });

  socket.on('disconnect', async () => {
    // Clean up presence for all workspaces this socket had joined
    await Promise.all(
      socket.data.joinedWorkspaces.map(async (workspaceId) => {
        await presenceService.removeUser(workspaceId, userId);
        await broadcastPresence(workspaceId);
      }),
    );
  });
}
