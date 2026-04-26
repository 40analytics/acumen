import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { apiClient, ApiError } from '@/lib/api';
import { Pencil, X, Check, Copy, CheckCheck } from 'lucide-react';

interface TenantOverview {
  tenant: { id: string; slug: string; name: string };
  membership: { role: 'owner' | 'admin' | 'member' };
}

export default function SettingsGeneral() {
  const { tenantSlug } = useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [copied, setCopied] = useState(false);

  function handleCopyUrl() {
    const slug = data?.tenant.slug;
    if (!slug) return;
    navigator.clipboard.writeText(`acumen.app/${slug}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: () => apiClient.get<TenantOverview>(`/api/t/${tenantSlug}`),
    enabled: !!tenantSlug,
  });

  const isOwner = data?.membership.role === 'owner';

  const rename = useMutation({
    mutationFn: (name: string) =>
      apiClient.patch(`/api/t/${tenantSlug}/settings`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantSlug] });
      toast.success('Workspace name updated');
      setEditing(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update name');
    },
  });

  function startEdit() {
    setNameInput(data?.tenant.name ?? '');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setNameInput('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === data?.tenant.name) {
      cancelEdit();
      return;
    }
    rename.mutate(trimmed);
  }

  return (
    <SettingsLayout>
      <div className="space-y-8 max-w-[600px]">
        <div>
          <h2 className="text-[22px] font-bold tracking-tighter mb-1">General</h2>
          <p className="text-[14px] text-ink-soft">
            Workspace name and identity. Visible to your whole team.
          </p>
        </div>

        <div className="card p-6 space-y-5">
          {/* Workspace name */}
          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Workspace name</div>
            {editing ? (
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1"
                  required
                  maxLength={80}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={rename.isPending}
                  className="flex items-center gap-1.5"
                >
                  <Check size={13} strokeWidth={2.5} />
                  {rename.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  disabled={rename.isPending}
                >
                  <X size={14} />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 group">
                <div className="flex-1 px-4 py-3 rounded border border-border bg-surface-alt text-[14.5px] text-ink">
                  {data?.tenant.name ?? '—'}
                </div>
                {isOwner && (
                  <button
                    onClick={startEdit}
                    className="p-2 rounded text-muted hover:text-ink hover:bg-surface-alt transition-colors"
                    title="Rename workspace"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Workspace URL (read-only + copy) */}
          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Workspace URL</div>
            <div className="flex items-center rounded border border-border bg-surface-alt">
              <span className="pl-4 pr-1 text-[14px] text-faint select-none">acumen.app/</span>
              <span className="flex-1 px-1 py-3 text-[14.5px] text-ink">
                {data?.tenant.slug ?? '—'}
              </span>
              <button
                onClick={handleCopyUrl}
                disabled={!data?.tenant.slug}
                title={copied ? 'Copied!' : 'Copy workspace URL'}
                className="mr-2 p-2 rounded text-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-40"
              >
                {copied ? (
                  <CheckCheck size={14} className="text-sage" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <p className="text-[12px] text-muted mt-1.5">
              Cannot be changed once created.{' '}
              {copied && <span className="text-sage font-medium">Link copied to clipboard!</span>}
            </p>
          </div>

          {/* Role */}
          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Your role</div>
            <div className="px-4 py-3 rounded border border-border bg-surface-alt text-[14.5px] text-ink capitalize">
              {data?.membership.role ?? '—'}
            </div>
          </div>
        </div>

        {!isOwner && (
          <div className="rounded border border-border-soft bg-surface-alt px-5 py-4 text-[13.5px] text-ink-soft">
            Only workspace owners can rename the workspace. Contact your owner or email{' '}
            <a href="mailto:hello@acumen.app" className="text-ink underline underline-offset-2">
              hello@acumen.app
            </a>{' '}
            if you need help.
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
