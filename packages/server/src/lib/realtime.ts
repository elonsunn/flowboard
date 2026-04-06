/**
 * Thin wrappers around Socket.io room broadcasts.
 * Services call these after mutations so they stay decoupled from HTTP/WS concerns.
 * All methods are fire-and-forget — failure to emit never breaks the HTTP response.
 */

import { getIO } from './socket.js';

function emit(room: string, event: string, data: unknown): void {
  try {
    getIO().to(room).emit(event, data);
  } catch {
    // Socket server not yet initialized (e.g. during tests) — silently skip
  }
}

/** Broadcast to all clients subscribed to a project's task feed */
export function emitToProject(projectId: string, event: string, data: unknown): void {
  emit(`project:${projectId}`, event, data);
}

/** Broadcast to all clients subscribed to a specific task's comment feed */
export function emitToTask(taskId: string, event: string, data: unknown): void {
  emit(`task:${taskId}`, event, data);
}

/** Broadcast to all clients in a workspace room */
export function emitToWorkspace(workspaceId: string, event: string, data: unknown): void {
  emit(`workspace:${workspaceId}`, event, data);
}
