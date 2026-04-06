/**
 * Rate limit tests.
 *
 * Each test generates a unique IP via X-Forwarded-For so Redis keys don't
 * bleed between test cases or runs.  The auth limiter (5 req / 60 s) is used
 * because its threshold is low enough to hit quickly in a test.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

// Generate a random IPv4 in the TEST-NET-1 range (192.0.2.x) with a random
// high-entropy suffix so repeated test runs within the 60-second Redis window
// don't reuse keys from the previous run.
function freshIp(): string {
  // 4 random octets → ~4 billion combinations, negligible collision risk
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
}

// Fire N identical requests with the same custom IP
async function sendRequests(n: number, ip: string) {
  const results: request.Response[] = [];
  for (let i = 0; i < n; i++) {
    results.push(
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.com', password: 'Password123' }),
    );
  }
  return results;
}

describe('Auth rate limiter (5 req / 60 s)', () => {
  it('allows exactly 5 requests', async () => {
    const ip = freshIp();
    const responses = await sendRequests(5, ip);

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });

  it('blocks the 6th request with 429', async () => {
    const ip = freshIp();
    const responses = await sendRequests(6, ip);

    // First 5 should be allowed (401 = wrong creds, which is fine)
    for (const res of responses.slice(0, 5)) {
      expect(res.status).not.toBe(429);
    }
    expect(responses[5].status).toBe(429);
  });

  it('returns correct rate-limit headers', async () => {
    const ip = freshIp();
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(res.headers['x-ratelimit-limit']).toBe('5');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
    // Remaining should be a non-negative integer
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
  });

  it('returns Retry-After header on 429', async () => {
    const ip = freshIp();
    await sendRequests(5, ip);

    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('tracks different IPs in separate buckets', async () => {
    const ip1 = freshIp();
    const ip2 = freshIp();

    // Exhaust ip1
    await sendRequests(6, ip1);

    // ip2 should still be unaffected
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip2)
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(res.status).not.toBe(429);
  });
});
