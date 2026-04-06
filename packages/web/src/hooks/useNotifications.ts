'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import type { NotificationPayload } from '@flowboard/shared';
import { getSocket } from '../lib/socket';

// ─── Notification store ───────────────────────────────────────────────────────

interface NotificationStore {
  notifications: NotificationPayload[];
  unreadCount: number;
  add: (n: NotificationPayload) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  add: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + (n.read ? 0 : 1),
    })),

  markRead: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

// ─── Hook: subscribe to socket notifications ──────────────────────────────────

export function useNotificationSocket(enabled: boolean) {
  const add = useNotificationStore((s) => s.add);

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    function onNew(n: NotificationPayload) { add(n); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    s.on('notification:new', onNew);
    return () => { s.off('notification:new', onNew); };
  }, [enabled, add]);
}
