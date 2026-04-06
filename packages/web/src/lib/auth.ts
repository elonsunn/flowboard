'use client';

import { api, setAccessToken, setRefreshToken } from './api-client';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyTokens(tokens: AuthTokens): void {
  setAccessToken(tokens.accessToken);
  setRefreshToken(tokens.refreshToken);
}

// ─── Auth methods ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api.post<AuthResult>('/auth/login', { email, password }, { skipAuth: true });
  applyTokens(data);
  return data.user;
}

export async function register(email: string, password: string, name: string): Promise<AuthUser> {
  const data = await api.post<AuthResult>('/auth/register', { email, password, name }, { skipAuth: true });
  applyTokens(data);
  return data.user;
}

export async function logout(): Promise<void> {
  setAccessToken(null);
  setRefreshToken(null);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const data = await api.get<{ user: AuthUser }>('/auth/me');
  return data.user;
}
