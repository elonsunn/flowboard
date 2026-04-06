import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ─── Queue names ─────────────────────────────────────────────────────────────

export const NOTIFICATION_QUEUE = 'notifications';
export const WEBHOOK_QUEUE = 'webhooks';
export const CLEANUP_QUEUE = 'cleanup';

// ─── Redis connection ─────────────────────────────────────────────────────────

/**
 * Parse REDIS_URL into BullMQ-compatible connection options.
 * BullMQ does not accept a URL string directly — it needs host/port/auth.
 */
export function getRedisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  return {
    host: url.hostname || '127.0.0.1',
    port: Number(url.port) || 6379,
    ...(url.password && { password: decodeURIComponent(url.password) }),
    ...(url.pathname && url.pathname !== '/' && { db: Number(url.pathname.slice(1)) }),
    // Workers use blocking BRPOPLPUSH — must not retry on a per-request basis
    maxRetriesPerRequest: null,
  };
}

// ─── Queue factory ───────────────────────────────────────────────────────────

const queues = new Map<string, Queue>();

/** Get (or lazily create) a named queue backed by the shared Redis connection. */
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getRedisConnection() }));
  }
  return queues.get(name)!;
}

/** Close all open queue connections — call during graceful shutdown. */
export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
