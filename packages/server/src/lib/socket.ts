import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@flowboard/shared';

export type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

let _io: IOServer | null = null;

export function initSocketServer(server: HttpServer): IOServer {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  // Redis adapter needs two connections: one for publishing, one for subscribing.
  // Using duplicate() keeps connection options identical.
  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err: Error) => console.error('[socket-redis/pub]', err.message));
  subClient.on('error', (err: Error) => console.error('[socket-redis/sub]', err.message));

  _io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
    // Ping every 25s, disconnect after 60s of silence
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });

  console.log('[socket] server initialized');
  return _io;
}

/** Returns the initialized Socket.io server. Throws if called before initSocketServer(). */
export function getIO(): IOServer {
  if (!_io) throw new Error('[socket] Server not initialized — call initSocketServer() first');
  return _io;
}
