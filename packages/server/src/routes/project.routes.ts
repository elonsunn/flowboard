import { Router } from 'express';
import { WorkspaceRole } from '@prisma/client';
import { createProjectSchema, updateProjectSchema } from '@flowboard/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { projectService } from '../services/project.service.js';

// Mounted at /api/workspaces/:workspaceId/projects — workspaceId is inherited via mergeParams
export const projectRouter = Router({ mergeParams: true });

projectRouter.use(authenticate);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a project (ADMIN or OWNER)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, prefix]
 *             properties:
 *               name: { type: string, example: My Project }
 *               prefix: { type: string, example: PROJ }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Project created with default statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project: { $ref: '#/components/schemas/Project' }
 *   get:
 *     tags: [Projects]
 *     summary: List projects in a workspace
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Project' }
 */
// POST /api/workspaces/:workspaceId/projects
projectRouter.post(
  '/',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  validate({ body: createProjectSchema }),
  asyncHandler(async (req, res) => {
    const project = await projectService.create(req.params.workspaceId, req.body);
    res.status(201).json({ success: true, data: { project } });
  }),
);

// GET /api/workspaces/:workspaceId/projects
projectRouter.get(
  '/',
  authorize(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    const projects = await projectService.listForWorkspace(req.params.workspaceId);
    res.json({ success: true, data: { projects } });
  }),
);

// GET /api/workspaces/:workspaceId/projects/:projectId
projectRouter.get(
  '/:projectId',
  authorize(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    const project = await projectService.getById(req.params.workspaceId, req.params.projectId);
    res.json({ success: true, data: { project } });
  }),
);

// PATCH /api/workspaces/:workspaceId/projects/:projectId
projectRouter.patch(
  '/:projectId',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  validate({ body: updateProjectSchema }),
  asyncHandler(async (req, res) => {
    const project = await projectService.update(req.params.workspaceId, req.params.projectId, req.body);
    res.json({ success: true, data: { project } });
  }),
);

// DELETE /api/workspaces/:workspaceId/projects/:projectId
projectRouter.delete(
  '/:projectId',
  authorize(WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    await projectService.delete(req.params.workspaceId, req.params.projectId);
    res.status(204).send();
  }),
);
