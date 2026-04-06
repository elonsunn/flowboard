'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar } from '../ui/Avatar';
import type { Task } from '../../hooks/useTasks';

// ─── Priority icons ───────────────────────────────────────────────────────────

const PRIORITY_ICON: Record<Task['priority'], React.ReactNode> = {
  URGENT: <span title="Urgent" className="text-red-500">⚡</span>,
  HIGH:   <span title="High"   className="text-orange-500">↑</span>,
  MEDIUM: <span title="Medium" className="text-yellow-500">→</span>,
  LOW:    <span title="Low"    className="text-blue-400">↓</span>,
  NONE:   null,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  prefix: string;
  onClick: (task: Task) => void;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, prefix, onClick, isDragOverlay = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group rounded-lg border bg-white p-3 shadow-sm text-left w-full',
        isDragOverlay
          ? 'shadow-xl rotate-2 border-indigo-300'
          : 'border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer',
      ].join(' ')}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onClick(task)}
    >
      {/* Task number + priority */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-gray-400">{prefix}-{task.number}</span>
        <span className="text-sm leading-none">{PRIORITY_ICON[task.priority]}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">{task.title}</p>

      {/* Footer: due date + assignee */}
      <div className="flex items-center justify-between mt-auto">
        {task.dueDate && (
          <span className={[
            'text-xs',
            new Date(task.dueDate) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400',
          ].join(' ')}>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        {!task.dueDate && <span />}
        {task.assignee && (
          <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="xs" />
        )}
      </div>
    </div>
  );
}
