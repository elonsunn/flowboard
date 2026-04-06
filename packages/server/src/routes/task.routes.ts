import { Router } from 'express';
import { createTaskSchema, updateTaskSchema, queryTaskSchema, reorderTaskSchema } from '@flowboard/shared';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { taskService } from '../services/task.service.js';

export const taskRouter = Router();

taskRouter.use(authenticate);

/**
 * @openapi
 * /projects/{projectId}/tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, statusId]
 *             properties:
 *               title: { type: string, example: Fix login bug }
 *               statusId: { type: string, format: uuid }
 *               description: { type: string }
 *               priority: { type: string, enum: [NONE, LOW, MEDIUM, HIGH, URGENT], default: NONE }
 *               assigneeId: { type: string, format: uuid }
 *               dueDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Task created with auto-incremented number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks with cursor pagination and filters
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Opaque base64url cursor for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: statusId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [NONE, LOW, MEDIUM, HIGH, URGENT] }
 *       - in: query
 *         name: assigneeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated task list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Task' }
 *                     nextCursor: { type: string, nullable: true }
 *                     hasMore: { type: boolean }
 */
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

/**
 * @openapi
 * /projects/{projectId}/tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get task detail (cached 5 min)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Task with comments and activity log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *   patch:
 *     tags: [Tasks]
 *     summary: Update task fields (enqueues notifications on assignee/status change)
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               statusId: { type: string, format: uuid }
 *               priority: { type: string, enum: [NONE, LOW, MEDIUM, HIGH, URGENT] }
 *               assigneeId: { type: string, format: uuid, nullable: true }
 *               dueDate: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete task
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 */
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
