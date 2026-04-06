import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { createTestUser, createTestWorkspace, createTestProject, prisma, uid, type TestUser } from './setup.js';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

let owner: TestUser;
let outsider: TestUser;
let workspaceId: string;
let projectId: string;
let statusTodo: string;
let statusDone: string;
const createdTaskIds: string[] = [];

beforeAll(async () => {
  owner = await createTestUser();
  outsider = await createTestUser();

  const ws = await createTestWorkspace(owner.id);
  workspaceId = ws.id;

  const project = await createTestProject(workspaceId);
  projectId = project.id;
  statusTodo = project.statuses[0].id;
  statusDone = project.statuses[2].id;
});

afterAll(async () => {
  // Tasks cascade-delete with project; delete workspace which cascades everything
  await prisma.task.deleteMany({ where: { projectId } });
  await prisma.taskStatus.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, outsider.id] } } });
});

// ─── POST /api/projects/:projectId/tasks ──────────────────────────────────────

describe('POST /api/projects/:projectId/tasks', () => {
  it('creates a task and auto-assigns number starting at 1', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: `Task ${uid()}`, statusId: statusTodo });

    expect(res.status).toBe(201);
    expect(res.body.data.task.number).toBe(1);
    expect(res.body.data.task.status.id).toBe(statusTodo);
    createdTaskIds.push(res.body.data.task.id);
  });

  it('auto-increments task number for subsequent tasks', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: `Task ${uid()}`, statusId: statusTodo, priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.data.task.number).toBe(2);
    expect(res.body.data.task.priority).toBe('HIGH');
    createdTaskIds.push(res.body.data.task.id);
  });

  it('returns 403 for a non-member', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ title: 'Intruder task', statusId: statusTodo });

    expect(res.status).toBe(403);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Anonymous task', statusId: statusTodo });

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'No status' }); // statusId missing

    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/projects/:projectId/tasks/:taskId ────────────────────────────

describe('PATCH /api/projects/:projectId/tasks/:taskId', () => {
  let taskId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Patch test task', statusId: statusTodo });
    taskId = res.body.data.task.id;
    createdTaskIds.push(taskId);
  });

  it('updates the task title', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Updated title');
  });

  it('changes task status and writes an activity record', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ statusId: statusDone });

    expect(res.status).toBe(200);
    expect(res.body.data.task.status.id).toBe(statusDone);

    // Verify the STATUS_CHANGED activity was recorded
    const activity = await prisma.activity.findFirst({
      where: { taskId, action: 'STATUS_CHANGED' },
    });
    expect(activity).not.toBeNull();
    expect((activity!.metadata as { from: string }).from).toBe(statusTodo);
    expect((activity!.metadata as { to: string }).to).toBe(statusDone);
  });

  it('returns 403 for a non-member', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/projects/:projectId/tasks ──────────────────────────────────────

describe('GET /api/projects/:projectId/tasks', () => {
  it('returns a paginated list with hasMore=false when all fit', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.hasMore).toBe('boolean');
    expect('nextCursor' in res.body.data).toBe(true);
  });

  it('paginates with limit param', async () => {
    // Create extra tasks to ensure we have more than 1
    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Pagination task A', statusId: statusTodo });

    await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Pagination task B', statusId: statusTodo });

    const page1 = await request(app)
      .get(`/api/projects/${projectId}/tasks?limit=2`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data.items.length).toBeLessThanOrEqual(2);

    if (page1.body.data.hasMore) {
      const cursor = page1.body.data.nextCursor;
      const page2 = await request(app)
        .get(`/api/projects/${projectId}/tasks?limit=2&cursor=${cursor}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(page2.status).toBe(200);
      // Page 2 items must not overlap with page 1
      const page1Ids = new Set(page1.body.data.items.map((t: { id: string }) => t.id));
      for (const task of page2.body.data.items) {
        expect(page1Ids.has(task.id)).toBe(false);
      }
    }
  });

  it('filters by statusId', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?statusId=${statusDone}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    for (const task of res.body.data.items) {
      expect(task.status.id).toBe(statusDone);
    }
  });

  it('filters by priority', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?priority=HIGH`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    for (const task of res.body.data.items) {
      expect(task.priority).toBe('HIGH');
    }
  });

  it('returns 403 for a non-member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/projects/:projectId/tasks/:taskId ────────────────────────────

describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
  it('deletes a task and returns 204', async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Task to delete', statusId: statusTodo });

    const taskId = created.body.data.task.id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(204);

    // Confirm it's gone
    const check = await request(app)
      .get(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(check.status).toBe(404);
  });
});
