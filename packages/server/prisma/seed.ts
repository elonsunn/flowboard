import { PrismaClient, Priority, WorkspaceRole, ActivityAction } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Users
  const alice = await prisma.user.upsert({
    where: { email: 'alice@flowboard.dev' },
    update: {},
    create: {
      email: 'alice@flowboard.dev',
      name: 'Alice Chen',
      passwordHash: '$2b$10$placeholder_hash_alice',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@flowboard.dev' },
    update: {},
    create: {
      email: 'bob@flowboard.dev',
      name: 'Bob Kim',
      passwordHash: '$2b$10$placeholder_hash_bob',
    },
  });

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'flowboard-hq' },
    update: {},
    create: {
      name: 'FlowBoard HQ',
      slug: 'flowboard-hq',
      description: 'Main workspace for FlowBoard development',
      members: {
        create: [
          { userId: alice.id, role: WorkspaceRole.OWNER },
          { userId: bob.id, role: WorkspaceRole.MEMBER },
        ],
      },
    },
  });

  // Project
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-id' },
    update: {},
    create: {
      id: 'seed-project-id',
      workspaceId: workspace.id,
      name: 'FlowBoard App',
      description: 'Building the FlowBoard product',
      prefix: 'FB',
    },
  });

  // Statuses
  const statusDefs = [
    { name: 'Backlog', color: '#94a3b8', position: 0 },
    { name: 'Todo', color: '#60a5fa', position: 1 },
    { name: 'In Progress', color: '#f59e0b', position: 2 },
    { name: 'Done', color: '#22c55e', position: 3 },
  ];

  const statuses = await Promise.all(
    statusDefs.map((s) =>
      prisma.taskStatus.upsert({
        where: { id: `seed-status-${s.position}` },
        update: {},
        create: { id: `seed-status-${s.position}`, projectId: project.id, ...s },
      }),
    ),
  );

  const [backlog, todo, inProgress, done] = statuses;

  // Tasks
  const taskDefs = [
    { number: 1, title: 'Setup monorepo structure', statusId: done.id, priority: Priority.HIGH, position: 0 },
    { number: 2, title: 'Design database schema', statusId: done.id, priority: Priority.HIGH, position: 1 },
    { number: 3, title: 'Implement authentication', statusId: inProgress.id, priority: Priority.URGENT, position: 0 },
    { number: 4, title: 'Build task CRUD API', statusId: inProgress.id, priority: Priority.HIGH, position: 1 },
    { number: 5, title: 'Create drag-and-drop board UI', statusId: todo.id, priority: Priority.MEDIUM, position: 0 },
    { number: 6, title: 'Add real-time collaboration', statusId: todo.id, priority: Priority.MEDIUM, position: 1 },
    { number: 7, title: 'Write API documentation', statusId: backlog.id, priority: Priority.LOW, position: 0 },
    { number: 8, title: 'Performance optimizations', statusId: backlog.id, priority: Priority.NONE, position: 1 },
  ];

  const tasks = await Promise.all(
    taskDefs.map((t) =>
      prisma.task.upsert({
        where: { projectId_number: { projectId: project.id, number: t.number } },
        update: {},
        create: {
          projectId: project.id,
          creatorId: alice.id,
          assigneeId: t.number % 2 === 0 ? bob.id : alice.id,
          ...t,
        },
      }),
    ),
  );

  // Comments
  await prisma.comment.createMany({
    skipDuplicates: true,
    data: [
      { taskId: tasks[0].id, authorId: alice.id, content: 'Monorepo is looking great!' },
      { taskId: tasks[0].id, authorId: bob.id, content: 'Agreed, the pnpm workspace setup is clean.' },
      { taskId: tasks[2].id, authorId: alice.id, content: 'Going with JWT + refresh tokens.' },
    ],
  });

  // Activity
  await prisma.activity.createMany({
    skipDuplicates: true,
    data: [
      {
        taskId: tasks[0].id,
        actorId: alice.id,
        action: ActivityAction.CREATED,
        metadata: { title: tasks[0].title },
      },
      {
        taskId: tasks[0].id,
        actorId: alice.id,
        action: ActivityAction.STATUS_CHANGED,
        metadata: { from: 'Todo', to: 'Done' },
      },
    ],
  });

  console.log('Seed complete.');
  console.log(`  Users: alice (${alice.id}), bob (${bob.id})`);
  console.log(`  Workspace: ${workspace.slug} (${workspace.id})`);
  console.log(`  Project: ${project.prefix} — ${project.name}`);
  console.log(`  Tasks: ${tasks.length} created`);
}

main()
  .catch(console.error)
  .finally(() => void prisma.$disconnect());
