/**
 * Why two tokens?
 *
 * Access token (short-lived, 15 min):
 *   Sent with every API request. Short expiry limits damage if stolen — an
 *   attacker's window is brief and no server-side revocation list is needed.
 *
 * Refresh token (long-lived, 7 days):
 *   Stored securely by the client (httpOnly cookie or secure storage). Never
 *   sent to resource endpoints — only to /auth/refresh. When the access token
 *   expires, the client silently exchanges the refresh token for a new pair
 *   (token rotation). Rotation means each refresh token is single-use:
 *   if a stolen token is replayed, the legitimate holder's next refresh will
 *   fail, alerting the system to a potential compromise.
 *
 * Separate secrets prevent a refresh token from being accepted as an access
 * token (and vice versa) even if both are valid JWTs.
 */

import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './api-error.js';

export interface TokenPayload {
  userId: string;
  email: string;
}

function getSecret(envVar: string): string {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`Missing required environment variable: ${envVar}`);
  return secret;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret('JWT_ACCESS_SECRET'), { expiresIn: '15m' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret('JWT_REFRESH_SECRET'), { expiresIn: '7d' });
}

function verifyToken(token: string, secret: string): TokenPayload {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

export function verifyAccessToken(token: string): TokenPayload {
  return verifyToken(token, getSecret('JWT_ACCESS_SECRET'));
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verifyToken(token, getSecret('JWT_REFRESH_SECRET'));
}
