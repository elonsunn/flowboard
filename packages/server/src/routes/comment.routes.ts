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

/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   post:
 *     tags: [Comments]
 *     summary: Add a comment to a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, minLength: 1 }
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment: { $ref: '#/components/schemas/Comment' }
 *   get:
 *     tags: [Comments]
 *     summary: List comments for a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Comment list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     comments:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Comment' }
 */
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
