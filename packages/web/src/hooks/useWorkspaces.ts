'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api-client';
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '@flowboard/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useWorkspaces() {
  return useQuery<Workspace[], ApiError>({
    queryKey: ['workspaces'],
    queryFn: () => api.get<{ workspaces: Workspace[] }>('/workspaces').then((d) => d.workspaces),
  });
}

export function useWorkspace(workspaceId: string | undefined) {
  return useQuery<Workspace, ApiError>({
    queryKey: ['workspace', workspaceId],
    queryFn: () =>
      api.get<{ workspace: Workspace }>(`/workspaces/${workspaceId}`).then((d) => d.workspace),
    enabled: !!workspaceId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateWorkspace() {
  const qc = useQueryClient();

  return useMutation<Workspace, ApiError, CreateWorkspaceInput>({
    mutationFn: (input) =>
      api.post<{ workspace: Workspace }>('/workspaces', input).then((d) => d.workspace),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation<Workspace, ApiError, UpdateWorkspaceInput, { previous?: Workspace }>({
    mutationFn: (input) =>
      api
        .patch<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, input)
        .then((d) => d.workspace),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['workspace', workspaceId] });
      const previous = qc.getQueryData<Workspace>(['workspace', workspaceId]);
      if (previous) {
        qc.setQueryData<Workspace>(['workspace', workspaceId], { ...previous, ...input });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['workspace', workspaceId], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (workspaceId) => api.delete(`/workspaces/${workspaceId}`),
    onSuccess: (_data, workspaceId) => {
      qc.removeQueries({ queryKey: ['workspace', workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
