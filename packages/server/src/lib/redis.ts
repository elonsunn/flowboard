import Redis from 'ioredis';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(url, {
  // Don't crash the process on startup connection failures — let the
  // error event + retries handle recovery.
  lazyConnect: false,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => console.log('[redis] connected'));
redis.on('ready', () => console.log('[redis] ready'));
redis.on('error', (err: Error) => console.error('[redis] error', err.message));
redis.on('close', () => console.log('[redis] connection closed'));
redis.on('reconnecting', () => console.log('[redis] reconnecting...'));

export async function gracefulShutdown(): Promise<void> {
  await redis.quit();
  console.log('[redis] gracefully disconnected');
}
