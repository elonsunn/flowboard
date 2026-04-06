/**
 * Shared Socket.io event type contracts.
 * Import on the server for the typed io Server, and on the web for the typed Socket client.
 */

// ─── Payloads (lightweight, no Prisma imports) ───────────────────────────────

export interface TaskSummaryPayload {
  id: string;
  number: number;
  title: string;
  priority: string;
  position: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: { id: string; name: string; color: string };
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface CommentPayload {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

export interface ReorderPayload {
  tasks: Array<{ taskId: string; statusId: string; position: number }>;
}

export interface PresencePayload {
  workspaceId: string;
  onlineUserIds: string[];
}

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  content: string;
  taskId: string | null;
  read: boolean;
  createdAt: string;
}

// ─── Server → Client events ──────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** A new task was created in a project the client subscribed to */
  'task:created': (task: TaskSummaryPayload & { projectId: string }) => void;
  /** A task was updated (includes status change) */
  'task:updated': (task: TaskSummaryPayload & { projectId: string }) => void;
  /** A task was deleted */
  'task:deleted': (data: { taskId: string; projectId: string }) => void;
  /** Batch position/status update after drag-and-drop */
  'task:reordered': (data: ReorderPayload & { projectId: string }) => void;
  /** A new comment was posted on a task the client subscribed to */
  'task:comment:new': (comment: CommentPayload) => void;
  /** Current online users in a workspace changed */
  'workspace:presence': (data: PresencePayload) => void;
  /** A new notification for the authenticated user */
  'notification:new': (notification: NotificationPayload) => void;
}

// ─── Client → Server events ──────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Subscribe to all task events in a project */
  'task:subscribe': (projectId: string) => void;
  /** Subscribe to comment events for a specific task */
  'task:comment:subscribe': (taskId: string) => void;
  /** Join a workspace room and activate presence */
  'workspace:join': (workspaceId: string, callback?: (err?: string) => void) => void;
  /** Leave a workspace room */
  'workspace:leave': (workspaceId: string) => void;
  /** Periodic heartbeat to keep presence alive */
  heartbeat: (workspaceId: string) => void;
}

// ─── Inter-server events (Redis adapter broadcasts) ──────────────────────────

export interface InterServerEvents {
  ping: () => void;
}

// ─── Per-socket data stored on server ────────────────────────────────────────

export interface SocketData {
  userId: string;
  email: string;
  /** Workspace IDs this socket has joined, for cleanup on disconnect */
  joinedWorkspaces: string[];
}
