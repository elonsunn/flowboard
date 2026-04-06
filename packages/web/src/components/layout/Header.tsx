'use client';

import { useState } from 'react';
import { useUIStore } from '../../stores/ui.store';
import { useCurrentUser, useLogout } from '../../hooks/useAuth';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationBell() {
  return (
    <button
      className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      aria-label="Notifications"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </button>
  );
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen] = useState(false);
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();

  if (isLoading) return <Spinner size="sm" className="text-gray-400" />;
  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
          {user.name}
        </span>
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                logout.mutate();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search placeholder */}
      <button className="flex items-center gap-2 flex-1 max-w-xs rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors bg-gray-50">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search…
        <kbd className="ml-auto text-xs text-gray-300 hidden sm:block">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
