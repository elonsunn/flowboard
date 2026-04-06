import { Worker, type Job } from 'bullmq';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NOTIFICATION_QUEUE, getRedisConnection } from '../lib/queue.js';

// ─── Job payload types ────────────────────────────────────────────────────────

export type NotificationJobData =
  | { type: 'TASK_ASSIGNED';       taskId: string; assigneeId: string; assignerId: string }
  | { type: 'TASK_STATUS_CHANGED'; taskId: string; oldStatusId: string; newStatusId: string; changedBy: string }
  | { type: 'TASK_COMMENTED';      taskId: string; commentId: string; commenterId: string }
  | { type: 'TASK_DUE_SOON';       taskId: string; dueDate: string };

// ─── Infrastructure ───────────────────────────────────────────────────────────

// Headless Socket.io server — no HTTP listener, only used to emit via Redis adapter.
// The Redis adapter broadcasts to the main server's adapter, which forwards
// the event to the actual connected WebSocket clients.
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();
const io = new Server({ adapter: createAdapter(pubClient, subClient) });

function emitToUser(userId: string, event: string, data: unknown): void {
  io.to(`user:${userId}`).emit(event, data);
}

// ─── Processor ────────────────────────────────────────────────────────────────

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const data = job.data;
  console.log(`[notification-worker] processing job ${job.id} type=${data.type}`);

  switch (data.type) {
    case 'TASK_ASSIGNED': {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: { title: true, project: { select: { prefix: true, name: true } } },
      });
      if (!task) return;

      const assigner = await prisma.user.findUnique({ where: { id: data.assignerId }, select: { name: true } });
      const title = `Assigned to ${task.project.prefix}: ${task.title}`;
      const content = `${assigner?.name ?? 'Someone'} assigned you to this task in ${task.project.name}`;

      const notification = await prisma.notification.create({
        data: { userId: data.assigneeId, type: NotificationType.TASK_ASSIGNED, title, content, taskId: data.taskId },
      });
      console.log(`[notification-worker] 📬  ${title}`);
      emitToUser(data.assigneeId, 'notification:new', notification);
      break;
    }

    case 'TASK_STATUS_CHANGED': {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: {
          title: true,
          creatorId: true,
          assigneeId: true,
          project: { select: { prefix: true } },
        },
      });
      if (!task) return;

      const [oldStatus, newStatus] = await Promise.all([
        prisma.taskStatus.findUnique({ where: { id: data.oldStatusId }, select: { name: true } }),
        prisma.taskStatus.findUnique({ where: { id: data.newStatusId }, select: { name: true } }),
      ]);

      const changer = await prisma.user.findUnique({ where: { id: data.changedBy }, select: { name: true } });
      const title = `${task.project.prefix}: ${task.title} — status changed`;
      const content = `${changer?.name ?? 'Someone'} moved this task from "${oldStatus?.name}" to "${newStatus?.name}"`;

      // Notify creator and assignee (excluding the person who made the change)
      const recipients = [task.creatorId, task.assigneeId].filter(
        (id): id is string => !!id && id !== data.changedBy,
      );

      await Promise.all(
        recipients.map(async (userId) => {
          const notification = await prisma.notification.create({
            data: { userId, type: NotificationType.TASK_STATUS_CHANGED, title, content, taskId: data.taskId },
          });
          emitToUser(userId, 'notification:new', notification);
        }),
      );
      console.log(`[notification-worker] 📬  ${title} → ${recipients.length} recipient(s)`);
      break;
    }

    case 'TASK_COMMENTED': {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: { title: true, creatorId: true, assigneeId: true, project: { select: { prefix: true } } },
      });
      if (!task) return;

      const commenter = await prisma.user.findUnique({ where: { id: data.commenterId }, select: { name: true } });
      const title = `New comment on ${task.project.prefix}: ${task.title}`;
      const content = `${commenter?.name ?? 'Someone'} left a comment`;

      const recipients = [task.creatorId, task.assigneeId].filter(
        (id): id is string => !!id && id !== data.commenterId,
      );

      await Promise.all(
        recipients.map(async (userId) => {
          const notification = await prisma.notification.create({
            data: { userId, type: NotificationType.TASK_COMMENTED, title, content, taskId: data.taskId },
          });
          emitToUser(userId, 'notification:new', notification);
        }),
      );
      console.log(`[notification-worker] 📬  ${title} → ${recipients.length} recipient(s)`);
      break;
    }

    case 'TASK_DUE_SOON': {
      const task = await prisma.task.findUnique({
        where: { id: data.taskId },
        select: { title: true, assigneeId: true, project: { select: { prefix: true } } },
      });
      if (!task?.assigneeId) return;

      const title = `Due soon: ${task.project.prefix}: ${task.title}`;
      const content = `This task is due on ${new Date(data.dueDate).toLocaleDateString()}`;

      const notification = await prisma.notification.create({
        data: { userId: task.assigneeId, type: NotificationType.TASK_DUE_SOON, title, content, taskId: data.taskId },
      });
      console.log(`[notification-worker] 📬  ${title}`);
      emitToUser(task.assigneeId, 'notification:new', notification);
      break;
    }
  }
}

// ─── Worker export ────────────────────────────────────────────────────────────

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE,
    processNotification,
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[notification-worker] ✓ job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[notification-worker] ✗ job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  return worker;
}
