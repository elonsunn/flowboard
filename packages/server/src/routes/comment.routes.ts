import { Router } from 'express';
import { createCommentSchema } from '@flowboard/shared';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { commentService } from '../services/comment.service.js';

// Two routers: one for task-scoped comment operations, one for direct comment operations
export const taskCommentRouter = Router();
export const commentRouter = Router();

taskCommentRouter.use(authenticate);
commentRouter.use(authenticate);

// POST /api/tasks/:taskId/comments
taskCommentRouter.post(
  '/:taskId/comments',
  validate({ body: createCommentSchema }),
  asyncHandler(async (req, res) => {
    const comment = await commentService.create(req.params.taskId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: { comment } });
  }),
);

// GET /api/tasks/:taskId/comments
taskCommentRouter.get(
  '/:taskId/comments',
  asyncHandler(async (req, res) => {
    const comments = await commentService.list(req.params.taskId, req.user!.userId);
    res.json({ success: true, data: { comments } });
  }),
);

// DELETE /api/comments/:commentId
commentRouter.delete(
  '/:commentId',
  asyncHandler(async (req, res) => {
    await commentService.delete(req.params.commentId, req.user!.userId);
    res.status(204).send();
  }),
);
