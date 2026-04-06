/**
 * Sliding window rate limiter backed by Redis sorted sets.
 *
 * How it works:
 *   Each request adds an entry to a sorted set keyed by identifier (IP or userId).
 *   The score is the current timestamp in ms; the member is a unique request ID.
 *   Before counting, we ZREMRANGEBYSCORE to evict entries outside the window.
 *   ZCARD then gives the exact number of requests in the current window.
 *
 * Why sorted sets over a simple counter?
 *   A fixed-window counter resets at clock boundaries, allowing 2× bursts at
 *   the boundary. A sorted set gives a true sliding window: every request is
 *   counted within the last windowMs milliseconds, regardless of wall-clock
 *   alignment.
 */

import { randomUUID } from 'crypto';
import type { RequestHandler, Request } from 'express';
import { redis } from '../lib/redis.js';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  /**
   * Namespace for the Redis key — prevents different limiters from sharing the
   * same bucket even when they use the same IP-based identifier.
   */
  namespace?: string;
  /** Return the bucket identifier for a request. Defaults to IP address. */
  keyGenerator?: (req: Request) => string;
}

function getIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

export function rateLimit({ windowMs, maxRequests, namespace = 'default', keyGenerator }: RateLimitOptions): RequestHandler {
  const getKey = keyGenerator ?? ((req) => `ratelimit:${namespace}:ip:${getIP(req)}`);

  return async (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();
    const windowStart = now - windowMs;
    const requestId = randomUUID();
    const resetAt = Math.ceil((now + windowMs) / 1000); // Unix seconds

    try {
      // Pipeline: remove stale → add current → count → set TTL
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zadd(key, now, requestId);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);

      const results = await pipeline.exec();
      // results[2] = [error, count]
      const count = (results?.[2]?.[1] as number) ?? 0;
      const remaining = Math.max(0, maxRequests - count);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetAt);

      if (count > maxRequests) {
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests — limit is ${maxRequests} per ${windowMs / 1000}s window`,
          },
        });
        return;
      }

      next();
    } catch (err) {
      // Redis failure → fail open (don't block legitimate traffic)
      console.error('[rate-limit] redis error, failing open:', (err as Error).message);
      next();
    }
  };
}

// ─── Preset limiters ─────────────────────────────────────────────────────────

/** Global: 100 req / minute per IP — namespace 'global' keeps this bucket separate from auth */
export const globalRateLimit: RequestHandler = rateLimit({ windowMs: 60_000, maxRequests: 100, namespace: 'global' });

/** Auth endpoints: 5 req / minute per IP — stricter brute-force protection */
export const authRateLimit: RequestHandler = rateLimit({ windowMs: 60_000, maxRequests: 5, namespace: 'auth' });
