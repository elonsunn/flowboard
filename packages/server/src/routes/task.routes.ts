import { Router } from 'express';
import { createTaskSchema, updateTaskSchema, queryTaskSchema, reorderTaskSchema } from '@flowboard/shared';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { taskService } from '../services/task.service.js';

export const taskRouter = Router();

taskRouter.use(authenticate);

// POST /api/projects/:projectId/tasks
taskRouter.post(
  '/:projectId/tasks',
  validate({ body: createTaskSchema }),
  asyncHandler(async (req, res) => {
    const task = await taskService.create(req.params.projectId, req.user!.userId, req.body);
    res.status(201).json({ success: true, data: { task } });
  }),
);

// GET /api/projects/:projectId/tasks
taskRouter.get(
  '/:projectId/tasks',
  validate({ query: queryTaskSchema }),
  asyncHandler(async (req, res) => {
    const result = await taskService.list(req.params.projectId, req.user!.userId, req.query as any);
    res.json({ success: true, data: result });
  }),
);

// PATCH /api/projects/:projectId/tasks/reorder  — must be before /:taskId
taskRouter.patch(
  '/:projectId/tasks/reorder',
  validate({ body: reorderTaskSchema }),
  asyncHandler(async (req, res) => {
    await taskService.reorder(req.params.projectId, req.user!.userId, req.body);
    res.json({ success: true, data: null });
  }),
);

// GET /api/projects/:projectId/tasks/:taskId
taskRouter.get(
  '/:projectId/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const task = await taskService.getById(req.params.projectId, req.params.taskId, req.user!.userId);
    res.json({ success: true, data: { task } });
  }),
);

// PATCH /api/projects/:projectId/tasks/:taskId
taskRouter.patch(
  '/:projectId/tasks/:taskId',
  validate({ body: updateTaskSchema }),
  asyncHandler(async (req, res) => {
    const task = await taskService.update(
      req.params.projectId,
      req.params.taskId,
      req.user!.userId,
      req.body,
    );
    res.json({ success: true, data: { task } });
  }),
);

// DELETE /api/projects/:projectId/tasks/:taskId
taskRouter.delete(
  '/:projectId/tasks/:taskId',
  asyncHandler(async (req, res) => {
    await taskService.delete(req.params.projectId, req.params.taskId, req.user!.userId);
    res.status(204).send();
  }),
);
