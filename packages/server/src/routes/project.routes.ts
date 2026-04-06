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
