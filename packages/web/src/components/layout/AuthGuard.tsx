'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../hooks/useAuth';
import { Spinner } from '../ui/Spinner';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && isError) {
      router.replace('/login');
    }
  }, [isLoading, isError, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
