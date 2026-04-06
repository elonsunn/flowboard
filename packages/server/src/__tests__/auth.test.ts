/**
 * Auth integration tests.
 *
 * Each describe block uses a distinct X-Forwarded-For IP so the auth rate
 * limiter (5 req / 60 s) doesn't bleed across groups.  The IPs are in the
 * RFC 5737 TEST-NET range (192.0.2.0/24) and are never reused across files
 * because each vitest worker has its own counter via uid().
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { createTestUser, prisma, uid } from './setup.js';

// One unique random IP per describe block — keeps each group under the 5/min
// auth rate limit and avoids collisions with Redis keys from previous runs.
function blockIp(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
}

const cleanupIds: string[] = [];

afterAll(async () => {
  if (cleanupIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: cleanupIds } } });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const ip = blockIp();

  it('registers a new user and returns token pair', async () => {
    const email = `${uid()}@test.example`;

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email, password: 'Password123', name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.passwordHash).toBeUndefined();

    cleanupIds.push(res.body.data.user.id);
  });

  it('returns 409 for duplicate email', async () => {
    const ip2 = blockIp();
    const email = `${uid()}@test.example`;

    const first = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip2)
      .send({ email, password: 'Password123', name: 'Alice' });
    cleanupIds.push(first.body.data.user.id);

    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip2)
      .send({ email, password: 'Password123', name: 'Alice Again' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email: 'not-an-email', password: 'Password123', name: 'Alice' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for weak password (no number)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send({ email: `${uid()}@test.example`, password: 'Password', name: 'Alice' });

    expect(res.status).toBe(422);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const ip = blockIp();
  let email: string;

  beforeAll(async () => {
    email = `${uid()}@test.example`;
    const user = await createTestUser({ email }); // direct DB call, no HTTP
    cleanupIds.push(user.id);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'nobody@test.example', password: 'Password123' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  const ip = blockIp();

  it('issues a new token pair from a valid refresh token', async () => {
    const user = await createTestUser();
    cleanupIds.push(user.id);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: user.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('returns 401 for a tampered refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', ip)
      .send({ refreshToken: 'this.is.not.a.valid.jwt' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  const ip = blockIp();

  it('returns the authenticated user', async () => {
    const user = await createTestUser();
    cleanupIds.push(user.id);

    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Forwarded-For', ip);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('X-Forwarded-For', ip)
      .set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
  });
});
