import { Router } from 'express';
import { WorkspaceRole } from '@prisma/client';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@flowboard/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { workspaceService } from '../services/workspace.service.js';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

// POST /api/workspaces
workspaceRouter.post(
  '/',
  validate({ body: createWorkspaceSchema }),
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.create(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: { workspace } });
  }),
);

// GET /api/workspaces
workspaceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const workspaces = await workspaceService.listForUser(req.user!.userId);
    res.json({ success: true, data: { workspaces } });
  }),
);

// GET /api/workspaces/:workspaceId
workspaceRouter.get(
  '/:workspaceId',
  authorize(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.getById(req.params.workspaceId);
    res.json({ success: true, data: { workspace } });
  }),
);

// PATCH /api/workspaces/:workspaceId
workspaceRouter.patch(
  '/:workspaceId',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  validate({ body: updateWorkspaceSchema }),
  asyncHandler(async (req, res) => {
    const workspace = await workspaceService.update(req.params.workspaceId, req.body);
    res.json({ success: true, data: { workspace } });
  }),
);

// DELETE /api/workspaces/:workspaceId
workspaceRouter.delete(
  '/:workspaceId',
  authorize(WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    await workspaceService.delete(req.params.workspaceId);
    res.status(204).send();
  }),
);

// ── Members ───────────────────────────────────────────────────────────────────

// POST /api/workspaces/:workspaceId/members
workspaceRouter.post(
  '/:workspaceId/members',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  validate({ body: inviteMemberSchema }),
  asyncHandler(async (req, res) => {
    const member = await workspaceService.inviteMember(req.params.workspaceId, req.body);
    res.status(201).json({ success: true, data: { member } });
  }),
);

// PATCH /api/workspaces/:workspaceId/members/:userId
workspaceRouter.patch(
  '/:workspaceId/members/:userId',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  validate({ body: updateMemberRoleSchema }),
  asyncHandler(async (req, res) => {
    const member = await workspaceService.updateMemberRole(
      req.params.workspaceId,
      req.params.userId,
      req.user!.userId,
      req.body,
    );
    res.json({ success: true, data: { member } });
  }),
);

// DELETE /api/workspaces/:workspaceId/members/:userId
workspaceRouter.delete(
  '/:workspaceId/members/:userId',
  authorize(WorkspaceRole.ADMIN, WorkspaceRole.OWNER),
  asyncHandler(async (req, res) => {
    await workspaceService.removeMember(req.params.workspaceId, req.params.userId, req.user!.userId);
    res.status(204).send();
  }),
);
