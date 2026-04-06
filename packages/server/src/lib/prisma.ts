import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const isDev = process.env.NODE_ENV !== 'production';

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

// Singleton: reuse across hot-reloads in development
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (isDev) {
  globalForPrisma.prisma = prisma;
}
