'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useLogin } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../stores/ui.store';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: 'GitHub sign-in was cancelled.',
  oauth_invalid: 'OAuth sign-in failed. Please try again.',
};

const GITHUB_AUTH_URL =
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4007'}/api/auth/github`;

// ─── Inner component (reads searchParams — must be under Suspense) ─────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [fields, setFields] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});

  const oauthError = searchParams.get('error') ? OAUTH_ERRORS[searchParams.get('error')!] : null;

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((f) => ({ ...f, [key]: e.target.value }));
      setErrors((er) => ({ ...er, [key]: undefined }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = schema.safeParse(fields);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    login.mutate(result.data, {
      onSuccess: () => { toast('success', 'Welcome back!'); router.push('/workspaces'); },
      onError: (err) => { toast('error', err.message); },
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 overflow-hidden">
          <svg className="h-4 w-4 text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Sign in to FlowBoard</h1>
      </div>

      {/* OAuth error banner */}
      {oauthError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {oauthError}
        </div>
      )}

      {/* GitHub OAuth */}
      <a
        href={GITHUB_AUTH_URL}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors mb-4"
      >
        <svg className="h-4 w-4 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.372 0 0 5.372 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.52 11.52 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.628-5.372-12-12-12z" />
        </svg>
        Continue with GitHub
      </a>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-gray-50 px-2 text-gray-400">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <Input label="Email" type="email" autoComplete="email" value={fields.email} onChange={set('email')} error={errors.email} />
        <Input label="Password" type="password" autoComplete="current-password" value={fields.password} onChange={set('password')} error={errors.password} />
        <Button type="submit" loading={login.isPending} className="mt-1 w-full">Sign in</Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">Sign up</Link>
      </p>
    </div>
  );
}

// ─── Page shell — wraps inner component in Suspense (required for useSearchParams) ─

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
