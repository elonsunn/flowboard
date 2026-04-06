'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api-client';
import type { CreateCommentInput } from '@flowboard/shared';

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

export function useComments(taskId: string | undefined) {
  return useQuery<Comment[], ApiError>({
    queryKey: ['comments', taskId],
    queryFn: () =>
      api.get<{ comments: Comment[] }>(`/tasks/${taskId}/comments`).then((d) => d.comments),
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation<Comment, ApiError, CreateCommentInput>({
    mutationFn: (input) =>
      api.post<{ comment: Comment }>(`/tasks/${taskId}/comments`, input).then((d) => d.comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (commentId) => api.delete(`/comments/${commentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
    },
  });
}
