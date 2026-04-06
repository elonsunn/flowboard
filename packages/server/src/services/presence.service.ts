import { redis } from '../lib/redis.js';

const PRESENCE_TTL_SECONDS = 5 * 60; // sorted set TTL
const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function presenceKey(workspaceId: string): string {
  return `online:${workspaceId}`;
}

export const presenceService = {
  /**
   * Record that userId is active in workspaceId right now.
   * Score = current Unix ms timestamp. Called on every authenticated WS heartbeat.
   */
  async heartbeat(workspaceId: string, userId: string): Promise<void> {
    const key = presenceKey(workspaceId);
    await redis.zadd(key, Date.now(), userId);
    // Sliding TTL so the set auto-expires when the workspace goes quiet
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  },

  /**
   * Return all userIds active in workspaceId within the last 5 minutes.
   */
  async getOnlineUsers(workspaceId: string): Promise<string[]> {
    const since = Date.now() - ACTIVE_WINDOW_MS;
    return redis.zrangebyscore(presenceKey(workspaceId), since, '+inf');
  },

  /**
   * Mark a user as offline (called on WS disconnect).
   */
  async removeUser(workspaceId: string, userId: string): Promise<void> {
    await redis.zrem(presenceKey(workspaceId), userId);
  },
};
