import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';

export const healthRouter: import("express").Router = Router();

healthRouter.get('/', asyncHandler(async (_req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
    },
  });
}));
