import { redis } from './redis.js';

// ─── Key conventions ─────────────────────────────────────────────────────────
//   user:{userId}
//   workspace:{workspaceId}:projects
//   project:{projectId}:tasks
//   task:{taskId}

export const CacheKey = {
  user: (userId: string) => `user:${userId}`,
  workspaceProjects: (workspaceId: string) => `workspace:${workspaceId}:projects`,
  projectTasks: (projectId: string) => `project:${projectId}:tasks`,
  task: (taskId: string) => `task:${taskId}`,
  userWorkspaces: (userId: string) => `user:${userId}:workspaces`,
} as const;

// ─── cache-aside ─────────────────────────────────────────────────────────────

export async function cacheable<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const data = await fetcher();
  // Fire-and-forget the write — a cache miss on the next request is fine
  redis.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch((err: Error) =>
    console.error('[cache] set error', key, err.message),
  );
  return data;
}

// ─── Invalidation ─────────────────────────────────────────────────────────────

/** Delete a single key. */
export async function invalidateKey(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Scan-and-delete all keys matching a glob pattern.
 * Uses SCAN with COUNT 100 to avoid blocking the Redis event loop (unlike KEYS).
 */
export async function invalidate(pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
