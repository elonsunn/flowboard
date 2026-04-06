'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRegister } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../stores/ui.store';

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    register.mutate(
      { name, email, password },
      {
        onSuccess: () => {
          toast('success', 'Account created!');
          router.push('/dashboard');
        },
        onError: (err) => {
          toast('error', err.message);
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <Input
            label="Name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters with a letter and a number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={register.isPending} className="mt-1 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
