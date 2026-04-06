'use client';

import { useEffect, useState } from 'react';
import { useSocketContext } from '../providers/socket-provider';
import type { PresencePayload } from '@flowboard/shared';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Join a workspace presence room and track online users.
 * Automatically sends heartbeats every 30 s and cleans up on unmount.
 */
export function usePresence(workspaceId: string | undefined) {
  const { socket } = useSocketContext();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId) return;

    socket.emit('workspace:join', workspaceId);

    function onPresence(data: PresencePayload) {
      if (data.workspaceId === workspaceId) {
        setOnlineUserIds(data.onlineUserIds);
      }
    }
    socket.on('workspace:presence', onPresence);

    const heartbeat = setInterval(() => {
      socket.emit('heartbeat', workspaceId);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      socket.off('workspace:presence', onPresence);
      socket.emit('workspace:leave', workspaceId);
    };
  }, [socket, workspaceId]);

  return { onlineUserIds };
}
