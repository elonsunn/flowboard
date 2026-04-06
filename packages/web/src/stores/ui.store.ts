'use client';

import { create } from 'zustand';

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Navigation context
  activeWorkspaceId: string | null;
  activeProjectId: string | null;
  setActiveWorkspace: (id: string | null) => void;
  setActiveProject: (id: string | null) => void;

  // Toast queue
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // ── Navigation ─────────────────────────────────────────────────────────────
  activeWorkspaceId: null,
  activeProjectId: null,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id, activeProjectId: null }),
  setActiveProject: (id) => set({ activeProjectId: id }),

  // ── Toasts ─────────────────────────────────────────────────────────────────
  toasts: [],
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: String(++toastCounter) }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helper — call outside of React components
export function toast(variant: ToastVariant, title: string, description?: string): void {
  useUIStore.getState().addToast({ variant, title, description });
}
