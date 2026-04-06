'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useProject } from '../../../../../../hooks/useProjects';
import { useWorkspace } from '../../../../../../hooks/useWorkspaces';
import { useReorderTasks } from '../../../../../../hooks/useTasks';
import { useProjectSubscription } from '../../../../../../hooks/useSocket';
import { usePresence } from '../../../../../../hooks/usePresence';
import { useCurrentUser } from '../../../../../../hooks/useAuth';
import { TaskCard } from '../../../../../../components/task/TaskCard';
import { TaskDetailPanel } from '../../../../../../components/task/TaskDetailPanel';
import { Button } from '../../../../../../components/ui/Button';
import { Spinner } from '../../../../../../components/ui/Spinner';
import { Modal } from '../../../../../../components/ui/Modal';
import { Input } from '../../../../../../components/ui/Input';
import { Select } from '../../../../../../components/ui/Select';
import { toast } from '../../../../../../stores/ui.store';
import { api } from '../../../../../../lib/api-client';
import type { Task, TaskStatus } from '../../../../../../hooks/useTasks';

// ─── Fetch all tasks (non-paginated) ─────────────────────────────────────────

async function fetchAllTasks(projectId: string): Promise<Task[]> {
  const result = await api.get<{ items: Task[]; hasMore: boolean; nextCursor: string | null }>(
    `/projects/${projectId}/tasks?limit=200`,
  );
  return result.items;
}

// ─── Create task modal ────────────────────────────────────────────────────────

