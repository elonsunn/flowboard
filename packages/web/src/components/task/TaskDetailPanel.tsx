'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUpdateTask } from '../../hooks/useTasks';
import { useComments, useCreateComment, useDeleteComment } from '../../hooks/useComments';
import { useCurrentUser } from '../../hooks/useAuth';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { toast } from '../../stores/ui.store';
import type { Task, TaskStatus } from '../../hooks/useTasks';

// ─── Priority options ─────────────────────────────────────────────────────────

const PRIORITIES: Task['priority'][] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

// ─── Inline editable title ────────────────────────────────────────────────────

function InlineTitle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft !== value) onChange(draft.trim());
    else setDraft(value);
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
        className="w-full resize-none rounded border border-indigo-300 px-2 py-1 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={2}
      />
    );
  }

  return (
    <h2
      className="text-lg font-bold text-gray-900 cursor-text hover:text-indigo-700 transition-colors"
      onClick={() => setEditing(true)}
    >
      {value}
    </h2>
  );
}

// ─── Description ──────────────────────────────────────────────────────────────

function DescriptionEditor({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(e.target.value || null);
    }, 300);
  }

  return (
    <textarea
      value={draft}
      onChange={handleChange}
      rows={4}
      placeholder="Add a description…"
      className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
    />
  );
}

// ─── Comments ─────────────────────────────────────────────────────────────────

function CommentsSection({ taskId }: { taskId: string }) {
  const { data: comments, isLoading } = useComments(taskId);
  const create = useCreateComment(taskId);
  const remove = useDeleteComment(taskId);
  const { data: me } = useCurrentUser();
  const [draft, setDraft] = useState('');

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    create.mutate({ content: draft }, {
      onSuccess: () => setDraft(''),
      onError: (err) => toast('error', err.message),
    });
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Comments</h3>

      {isLoading && <Spinner size="sm" className="text-gray-400" />}

      <div className="flex flex-col gap-3 mb-4">
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.author.name} src={c.author.avatarUrl} size="xs" className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-gray-700">{c.author.name}</span>
                <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                {me?.id === c.author.id && (
                  <button onClick={() => remove.mutate(c.id)} className="ml-auto text-xs text-gray-400 hover:text-red-500">×</button>
                )}
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submitComment} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <Button type="submit" size="sm" loading={create.isPending} disabled={!draft.trim()}>Post</Button>
      </form>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  task: Task | null;
  projectId: string;
  prefix: string;
  statuses: TaskStatus[];
  onClose: () => void;
}

export function TaskDetailPanel({ task, projectId, prefix, statuses, onClose }: TaskDetailPanelProps) {
  const update = useUpdateTask(projectId, task?.id ?? '');

  const save = useCallback((patch: Parameters<typeof update.mutate>[0]) => {
    if (!task) return;
    update.mutate(patch, { onError: (err) => toast('error', err.message) });
  }, [task, update]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity lg:hidden ${task ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <aside
        className={[
          'fixed right-0 top-0 z-40 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col',
          'transform transition-transform duration-300',
          task ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {!task ? null : (
          <>
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 flex-shrink-0">
              <span className="text-xs font-mono text-gray-400">{prefix}-{task.number}</span>
              <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
              {/* Title */}
              <InlineTitle value={task.title} onChange={(title) => save({ title })} />

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={task.status.id}
                    onChange={(e) => save({ statusId: e.target.value })}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select
                    value={task.priority}
                    onChange={(e) => save({ priority: e.target.value as Task['priority'] })}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Due date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
                  <input
                    type="date"
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                    onChange={(e) => save({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                {/* Assignee (display-only, editable via future user search) */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assignee</label>
                  {task.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="xs" />
                      <span className="text-sm text-gray-700 truncate">{task.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <DescriptionEditor value={task.description} onChange={(description) => save({ description })} />
              </div>

              {/* Comments */}
              <CommentsSection taskId={task.id} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}
