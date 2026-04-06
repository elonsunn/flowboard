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

/**
 * @openapi
 * /workspaces:
 *   post:
 *     tags: [Workspaces]
 *     summary: Create a workspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name: { type: string, example: Acme Corp }
 *               slug: { type: string, example: acme-corp }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Workspace created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace: { $ref: '#/components/schemas/Workspace' }
 *   get:
 *     tags: [Workspaces]
 *     summary: List workspaces for current user
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspaces:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Workspace' }
 */
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

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace by ID
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Workspace details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace: { $ref: '#/components/schemas/Workspace' }
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *   patch:
 *     tags: [Workspaces]
 *     summary: Update workspace (ADMIN or OWNER)
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
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated workspace
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace: { $ref: '#/components/schemas/Workspace' }
 *   delete:
 *     tags: [Workspaces]
 *     summary: Delete workspace (OWNER only)
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 */
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
