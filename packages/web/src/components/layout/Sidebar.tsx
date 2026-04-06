'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '../../stores/ui.store';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useProjects } from '../../hooks/useProjects';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
      <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      </div>
      <span className="font-semibold text-gray-900 text-sm">FlowBoard</span>
    </div>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      ].join(' ')}
    >
      {icon}
      {label}
    </Link>
  );
}

// ─── Workspace section ────────────────────────────────────────────────────────

function WorkspaceList() {
  const { activeWorkspaceId, setActiveWorkspace } = useUIStore();
  const { data: workspaces, isLoading } = useWorkspaces();
  const { data: projects } = useProjects(activeWorkspaceId ?? undefined);

  if (isLoading) return <Spinner size="sm" className="mx-4 mt-4 text-gray-400" />;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Workspaces
      </p>
      {workspaces?.map((ws) => (
        <div key={ws.id}>
          <button
            onClick={() => setActiveWorkspace(ws.id === activeWorkspaceId ? null : ws.id)}
            className={[
              'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left',
              ws.id === activeWorkspaceId
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ].join(' ')}
          >
            <Avatar name={ws.name} size="xs" />
            <span className="truncate">{ws.name}</span>
          </button>

          {ws.id === activeWorkspaceId && projects && (
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-gray-100 pl-2">
              {projects.map((proj) => (
                <Link
                  key={proj.id}
                  href={`/dashboard/${ws.id}/${proj.id}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="truncate">{proj.name}</span>
                  <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{proj.prefix}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
      <Logo />

      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        <NavItem
          href="/dashboard"
          label="Dashboard"
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        />

        <WorkspaceList />
      </nav>
    </aside>
  );
}
