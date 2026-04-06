'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api-client';
import type { CreateProjectInput, UpdateProjectInput } from '@flowboard/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  workspaceId: string;
  statuses: TaskStatus[];
  createdAt: string;
  updatedAt: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useProjects(workspaceId: string | undefined) {
  return useQuery<Project[], ApiError>({
    queryKey: ['projects', workspaceId],
    queryFn: () =>
      api
        .get<{ projects: Project[] }>(`/workspaces/${workspaceId}/projects`)
        .then((d) => d.projects),
    enabled: !!workspaceId,
  });
}

export function useProject(workspaceId: string | undefined, projectId: string | undefined) {
  return useQuery<Project, ApiError>({
    queryKey: ['project', projectId],
    queryFn: () =>
      api
        .get<{ project: Project }>(`/workspaces/${workspaceId}/projects/${projectId}`)
        .then((d) => d.project),
    enabled: !!workspaceId && !!projectId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation<Project, ApiError, CreateProjectInput>({
    mutationFn: (input) =>
      api
        .post<{ project: Project }>(`/workspaces/${workspaceId}/projects`, input)
        .then((d) => d.project),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
  });
}

export function useUpdateProject(workspaceId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation<Project, ApiError, UpdateProjectInput, { previous?: Project }>({
    mutationFn: (input) =>
      api
        .patch<{ project: Project }>(
          `/workspaces/${workspaceId}/projects/${projectId}`,
          input,
        )
        .then((d) => d.project),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['project', projectId] });
      const previous = qc.getQueryData<Project>(['project', projectId]);
      if (previous) {
        qc.setQueryData<Project>(['project', projectId], { ...previous, ...input });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['project', projectId], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
  });
}

export function useDeleteProject(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (projectId) =>
      api.delete(`/workspaces/${workspaceId}/projects/${projectId}`),
    onSuccess: (_data, projectId) => {
      qc.removeQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
  });
}
