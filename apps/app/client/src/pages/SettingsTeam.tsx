import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { apiClient, ApiError } from '@/lib/api';
import { Crown, Shield, User as UserIcon, Mail, MoreHorizontal, Trash2 } from 'lucide-react';

type Role = 'owner' | 'admin' | 'member';

interface Member {
  userId: string;
  role: Role;
  joinedAt: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Me {
  user: { id: string; email: string };
  tenants: Array<{ slug: string; role: Role }>;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};
const ROLE_COLOR: Record<Role, { bg: string; fg: string }> = {
  owner: { bg: '#FED7AA', fg: '#9A3412' },
  admin: { bg: '#DBEAFE', fg: '#1E40AF' },
  member: { bg: '#F0EFEB', fg: '#71717A' },
};

export default function SettingsTeam() {
  const { tenantSlug } = useParams();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<Me>('/api/me'),
  });
  const { data: members } = useQuery({
    queryKey: ['members', tenantSlug],
    queryFn: () => apiClient.get<{ members: Member[] }>(`/api/t/${tenantSlug}/members`),
    enabled: !!tenantSlug,
  });
  const { data: invites } = useQuery({
    queryKey: ['invites', tenantSlug],
    queryFn: () => apiClient.get<{ invites: Invite[] }>(`/api/t/${tenantSlug}/members/invites`),
    enabled: !!tenantSlug,
  });

  const myRole = me?.tenants.find((t) => t.slug === tenantSlug)?.role ?? 'member';
  const canInvite = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  return (
    <SettingsLayout>
      <div className="space-y-10">
        {/* Header + invite */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[22px] font-bold tracking-tighter mb-1">Team members</h2>
            <p className="text-[14px] text-ink-soft">
              {members?.members.length ?? 0} active ·{' '}
              {invites?.invites.length ?? 0} pending invitation
              {(invites?.invites.length ?? 0) === 1 ? '' : 's'}
            </p>
          </div>
          {canInvite && <InviteDialog tenantSlug={tenantSlug!} />}
        </div>

        {/* Members table */}
        <div className="card overflow-hidden">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-alt border-b border-border">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {members?.members.map((m) => (
                <tr key={m.userId} className="border-b border-border-soft last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name ?? m.email} />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink truncate">
                          {m.name ?? m.email.split('@')[0]}
                          {m.userId === me?.user.id && (
                            <span className="ml-1.5 text-[11px] text-muted font-normal">
                              (you)
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] text-muted truncate">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-5 py-3.5 text-muted text-[12.5px]">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {(isOwner || m.userId === me?.user.id) && (
                      <MemberActions
                        member={m}
                        tenantSlug={tenantSlug!}
                        canChangeRole={isOwner && m.userId !== me?.user.id}
                        isSelf={m.userId === me?.user.id}
                        onMutate={() => {
                          qc.invalidateQueries({ queryKey: ['members', tenantSlug] });
                          qc.invalidateQueries({ queryKey: ['me'] });
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pending invitations */}
        {canInvite && invites && invites.invites.length > 0 && (
          <div>
            <h2 className="text-[18px] font-bold tracking-tighter mb-4 flex items-center gap-2">
              <Mail size={16} className="text-muted" />
              Pending invitations
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-alt border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.invites.map((inv) => (
                    <tr key={inv.id} className="border-b border-border-soft last:border-0">
                      <td className="px-5 py-3.5 font-semibold">{inv.email}</td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={inv.role} />
                      </td>
                      <td className="px-5 py-3.5 text-muted text-[12.5px]">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <InviteRowActions
                          invite={inv}
                          tenantSlug={tenantSlug!}
                          onMutate={() =>
                            qc.invalidateQueries({ queryKey: ['invites', tenantSlug] })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  const palette = ['#9A3412', '#CA8A04', '#166534', '#BE185D', '#1E40AF'];
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
      style={{ background: color }}
    >
      {initial}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_COLOR[role];
  const Icon = role === 'owner' ? Crown : role === 'admin' ? Shield : UserIcon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.fg }}
    >
      <Icon size={11} />
      {ROLE_LABEL[role]}
    </span>
  );
}

function InviteDialog({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/t/${tenantSlug}/members/invites`, { email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites', tenantSlug] });
      setOpen(false);
      setEmail('');
      setRole('member');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    invite.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">+ Invite member</Button>
      </DialogTrigger>
      <DialogContent
        title="Invite a team member"
        description="They'll get an email with a link to accept and join your workspace."
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoFocus
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Role</Label>
            <div className="flex gap-2">
              {(['member', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 px-3 py-2.5 rounded text-[13.5px] font-semibold border transition-colors
                    ${role === r ? 'border-ink bg-ink text-bg' : 'border-border bg-surface text-ink hover:border-ink'}`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-muted mt-2">
              {role === 'admin'
                ? 'Admins can invite, remove, and manage all settings.'
                : 'Members can upload, view analytics, and export reports.'}
            </p>
          </div>
          {error && (
            <div className="text-[13px] text-coral bg-coral-soft rounded px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteRowActions({
  invite,
  tenantSlug,
  onMutate,
}: {
  invite: Invite;
  tenantSlug: string;
  onMutate: () => void;
}) {
  const resend = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/t/${tenantSlug}/members/invites/${invite.id}/resend`),
    onSuccess: onMutate,
  });
  const revoke = useMutation({
    mutationFn: () =>
      apiClient.delete(`/api/t/${tenantSlug}/members/invites/${invite.id}`),
    onSuccess: onMutate,
  });
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
        className="text-[12.5px] font-semibold text-ink hover:text-accent"
      >
        {resend.isPending ? 'Sending…' : 'Resend'}
      </button>
      <span className="text-faint">·</span>
      <button
        onClick={() => {
          if (confirm(`Revoke invitation to ${invite.email}?`)) revoke.mutate();
        }}
        className="text-[12.5px] font-semibold text-coral hover:underline"
      >
        Revoke
      </button>
    </div>
  );
}

function MemberActions({
  member,
  tenantSlug,
  canChangeRole,
  isSelf,
  onMutate,
}: {
  member: Member;
  tenantSlug: string;
  canChangeRole: boolean;
  isSelf: boolean;
  onMutate: () => void;
}) {
  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/api/t/${tenantSlug}/members/${member.userId}`),
    onSuccess: onMutate,
  });
  const changeRole = useMutation({
    mutationFn: (role: Role) =>
      apiClient.patch(`/api/t/${tenantSlug}/members/${member.userId}`, { role }),
    onSuccess: onMutate,
  });

  if (isSelf) {
    if (member.role === 'owner') return null;
    return (
      <button
        onClick={() => {
          if (confirm('Leave this workspace?')) remove.mutate();
        }}
        className="text-[12.5px] font-semibold text-coral hover:underline"
      >
        Leave
      </button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {canChangeRole && member.role !== 'owner' && (
        <select
          value={member.role}
          onChange={(e) => changeRole.mutate(e.target.value as Role)}
          className="text-[12px] font-semibold border border-border rounded px-2 py-1 bg-surface cursor-pointer"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      )}
      <button
        onClick={() => {
          if (confirm(`Remove ${member.name ?? member.email} from the workspace?`)) {
            remove.mutate();
          }
        }}
        className="text-muted hover:text-coral p-1.5 rounded"
        title="Remove"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
