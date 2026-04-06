'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore, useNotificationSocket } from '../../hooks/useNotifications';
import { useCurrentUser } from '../../hooks/useAuth';
import { api } from '../../lib/api-client';
import type { NotificationPayload } from '@flowboard/shared';

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onNavigate,
}: {
  notification: NotificationPayload;
  onNavigate: (n: NotificationPayload) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(notification)}
      className={[
        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0',
        !notification.read ? 'bg-indigo-50/50' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        {!notification.read && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
        )}
        {notification.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 mb-0.5">{notification.title}</p>
            <p className="text-sm text-gray-800 leading-snug line-clamp-2">{notification.content}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: currentUser } = useCurrentUser();
  const { notifications, unreadCount, add, markRead, markAllRead } = useNotificationStore();

  // Subscribe to real-time notifications
  useNotificationSocket(!!currentUser);

  // Load existing notifications from server on first open
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    api
      .get<{ items: NotificationPayload[] }>('/notifications?limit=30')
      .then((res) => {
        // Only add notifications not already in store (avoid duplicates from socket)
        const existingIds = new Set(notifications.map((n) => n.id));
        for (const n of res.items) {
          if (!existingIds.has(n.id)) add(n);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, add, notifications]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleNavigate(n: NotificationPayload) {
    setOpen(false);
    if (!n.read) {
      markRead(n.id);
      api.patch(`/notifications/${n.id}/read`, {}).catch(() => {});
    }
    // Navigate to workspaces list — deeper navigation requires projectId which is not in the payload
    router.push('/workspaces');
  }

  async function handleMarkAllRead() {
    markAllRead();
    api.post('/notifications/read-all', {}).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-6">
                <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <svg className="h-8 w-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm">No notifications yet</p>
              </div>
            )}

            {!loading && notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
