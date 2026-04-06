'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { login, register, logout, fetchCurrentUser, type AuthUser } from '../lib/auth';
import { ApiError } from '../lib/api-client';

// ─── Current user ─────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery<AuthUser, ApiError>({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,           // don't retry 401 — user simply isn't logged in
    staleTime: 5 * 60_000, // 5 min
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────

export function useLogin() {
  const qc = useQueryClient();

  return useMutation<AuthUser, ApiError, { email: string; password: string }>({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: (user) => {
      qc.setQueryData(['auth', 'me'], user);
    },
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────

export function useRegister() {
  const qc = useQueryClient();

  return useMutation<AuthUser, ApiError, { email: string; password: string; name: string }>({
    mutationFn: ({ email, password, name }) => register(email, password, name),
    onSuccess: (user) => {
      qc.setQueryData(['auth', 'me'], user);
    },
  });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function useLogout() {
  const qc = useQueryClient();

  return useMutation<void, ApiError>({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear(); // wipe all cached data on sign-out
    },
  });
}
