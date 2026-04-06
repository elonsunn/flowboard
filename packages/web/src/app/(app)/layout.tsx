'use client';

import { useCurrentUser } from '../../hooks/useAuth';
import { SocketProvider } from '../../providers/socket-provider';
import { AuthGuard } from '../../components/layout/AuthGuard';
import { Sidebar } from '../../components/layout/Sidebar';
import { Header } from '../../components/layout/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();

  return (
    <AuthGuard>
      <SocketProvider isAuthenticated={!!user}>
        <div className="flex h-full">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
              {children}
            </main>
          </div>
        </div>
      </SocketProvider>
    </AuthGuard>
  );
}
