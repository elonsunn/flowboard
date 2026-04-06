'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api-client';
import type { CreateTaskInput, UpdateTaskInput, ReorderTaskInput } from '@flowboard/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
}

export interface TaskUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  position: number;
  dueDate: string | null;
  status: TaskStatus;
  assignee: TaskUser | null;
  creator?: TaskUser;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPage {
  items: Task[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TaskFilters {
  statusId?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
  limit?: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useTasks(projectId: string | undefined, filters: TaskFilters = {}) {
  const params = new URLSearchParams();
  if (filters.statusId) params.set('statusId', filters.statusId);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit) params.set('limit', String(filters.limit));

  const qs = params.toString();

  return useInfiniteQuery<TaskPage, ApiError>({
    queryKey: ['tasks', projectId, filters],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam}` : '';
      return api.get<TaskPage>(`/projects/${projectId}/tasks?${qs}${cursor}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!projectId,
  });
}

export function useTask(projectId: string | undefined, taskId: string | undefined) {
  return useQuery<Task, ApiError>({
    queryKey: ['task', taskId],
    queryFn: () =>
      api.get<{ task: Task }>(`/projects/${projectId}/tasks/${taskId}`).then((d) => d.task),
    enabled: !!projectId && !!taskId,
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation<Task, ApiError, CreateTaskInput>({
    mutationFn: (input) =>
      api
        .post<{ task: Task }>(`/projects/${projectId}/tasks`, input)
        .then((d) => d.task),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Update (with optimistic update) ─────────────────────────────────────────

export function useUpdateTask(projectId: string, taskId: string) {
  const qc = useQueryClient();

  return useMutation<Task, ApiError, UpdateTaskInput, { previous?: Task }>({
    mutationFn: (input) =>
      api
        .patch<{ task: Task }>(`/projects/${projectId}/tasks/${taskId}`, input)
        .then((d) => d.task),
    onMutate: async (input) => {
      // Cancel in-flight queries to avoid race conditions
      await qc.cancelQueries({ queryKey: ['task', taskId] });

      // Snapshot the previous value
      const previous = qc.getQueryData<Task>(['task', taskId]);

      // Optimistically update the detail cache
      if (previous) {
        qc.setQueryData<Task>(['task', taskId], { ...previous, ...input });
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back on error
      if (ctx?.previous) {
        qc.setQueryData(['task', taskId], ctx.previous);
      }
    },
    onSettled: () => {
      // Always re-sync from server
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (taskId) =>
      api.delete(`/projects/${projectId}/tasks/${taskId}`),
    onSuccess: (_data, taskId) => {
      qc.removeQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

export function useReorderTasks(projectId: string) {
  const qc = useQueryClient();

  return useMutation<void, ApiError, ReorderTaskInput>({
    mutationFn: (input) =>
      api.patch(`/projects/${projectId}/tasks/reorder`, input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}
