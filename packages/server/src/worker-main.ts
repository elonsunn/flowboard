/**
 * Worker process entry point — runs independently of the Express HTTP server.
 * Start with: pnpm --filter server dev:worker
 */
import 'dotenv/config';
import { createNotificationWorker } from './workers/notification.worker.js';
import { createWebhookWorker } from './workers/webhook.worker.js';
import { createCleanupWorker, scheduleCleanup } from './workers/cleanup.worker.js';
import { closeQueues } from './lib/queue.js';

async function main() {
  console.log('[worker] starting…');

  const notificationWorker = createNotificationWorker();
  const webhookWorker = createWebhookWorker();
  const cleanupWorker = createCleanupWorker();

  // Register the repeatable cleanup job (idempotent — safe to call on every start)
  await scheduleCleanup();

  console.log('[worker] all workers running');

  async function shutdown(signal: string) {
    console.log(`[worker] received ${signal}, shutting down`);
    await Promise.all([
      notificationWorker.close(),
      webhookWorker.close(),
      cleanupWorker.close(),
    ]);
    await closeQueues();
    console.log('[worker] shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal error', err);
  process.exit(1);
});
