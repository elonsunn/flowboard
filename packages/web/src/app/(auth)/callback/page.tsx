'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken, setRefreshToken } from '../../../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '../../../components/ui/Spinner';

/**
 * OAuth callback landing page.
 *
 * The backend redirects here after a successful GitHub OAuth flow with:
 *   /auth/callback?accessToken=...&refreshToken=...
 *
 * This page:
 *   1. Extracts the tokens from the URL
 *   2. Stores them in the in-memory token store (no localStorage)
 *   3. Invalidates the current-user query so AuthGuard picks it up
 *   4. Replaces history entry (tokens removed) and navigates to /workspaces
 */
function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error || !accessToken || !refreshToken) {
      const msg = error === 'oauth_denied' ? 'oauth_denied' : 'oauth_invalid';
      router.replace(`/login?error=${msg}`);
      return;
    }

    // Store tokens in memory — never in localStorage
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);

    // Warm the cache so the app shell doesn't flash "loading"
    queryClient.invalidateQueries({ queryKey: ['currentUser'] });

    // Replace history so the token URL never lives in browser history
    router.replace('/workspaces');
  }, [searchParams, router, queryClient]);

  return (
    <div className="flex flex-col items-center gap-3 text-gray-500">
      <Spinner size="lg" className="text-indigo-600" />
      <p className="text-sm">Completing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Suspense>
        <OAuthCallbackInner />
      </Suspense>
    </div>
  );
}
