'use client';

import { useEffect } from 'react';
import { useSocketContext } from '../providers/socket-provider';

/**
 * Subscribe to all task events in a project room.
 * Cache invalidation is handled centrally in SocketProvider; this hook only
 * sends the 'task:subscribe' message when the component mounts.
 */
export function useProjectSubscription(projectId: string | undefined): void {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!projectId) return;
    socket.emit('task:subscribe', projectId);
  }, [socket, projectId]);
}

/**
 * Subscribe to comment events for a specific task.
 */
export function useTaskCommentSubscription(taskId: string | undefined): void {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!taskId) return;
    socket.emit('task:comment:subscribe', taskId);
  }, [socket, taskId]);
}
