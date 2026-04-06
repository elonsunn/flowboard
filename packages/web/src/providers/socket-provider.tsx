'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, connectSocket, disconnectSocket, type AppSocket } from '../lib/socket';
import type { TaskSummaryPayload } from '@flowboard/shared';

interface SocketContextValue {
  socket: AppSocket;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used inside SocketProvider');
  return ctx;
}

interface SocketProviderProps {
  children: ReactNode;
  /** Pass the access token so the provider knows when to connect */
  isAuthenticated: boolean;
}

export function SocketProvider({ children, isAuthenticated }: SocketProviderProps) {
  const qc = useQueryClient();
  const socket = getSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    connectSocket();

    // ── Real-time cache invalidation ────────────────────────────────────────

    function onTaskCreated(task: TaskSummaryPayload & { projectId: string }) {
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    }

    function onTaskUpdated(task: TaskSummaryPayload & { projectId: string }) {
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      qc.invalidateQueries({ queryKey: ['task', task.id] });
    }

    function onTaskDeleted(data: { taskId: string; projectId: string }) {
      qc.invalidateQueries({ queryKey: ['tasks', data.projectId] });
      qc.removeQueries({ queryKey: ['task', data.taskId] });
    }

    function onTaskReordered(data: { projectId: string }) {
      qc.invalidateQueries({ queryKey: ['tasks', data.projectId] });
    }

    function onNotification() {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }

    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('task:reordered', onTaskReordered);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on('notification:new', onNotification);

    return () => {
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('task:reordered', onTaskReordered);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off('notification:new', onNotification);
    };
  }, [isAuthenticated, qc, socket]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}
