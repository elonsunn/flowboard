import { Router } from 'express';
import { healthRouter } from './health.routes.js';

export const rootRouter = Router();

rootRouter.use('/health', healthRouter);
