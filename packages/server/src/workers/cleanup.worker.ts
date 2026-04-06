import { Worker, Queue, type Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { CLEANUP_QUEUE, getRedisConnection } from '../lib/queue.js';

// ─── Processor ────────────────────────────────────────────────────────────────

async function runCleanup(job: Job): Promise<void> {
  console.log(`[cleanup-worker] starting daily cleanup (job ${job.id})`);
  const now = new Date();

  // Delete notifications that are read and older than 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const { count: notifCount } = await prisma.notification.deleteMany({
    where: { read: true, createdAt: { lt: thirtyDaysAgo } },
  });

  // Delete activity records older than 90 days
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000);
  const { count: activityCount } = await prisma.activity.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  console.log(
    `[cleanup-worker] ✓ removed ${notifCount} old notifications, ${activityCount} old activity records`,
  );
}

// ─── Repeatable job registration ─────────────────────────────────────────────

export async function scheduleCleanup(): Promise<void> {
  const queue = new Queue(CLEANUP_QUEUE, { connection: getRedisConnection() });

  // Idempotent: BullMQ deduplicates repeatable jobs by name+cron
  await queue.add(
    'daily-cleanup',
    {},
    {
      repeat: { pattern: '0 2 * * *' }, // 2:00 AM every day
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    },
  );

  await queue.close();
  console.log('[cleanup-worker] daily cleanup job scheduled (cron: 0 2 * * *)');
}

// ─── Worker export ────────────────────────────────────────────────────────────

export function createCleanupWorker(): Worker {
  const worker = new Worker(CLEANUP_QUEUE, runCleanup, {
    connection: getRedisConnection(),
    concurrency: 1, // Only one cleanup at a time
  });

  worker.on('completed', (job) => {
    console.log(`[cleanup-worker] ✓ job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[cleanup-worker] ✗ job ${job?.id} failed:`, err.message);
  });

  return worker;
}