function CreateTaskModal({
  open, onClose, projectId, statuses, defaultStatusId,
}: {
  open: boolean; onClose: () => void;
  projectId: string; statuses: TaskStatus[]; defaultStatusId: string;
}) {
  const [title, setTitle] = useState('');
  const [statusId, setStatusId] = useState(defaultStatusId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setTitle(''); setStatusId(defaultStatusId); } }, [open, defaultStatusId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, { title: title.trim(), statusId });
      onClose();
    } catch (err: unknown) {
      toast('error', (err as { message: string }).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create task">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" autoFocus />
        <Select
          label="Status"
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          options={statuses.map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={!title.trim()}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function KanbanColumn({
  status, tasks, prefix, onTaskClick, onAddTask,
}: {
  status: TaskStatus; tasks: Task[]; prefix: string;
  onTaskClick: (t: Task) => void; onAddTask: (statusId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-semibold text-gray-700">{status.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 tabular-nums">{tasks.length}</span>
        </div>
        <button
          onClick={() => onAddTask(status.id)}
          className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Add task"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={[
          'flex flex-col gap-2 flex-1 min-h-[120px] rounded-xl p-2 transition-colors',
          isOver ? 'bg-indigo-50 border-2 border-dashed border-indigo-300' : 'bg-gray-100/60',
        ].join(' ')}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} prefix={prefix} onClick={onTaskClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  projectId, prefix, statuses, initialTasks, workspaceId,
}: {
  projectId: string; prefix: string; statuses: TaskStatus[];
  initialTasks: Task[]; workspaceId: string;
}) {
  const reorder = useReorderTasks(projectId);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createStatusId, setCreateStatusId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { onlineUserIds } = usePresence(workspaceId);
  const { data: currentUser } = useCurrentUser();

  // Sync when server data changes (socket invalidations)
  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  // Subscribe to real-time task events
  useProjectSubscription(projectId);

  const columnTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of statuses) map[s.id] = [];
    for (const t of tasks) {
      if (map[t.status.id]) map[t.status.id].push(t);
    }
    for (const s of statuses) map[s.id].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks, statuses]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findTaskById(id: string) { return tasks.find((t) => t.id === id) ?? null; }
  function findStatusForTask(taskId: string) { return tasks.find((t) => t.id === taskId)?.status.id; }

  function onDragStart({ active }: DragStartEvent) {
    setActiveTask(findTaskById(String(active.id)));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeStatusId = findStatusForTask(activeId);
    // overId can be a column id or a task id
    const overStatusId = statuses.find((s) => s.id === overId)?.id ?? findStatusForTask(overId);
    if (!activeStatusId || !overStatusId || activeStatusId === overStatusId) return;

    // Move between columns optimistically
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? { ...t, status: statuses.find((s) => s.id === overStatusId)! }
          : t,
      ),
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setTasks((prev) => {
      const activeStatusId = prev.find((t) => t.id === activeId)?.status.id;
      const overStatusId = statuses.find((s) => s.id === overId)?.id ?? prev.find((t) => t.id === overId)?.status.id;
      if (!activeStatusId || !overStatusId) return prev;

      const colItems = prev.filter((t) => t.status.id === overStatusId);
      const oldIdx = colItems.findIndex((t) => t.id === activeId);
      const newIdx = statuses.find((s) => s.id === overId)
        ? colItems.length  // dropped on column header → end of column
        : colItems.findIndex((t) => t.id === overId);

      let reordered: Task[];
      if (activeStatusId === overStatusId && oldIdx !== -1 && newIdx !== -1) {
        reordered = [...prev];
        const colReordered = arrayMove(colItems, oldIdx, newIdx);
        let ci = 0;
        reordered = reordered.map((t) => (t.status.id === overStatusId ? colReordered[ci++] : t));
      } else {
        reordered = prev;
      }

      // Assign positions
      const withPositions = reordered.map((t) => {
        const col = reordered.filter((r) => r.status.id === t.status.id);
        return { ...t, position: col.indexOf(t) };
      });

      // Call API
      reorder.mutate(
        {
          tasks: withPositions.map((t) => ({ taskId: t.id, statusId: t.status.id, position: t.position })),
        },
        { onError: (err) => { toast('error', err.message); setTasks(initialTasks); } },
      );

      return withPositions;
    });
  }

  // Update selectedTask when tasks change
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks, selectedTask]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 px-1 flex-shrink-0">
        <Button size="sm" onClick={() => { setCreateStatusId(statuses[0]?.id ?? ''); setShowCreate(true); }}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New task
        </Button>
        {/* Online presence */}
        {onlineUserIds.filter((id) => id !== currentUser?.id).length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-400">Viewing:</span>
            <div className="flex -space-x-1">
              {onlineUserIds.slice(0, 5).map((id) => (
                <div key={id} className="h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-500">{id.slice(0, 1).toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 h-full min-h-0" style={{ minWidth: `${statuses.length * 304}px` }}>
            {statuses.map((s) => (
              <KanbanColumn
                key={s.id}
                status={s}
                tasks={columnTasks[s.id] ?? []}
                prefix={prefix}
                onTaskClick={setSelectedTask}
                onAddTask={(statusId) => { setCreateStatusId(statusId); setShowCreate(true); }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && (
              <TaskCard task={activeTask} prefix={prefix} onClick={() => {}} isDragOverlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        projectId={projectId}
        prefix={prefix}
        statuses={statuses}
        onClose={() => setSelectedTask(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={projectId}
        statuses={statuses}
        defaultStatusId={createStatusId}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const { data: workspace } = useWorkspace(workspaceId);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await fetchAllTasks(projectId);
      setTasks(result);
    } catch (err: unknown) {
      toast('error', (err as { message: string }).message);
    } finally {
      setLoadingTasks(false);
    }
  }, [projectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (isLoading || loadingTasks) {
    return <div className="flex justify-center py-16"><Spinner size="lg" className="text-indigo-600" /></div>;
  }
  if (!project) return <p className="text-gray-500">Project not found.</p>;

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="mb-5 flex items-center gap-3 flex-shrink-0">
        <span className="rounded bg-indigo-100 px-2.5 py-1 text-sm font-mono font-semibold text-indigo-700">{project.prefix}</span>
        <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
        {workspace && <span className="text-sm text-gray-400">in {workspace.name}</span>}
      </div>

      <KanbanBoard
        projectId={projectId}
        prefix={project.prefix}
        statuses={project.statuses}
        initialTasks={tasks ?? []}
        workspaceId={workspaceId}
      />
    </div>
  );
}
