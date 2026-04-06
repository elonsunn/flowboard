import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';

export const rootRouter = Router();

rootRouter.use('/health', healthRouter);
rootRouter.use('/auth', authRouter);
rootRouter.use('/users', userRouter);
