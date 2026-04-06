# FlowBoard — Architecture

This document describes the internal design of FlowBoard: how data flows through the system, why each technology was chosen, and the trade-offs that were made.

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                      Browser                        │
│  Next.js 14 (App Router, React 18)                  │
│  TanStack Query · Zustand · Socket.io client        │
│  @dnd-kit (drag-and-drop)                           │
└────────────────────┬───────────────┬────────────────┘
                     │  REST (HTTP)  │  WebSocket
                     ▼               ▼
┌────────────────────────────────────────────────────────┐
│                   API Server (port 4007)               │
│  Express 4 + TypeScript                                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Middleware  │  │   Routers    │  │  Socket.io  │ │
│  │  auth / rate │  │  auth/tasks  │  │  rooms +    │ │
│  │  limit / val │  │  workspaces  │  │  presence   │ │
│  └──────────────┘  └──────┬───────┘  └──────┬──────┘ │
│                           │                  │        │
│                    ┌──────▼──────┐           │        │
│                    │  Services   │           │        │
│                    │  (business  │           │        │
│                    │   logic)    │           │        │
│                    └──────┬──────┘           │        │
└───────────────────────────┼──────────────────┼────────┘
              Prisma ORM    │      BullMQ       │ ioredis
         ┌─────────────────┘   ┌───────────────┘
         ▼                     ▼
┌─────────────────┐   ┌────────────────────────────────┐
│  PostgreSQL 15  │   │           Redis 7               │
│  ─────────────  │   │  ─────────────────────────────  │
│  Users          │   │  OAuth CSRF state (TTL 10m)    │
│  Workspaces     │   │  Rate limit buckets (sorted set)│
│  Projects       │   │  BullMQ job queues             │
│  Tasks          │   │  Socket.io pub/sub adapter     │
│  Comments       │   │  Presence heartbeats           │
│  Notifications  │   └────────────────────────────────┘
│  Accounts       │
└─────────────────┘

┌────────────────────────────────────────────────────────┐
│                 BullMQ Worker Process                  │
│  Runs separately from the API server                   │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐  │
│  │ Notification │ │    Webhook    │ │   Cleanup    │  │
│  │   Worker     │ │    Worker     │ │  (cron 2am)  │  │
│  │ creates DB   │ │ HMAC-signed   │ │ prunes old   │  │
│  │ records +    │ │ HTTP POST to  │ │ notifs +     │  │
│  │ Socket emit  │ │ subscriber    │ │ activities   │  │
│  └──────────────┘ └───────────────┘ └──────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Data Flow: Creating a Task

1. **Client** — user fills the "Create task" modal and submits  
2. **POST /api/projects/:id/tasks** — Express route handler validates with Zod, calls `taskService.create()`  
3. **taskService** — inserts `Task` row (auto-increments `number`), inserts `Activity` row, enqueues `notification` job in BullMQ  
4. **API response** — returns `201 Created` with the new task; TanStack Query invalidates `['tasks', projectId]`  
5. **Socket.io emit** — `realtime.emitToProject(projectId, 'task:created', task)` broadcasts to everyone in the `project:{id}` room  
6. **Other clients** — `SocketProvider` receives `task:created`, calls `queryClient.invalidateQueries(['tasks', projectId])` → kanban board re-fetches  
7. **BullMQ worker** — dequeues the notification job, creates `Notification` records for relevant users, emits `notification:new` via headless Socket.io through the Redis adapter

---

## Data Flow: Drag-and-Drop Reorder

1. **DndContext onDragOver** — optimistically moves the task to the target column in local React state (instant visual feedback, no API call)  
2. **DndContext onDragEnd** — computes new `position` values for the entire column, calls `PATCH /api/projects/:id/tasks/reorder`  
3. **taskService.reorder()** — bulk updates `statusId` + `position` in a single Prisma `$transaction`, emits `task:reordered` via Socket.io  
4. **Other clients** — receive `task:reordered`, invalidate query; the dragging client's optimistic state is already correct  
5. **On error** — `onError` callback rolls back to `initialTasks` (captured at drag start)

---

## Data Flow: GitHub OAuth

```
Browser ──→ GET /api/auth/github
              └─ generates state = crypto.randomBytes(32)
              └─ redis.set(oauth:state:{state}, '1', EX 600)
              └─ redirect → github.com/login/oauth/authorize?...

GitHub ──→ GET /api/auth/github/callback?code=...&state=...
              └─ redis.get(oauth:state:{state}) → verify CSRF
              └─ redis.del(oauth:state:{state})            // single-use
              └─ POST github.com/login/oauth/access_token  // exchange code
              └─ GET api.github.com/user                   // profile
              └─ GET api.github.com/user/emails            // primary email
              └─ prisma.$transaction:
                    find Account by (provider=github, providerAccountId)
                    if found → update token, return user
                    if not → findUnique(email) or create User
                             create Account
              └─ issueTokenPair(user.id, user.email)
              └─ redirect → {FRONTEND_URL}/auth/callback?accessToken=...

Browser /auth/callback
              └─ setAccessToken(token) in module-level memory
              └─ setRefreshToken(token) in module-level memory
              └─ queryClient.invalidateQueries(['currentUser'])
              └─ router.replace('/workspaces')
```

