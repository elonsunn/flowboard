'use client';

import type { ApiResponse } from '@flowboard/shared';

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Token store (in-memory — no localStorage to avoid XSS) ──────────────────
// Access token lives here; refresh token is sent via httpOnly cookie by the
// server when the /auth/login and /auth/register responses are processed.

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Refresh state ────────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Coalesce concurrent 401s into a single refresh request
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // refreshToken is stored in memory alongside accessToken
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
        credentials: 'include',
      });

      if (!res.ok) {
        setAccessToken(null);
        setRefreshToken(null);
        return null;
      }

      const body = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
      if (!body.success) return null;

      setAccessToken(body.data.accessToken);
      setRefreshToken(body.data.refreshToken);
      return body.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// refresh token — ideally httpOnly cookie; stored in memory here so the client
// can include it in the POST body for /auth/refresh.
let refreshToken: string | null = null;
export function setRefreshToken(token: string | null): void {
  refreshToken = token;
}
export function getRefreshToken(): string | null {
  return refreshToken;
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4007';
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, headers = {}, ...rest } = options;

  const buildHeaders = (token: string | null): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  });

  const url = `${getBaseUrl()}/api${path}`;

  let res = await fetch(url, { ...rest, headers: buildHeaders(accessToken) });

  // ── Auto-refresh on 401 ───────────────────────────────────────────────────
  if (res.status === 401 && !skipAuth && refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, { ...rest, headers: buildHeaders(newToken) });
    }
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiError(
      body.error.code,
      body.error.message,
      res.status,
      body.error.details,
    );
  }

  return body.data;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    }),

  delete: <T = void>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...options }),
};
