'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useWorkspaces, useCreateWorkspace } from '../../../hooks/useWorkspaces';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Avatar } from '../../../components/ui/Avatar';
import { Spinner } from '../../../components/ui/Spinner';
import { toast } from '../../../stores/ui.store';

// ─── Create workspace modal ───────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  description: z.string().max(500).optional(),
});

function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateWorkspace();
  const [fields, setFields] = useState({ name: '', slug: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setFields((f) => {
        // Auto-generate slug from name
        if (key === 'name') {
          const autoSlug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return { ...f, name: value, slug: f.slug === autoSlug.slice(0, -1) || f.slug === '' ? autoSlug : f.slug };
        }
        return { ...f, [key]: value };
      });
      setErrors((er) => ({ ...er, [key]: '' }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = schema.safeParse(fields);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      return;
    }
    create.mutate(result.data, {
      onSuccess: () => { toast('success', 'Workspace created'); onClose(); setFields({ name: '', slug: '', description: '' }); },
      onError: (err) => { toast('error', err.message); },
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create workspace">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Workspace name" value={fields.name} onChange={set('name')} error={errors.name} placeholder="Acme Corp" />
        <Input label="Slug" value={fields.slug} onChange={set('slug')} error={errors.slug} placeholder="acme-corp" hint="Used in URLs — lowercase letters, numbers, hyphens" />
        <div>
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={fields.description}
            onChange={set('description')}
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="What does this workspace do?"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your teams and projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New workspace
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="lg" className="text-indigo-600" /></div>}

      {!isLoading && !workspaces?.length && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
          <svg className="h-12 w-12 text-gray-300 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <p className="text-gray-500 font-medium">No workspaces yet</p>
          <p className="text-sm text-gray-400 mt-1">Create one to start collaborating</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create workspace</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces?.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspaces/${ws.id}`}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={ws.name} size="md" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{ws.name}</p>
                <p className="text-xs text-gray-400">{ws.slug}</p>
              </div>
            </div>
            {ws.description && <p className="text-sm text-gray-500 line-clamp-2">{ws.description}</p>}
          </Link>
        ))}
      </div>

      <CreateWorkspaceModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