---

## Authentication Model

### JWT token pair

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 minutes | Module-level JS variable (no XSS risk) |
| Refresh token | 7 days | Module-level JS variable |

Both tokens are stored in JavaScript memory, not `localStorage` or `sessionStorage`. They are lost on page refresh — this is an intentional trade-off for this learning project. In production, the refresh token should be in an `httpOnly; SameSite=Strict` cookie.

The `api-client.ts` transparently handles 401 → refresh → retry, coalescing concurrent refresh requests into one.

### Role hierarchy (workspace-scoped)

```
OWNER > ADMIN > MEMBER > VIEWER
```

Roles are checked in service methods, not middleware, so business logic stays explicit.

---

## Rate Limiting

```
Redis sorted set: ratelimit:{namespace}:{identifier}
  score  = timestamp_ms
  member = randomUUID()

On each request:
  1. ZREMRANGEBYSCORE (evict entries older than windowMs)
  2. ZADD (add current request with NX flag)
  3. ZCARD (count requests in window)
  4. EXPIRE (reset TTL)
  5. if count > max → 429
```

This is a **true sliding window** — unlike fixed-window counters, there's no "double-spend" at window boundaries. Each Redis operation is O(log N) where N is the number of requests in the window.

---

## Real-time Architecture

Socket.io rooms follow a simple naming convention:

| Room | Members | Events emitted |
|---|---|---|
| `project:{projectId}` | All users subscribed to a project | `task:created`, `task:updated`, `task:deleted`, `task:reordered` |
| `task:{taskId}` | Users viewing a specific task detail | `task:comment:new` |
| `workspace:{workspaceId}` | All workspace members | `workspace:presence` |
| `user:{userId}` | Single user (all their connections) | `notification:new` |

The BullMQ worker emits to users via a **headless Socket.io server** backed by the Redis adapter. This means the worker process doesn't need an HTTP port — it only writes to Redis pub/sub, and the API server's Socket.io instance picks it up.

---

## Background Jobs

Three BullMQ workers run in a separate Node.js process (`worker-main.ts`):

### NotificationWorker

Triggered after task creation, assignment, status change, or new comment. Creates `Notification` DB records for affected users, then emits `notification:new` via Socket.io.

### WebhookWorker

Delivers signed HTTP POST payloads to subscriber URLs. Uses HMAC-SHA256 (`X-FlowBoard-Signature`), 10-second timeout with `AbortController`, and BullMQ's built-in retry with exponential backoff.

### CleanupWorker (cron)

Runs at 02:00 daily. Deletes notifications older than 30 days (already read) and activity logs older than 90 days to prevent unbounded table growth.

---

## Database Schema Highlights

```
User ─────────────┬──── Account (OAuth provider links)
                  ├──── WorkspaceMember (role per workspace)
                  ├──── Task (assignee + creator)
                  ├──── Comment
                  ├──── Activity
                  └──── Notification

Workspace ─────── WorkspaceMember
               └─ Project ─── TaskStatus
                           └─ Task ─── Comment
                                   └─ Activity
                                   └─ Notification
                                   └─ Task (sub-tasks, self-referential)
```

Key design choices:
- `Task.number` is project-scoped (like GitHub issues), implemented via `@@unique([projectId, number])` with auto-increment handled in the service layer
- `Task.position` is a float-friendly integer recomputed on every reorder (no gap strategy needed at this scale)
- `Account.@@unique([provider, providerAccountId])` allows one user to link multiple OAuth providers
- `Notification.taskId` uses `onDelete: SetNull` so notifications survive task deletion

---

## Monorepo Structure

pnpm workspaces with three packages:

| Package | Purpose |
|---|---|
| `@flowboard/server` | Express API + Socket.io server + BullMQ workers |
| `@flowboard/web` | Next.js 14 frontend |
| `@flowboard/shared` | Shared TypeScript types, Zod schemas, Socket.io event definitions |

The `shared` package is referenced as `workspace:*` — no publishing or build step needed; TypeScript resolves it directly via `main: "./src/index.ts"`.

---

## Docker Build Strategy

Both services use **three-stage** Docker builds:

```
deps     → install all dependencies (cached layer)
builder  → compile TypeScript / run Next.js build
production → copy only the compiled output + production deps
```

For the server, Prisma's `generate` step runs in the `builder` stage (needs devDeps) and again in `production` (needs the schema for runtime type resolution).

For Next.js, `output: 'standalone'` produces a self-contained directory that includes the Node.js server and all required modules — the final image doesn't need pnpm or `node_modules` from the build stage.

Image sizes (approximate):
- `flowboard/server` — ~180 MB (node:20-alpine + production deps)
- `flowboard/web` — ~130 MB (node:20-alpine + Next.js standalone)
