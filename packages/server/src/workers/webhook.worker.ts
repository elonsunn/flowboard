import { Worker, type Job } from 'bullmq';
import { createHmac } from 'crypto';
import { WEBHOOK_QUEUE, getRedisConnection } from '../lib/queue.js';

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface WebhookJobData {
  url: string;
  event: string;
  payload: Record<string, unknown>;
  secret: string;
}

// ─── Processor ────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000;

async function processWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { url, event, payload, secret } = job.data;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Delivery': job.id ?? 'unknown',
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Webhook responded with HTTP ${res.status}`);
    }

    console.log(`[webhook-worker] ✓ delivered ${event} to ${url} (${res.status})`);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Worker export ────────────────────────────────────────────────────────────

export function createWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(WEBHOOK_QUEUE, processWebhook, {
    connection: getRedisConnection(),
    concurrency: 10,
  });

  worker.on('failed', (job, err) => {
    console.error(`[webhook-worker] ✗ job ${job?.id} failed:`, err.message);
  });

  return worker;
}
