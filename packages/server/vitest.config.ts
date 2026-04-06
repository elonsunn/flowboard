import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run test files sequentially — integration tests share Postgres + Redis
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Load env before tests
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/flowboard',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret',
      NODE_ENV: 'test',
    },
  },
});
