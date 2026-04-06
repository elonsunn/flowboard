import type { Socket } from 'socket.io';
import type { ExtendedError } from 'socket.io/dist/namespace';
import { verifyAccessToken } from '../lib/jwt.js';

/**
 * Socket.io authentication middleware.
 * Reads the JWT from handshake.auth.token or handshake.query.token,
 * verifies it, and attaches the decoded payload to socket.data.
 * Unauthenticated connections are rejected before any event is processed.
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: ExtendedError) => void,
): void {
  const token =
    (socket.handshake.auth as Record<string, unknown>).token as string | undefined ??
    (socket.handshake.query.token as string | undefined);

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.userId;
    socket.data.email = payload.email;
    socket.data.joinedWorkspaces = [];
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
