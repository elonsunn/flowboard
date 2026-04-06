'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { z } from 'zod';
import { useWorkspace, useWorkspaceMembers, useInviteMember, useRemoveMember, type WorkspaceMember } from '../../../../hooks/useWorkspaces';
import { useProjects, useCreateProject } from '../../../../hooks/useProjects';
import { usePresence } from '../../../../hooks/usePresence';
import { useCurrentUser } from '../../../../hooks/useAuth';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Modal } from '../../../../components/ui/Modal';
import { Avatar } from '../../../../components/ui/Avatar';
import { Badge } from '../../../../components/ui/Badge';
import { Spinner } from '../../../../components/ui/Spinner';
import { toast } from '../../../../stores/ui.store';

// ─── Create project modal ─────────────────────────────────────────────────────

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  prefix: z.string().min(1).max(8).regex(/^[A-Z0-9]+$/, 'Uppercase letters and numbers only'),
  description: z.string().max(500).optional(),
});

function CreateProjectModal({ workspaceId, open, onClose }: { workspaceId: string; open: boolean; onClose: () => void }) {
  const create = useCreateProject(workspaceId);
  const [fields, setFields] = useState({ name: '', prefix: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = projectSchema.safeParse(fields);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ''])));
      return;
    }
    create.mutate(result.data, {
      onSuccess: () => { toast('success', 'Project created'); onClose(); setFields({ name: '', prefix: '', description: '' }); },
      onError: (err) => toast('error', err.message),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Create project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Project name" value={fields.name} onChange={(e) => { setFields((f) => ({ ...f, name: e.target.value, prefix: f.prefix || e.target.value.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') })); setErrors((er) => ({ ...er, name: '' })); }} error={errors.name} placeholder="My Project" />
        <Input label="Prefix" value={fields.prefix} onChange={(e) => { setFields((f) => ({ ...f, prefix: e.target.value.toUpperCase() })); setErrors((er) => ({ ...er, prefix: '' })); }} error={errors.prefix} placeholder="PROJ" hint="Short identifier shown on task numbers (e.g. PROJ-1)" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Invite member modal ──────────────────────────────────────────────────────

function InviteMemberModal({ workspaceId, open, onClose }: { workspaceId: string; open: boolean; onClose: () => void }) {
  const invite = useInviteMember(workspaceId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    invite.mutate({ email, role }, {
      onSuccess: () => { toast('success', `Invited ${email}`); onClose(); setEmail(''); },
      onError: (err) => toast('error', err.message),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite member">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          options={[{ value: 'ADMIN', label: 'Admin' }, { value: 'MEMBER', label: 'Member' }, { value: 'VIEWER', label: 'Viewer' }]}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={invite.isPending}>Send invite</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

const ROLE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  OWNER: 'warning', ADMIN: 'info', MEMBER: 'success', VIEWER: 'default',
};

function MemberRow({ member, workspaceId, isOnline, canManage, currentUserId }: {
  member: WorkspaceMember; workspaceId: string; isOnline: boolean; canManage: boolean; currentUserId: string;
}) {
  const remove = useRemoveMember(workspaceId);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="relative">
        <Avatar name={member.user.name} src={member.user.avatarUrl} size="sm" />
        {isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{member.user.name}</p>
        <p className="text-xs text-gray-500 truncate">{member.user.email}</p>
      </div>
      <Badge variant={ROLE_VARIANT[member.role] ?? 'default'}>{member.role}</Badge>
      {canManage && member.role !== 'OWNER' && member.user.id !== currentUserId && (
        <button
          onClick={() => remove.mutate(member.user.id, { onError: (err) => toast('error', err.message) })}
          className="ml-1 rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove member"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: projects, isLoading: projLoading } = useProjects(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);
  const { onlineUserIds } = usePresence(workspaceId);
  const { data: currentUser } = useCurrentUser();
  const [showCreateProj, setShowCreateProj] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const myRole = members?.find((m) => m.user.id === currentUser?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  if (wsLoading) return <div className="flex justify-center py-16"><Spinner size="lg" className="text-indigo-600" /></div>;
  if (!workspace) return <p className="text-gray-500">Workspace not found.</p>;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Avatar name={workspace.name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
          <p className="text-sm text-gray-400">{workspace.slug}</p>
          {workspace.description && <p className="mt-1 text-sm text-gray-600">{workspace.description}</p>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Projects</h2>
            {canManage && <Button size="sm" onClick={() => setShowCreateProj(true)}>New project</Button>}
          </div>

          {projLoading && <Spinner size="sm" className="text-gray-400" />}

          {!projLoading && !projects?.length && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10">
              <p className="text-sm text-gray-500">No projects yet</p>
              {canManage && <Button size="sm" className="mt-3" onClick={() => setShowCreateProj(true)}>Create first project</Button>}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {projects?.map((proj) => (
              <Link
                key={proj.id}
                href={`/workspaces/${workspaceId}/projects/${proj.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{proj.name}</span>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-mono font-medium text-indigo-600">{proj.prefix}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {proj.statuses.map((s) => (
                    <span key={s.id} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: s.color }}>{s.name}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Members */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Members
              {onlineUserIds.length > 0 && (
                <span className="ml-2 text-xs font-normal text-green-600">{onlineUserIds.length} online</span>
              )}
            </h2>
            {canManage && <Button size="sm" variant="secondary" onClick={() => setShowInvite(true)}>Invite</Button>}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 px-4">
            {members?.map((m) => (
              <MemberRow
                key={m.user.id}
                member={m}
                workspaceId={workspaceId}
                isOnline={onlineUserIds.includes(m.user.id)}
                canManage={canManage}
                currentUserId={currentUser?.id ?? ''}
              />
            ))}
          </div>
        </div>
      </div>

      <CreateProjectModal workspaceId={workspaceId} open={showCreateProj} onClose={() => setShowCreateProj(false)} />
      <InviteMemberModal workspaceId={workspaceId} open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}
