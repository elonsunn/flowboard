import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';
import { workspaceRouter } from './workspace.routes.js';
import { projectRouter } from './project.routes.js';
import { taskRouter } from './task.routes.js';
import { taskCommentRouter, commentRouter } from './comment.routes.js';

export const rootRouter: import("express").Router = Router();

rootRouter.use('/health', healthRouter);
rootRouter.use('/auth', authRouter);
rootRouter.use('/users', userRouter);
rootRouter.use('/workspaces', workspaceRouter);
rootRouter.use('/workspaces/:workspaceId/projects', projectRouter);
rootRouter.use('/projects', taskRouter);
rootRouter.use('/tasks', taskCommentRouter);
rootRouter.use('/comments', commentRouter);
