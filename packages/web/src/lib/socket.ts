'use client';

import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@flowboard/shared';
import { getAccessToken } from './api-client';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4007';

// Single shared socket instance — created lazily, reconnects automatically.
let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      auth: (cb) => {
        // Called on every (re)connect so fresh tokens are always used
        cb({ token: getAccessToken() ?? '' });
      },
    });
  }
  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
