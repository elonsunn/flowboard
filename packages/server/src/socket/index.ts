import type { IOServer } from '../lib/socket.js';
import { socketAuthMiddleware } from './auth.middleware.js';
import { registerWorkspaceHandlers } from './handlers/workspace.handler.js';
import { registerTaskHandlers } from './handlers/task.handler.js';
import { registerCommentHandlers } from './handlers/comment.handler.js';

export function registerSocketHandlers(io: IOServer): void {
  // Authenticate every socket before it can emit or listen to any event
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`[socket] connected  user=${socket.data.userId} id=${socket.id}`);
    // Join the user's personal room so the notification worker can target them
    // across processes via the Redis adapter
    void socket.join(`user:${socket.data.userId}`);

    registerWorkspaceHandlers(io, socket);
    registerTaskHandlers(io, socket);
    registerCommentHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected user=${socket.data.userId} id=${socket.id} reason=${reason}`);
    });
  });
}
