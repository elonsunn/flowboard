/**
 * Comment handler.
 * Subscription logic lives here; actual broadcasts are triggered by comment.service.ts
 * via realtime.emitToTask() after a successful createComment call.
 * This file is a placeholder for any future comment-specific socket commands
 * (e.g., typing indicators).
 */
import type { IOServer } from '../../lib/socket.js';
import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@flowboard/shared';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerCommentHandlers(_io: IOServer, _socket: AppSocket): void {
  // Comment subscriptions are handled in task.handler.ts via 'task:comment:subscribe'
}
