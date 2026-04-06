import 'dotenv/config';
import http from 'http';
import { app } from './app.js';
import { prisma } from './lib/prisma.js';
import { gracefulShutdown as redisShutdown } from './lib/redis.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  await prisma.$connect();
  console.log('[db] connected');

  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`[server] received ${signal}, shutting down gracefully`);
    server.close(async () => {
      await Promise.all([prisma.$disconnect(), redisShutdown()]);
      console.log('[db] disconnected');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
