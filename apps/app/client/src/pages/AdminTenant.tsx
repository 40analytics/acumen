import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { apiClient, ApiError } from '@/lib/api';
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  Plus,
  Minus,
  Wallet,
  Users as UsersIcon,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  Crown,
  Shield,
  User as UserIcon,
} from 'lucide-react';

interface TenantDetail {
  tenant: {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
  };
  balance: { balance: number; lifetimePurchased: number; lifetimeSpent: number; revenueKobo?: number } | null;
  members: { userId: string; role: 'owner' | 'admin' | 'member'; joinedAt: string; email: string; name: string | null }[];
  recentUploads: { id: string; fileName: string; examType: string; month: string; year: number; recordCount: number; status: string; createdAt: string }[];
  recentTxns: { id: string; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }[];
  recentPurchases: { id: string; packId: string; creditsToCredit: number; amountKobo: number; currency: string; status: string; createdAt: string }[];
}

export default function AdminTenant() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenant', tenantId],
    queryFn: () => apiClient.get<TenantDetail>(`/api/admin/tenants/${tenantId}`),
    enabled: !!tenantId,
  });

  const impersonate = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post('/api/admin/impersonate', { userId }),
    onSuccess: () => {
      qc.invalidateQueries();
      // Send the now-impersonated user to the tenant dashboard
      if (data) navigate(`/${data.tenant.slug}/dashboard`);
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-border-soft bg-bg/85 backdrop-blur-md sticky top-0 z-50">
        <div className="container-page h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent-soft px-2 py-0.5 rounded">
              Super admin
            </span>
          </div>
          <button
            onClick={async () => {
              await apiClient.post('/api/admin/auth/logout', {});
              navigate('/admin/login', { replace: true });
            }}
            className="text-[13px] text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="container-page py-10">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink mb-6"
        >
          <ArrowLeft size={14} />
          All tenants
        </Link>

        {isLoading || !data ? (
          <div className="text-muted py-20 text-center">Loading…</div>
        ) : (
          <>
            <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
              <div>
                <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-2">
                  {data.tenant.name}
                </h1>
                <div className="flex items-center gap-3 text-[14px] text-muted">
                  <code>acumen.app/{data.tenant.slug}</code>
                  <span>·</span>
                  <span>created {new Date(data.tenant.createdAt).toLocaleDateString()}</span>
                  <a
                    href={`/${data.tenant.slug}/dashboard`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline text-[13px] font-medium"
                  >
                    <ExternalLink size={12} />
                    Open workspace
                  </a>
                </div>
              </div>
              <div className="flex gap-2">
                <CreditOpsDialog
                  tenantId={data.tenant.id}
                  tenantName={data.tenant.name}
                  type="grant"
                  onMutate={() =>
                    qc.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
                  }
                />
                <CreditOpsDialog
                  tenantId={data.tenant.id}
                  tenantName={data.tenant.name}
                  type="revoke"
                  onMutate={() =>
                    qc.invalidateQueries({ queryKey: ['admin-tenant', tenantId] })
                  }
                />
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
              <Stat
                icon={<Wallet size={14} />}
                label="Credit balance"
                value={data.balance?.balance ?? 0}
                accent
              />
              <Stat
                icon={<UsersIcon size={14} />}
                label="Members"
                value={data.members.length}
              />
              <Stat
                icon={<FileSpreadsheet size={14} />}
                label="Total uploads"
                value={data.recentUploads.length}
              />
              <Stat
                icon={<CreditCard size={14} />}
                label="Credits purchased"
                value={data.balance?.lifetimePurchased ?? 0}
              />
              <Stat
                icon={<TrendingUp size={14} />}
                label="Revenue"
                value={
                  data.recentPurchases
                    .filter((p) => p.status === 'success')
                    .reduce((s, p) => s + p.amountKobo, 0) / 100
                }
                prefix={data.recentPurchases[0]?.currency ?? 'GHS'}
                isAmount
              />
            </div>

            {/* Members + impersonation */}
            <Section title="Members">
              <div className="card overflow-hidden">
                <table className="w-full text-[14px]">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Joined</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.userId} className="border-b border-border-soft last:border-0">
                        <td className="px-5 py-3">
                          <div className="font-semibold">{m.name ?? m.email.split('@')[0]}</div>
                          <div className="text-[12.5px] text-muted">{m.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <RoleBadge role={m.role} />
                        </td>
                        <td className="px-5 py-3 text-muted text-[12.5px]">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Impersonate ${m.email}? Your actions will be audit-logged.`
                                )
                              ) {
                                impersonate.mutate(m.userId);
                              }
                            }}
                            disabled={impersonate.isPending}
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline"
                          >
                            <Eye size={13} />
                            Impersonate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Credit history */}
            <Section title="Credit ledger">
              <div className="card overflow-hidden">
                <table className="w-full text-[14px]">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Note</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTxns.map((t) => (
                      <tr key={t.id} className="border-b border-border-soft last:border-0">
                        <td className="px-5 py-3">
                          <TxnType type={t.type} />
                        </td>
                        <td className="px-5 py-3 text-ink-soft">{t.note ?? '—'}</td>
                        <td
                          className="px-5 py-3 text-right font-semibold"
                          style={{ color: t.amount > 0 ? '#166534' : '#9A3412' }}
                        >
                          {t.amount > 0 ? '+' : ''}
                          {t.amount}
                        </td>
                        <td className="px-5 py-3 text-right">{t.balanceAfter}</td>
                        <td className="px-5 py-3 text-right text-muted text-[12.5px]">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Recent uploads */}
            <Section title="Recent uploads">
              {data.recentUploads.length === 0 ? (
                <div className="card p-8 text-center text-muted">No uploads yet.</div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-[14px]">
                    <thead className="bg-surface-alt border-b border-border">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                        <th className="px-5 py-3">File</th>
                        <th className="px-5 py-3">Exam</th>
                        <th className="px-5 py-3">Period</th>
                        <th className="px-5 py-3 text-right">Records</th>
                        <th className="px-5 py-3 text-right">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentUploads.map((u) => (
                        <tr key={u.id} className="border-b border-border-soft last:border-0">
                          <td className="px-5 py-3 font-semibold truncate">{u.fileName}</td>
                          <td className="px-5 py-3">{u.examType}</td>
                          <td className="px-5 py-3">
                            {u.month} {u.year}
                          </td>
                          <td className="px-5 py-3 text-right">{u.recordCount}</td>
                          <td className="px-5 py-3 text-right text-muted text-[12.5px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Recent purchases */}
            <Section title="Recent purchases">
              {data.recentPurchases.length === 0 ? (
                <div className="card p-8 text-center text-muted">No purchases yet.</div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-[14px]">
                    <thead className="bg-surface-alt border-b border-border">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                        <th className="px-5 py-3">Pack</th>
                        <th className="px-5 py-3 text-right">Credits</th>
                        <th className="px-5 py-3 text-right">Amount</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPurchases.map((p) => (
                        <tr key={p.id} className="border-b border-border-soft last:border-0">
                          <td className="px-5 py-3 font-semibold capitalize">{p.packId}</td>
                          <td className="px-5 py-3 text-right">+{p.creditsToCredit}</td>
                          <td className="px-5 py-3 text-right">
                            {p.currency} {(p.amountKobo / 100).toFixed(2)}
                          </td>
                          <td className="px-5 py-3">
                            <PurchaseStatus status={p.status} />
                          </td>
                          <td className="px-5 py-3 text-right text-muted text-[12.5px]">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-[18px] font-bold tracking-tighter mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
  prefix,
  isAmount,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
  prefix?: string;
  isAmount?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
        {icon}
        {label}
      </div>
      <div
        className="text-[28px] font-bold tracking-tightest leading-none"
        style={{ color: accent ? '#9A3412' : '#0A0A0B' }}
      >
        {isAmount
          ? `${prefix ?? ''} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value.toLocaleString()}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: 'owner' | 'admin' | 'member' }) {
  const c =
    role === 'owner'
      ? { bg: '#FED7AA', fg: '#9A3412', Icon: Crown }
      : role === 'admin'
      ? { bg: '#DBEAFE', fg: '#1E40AF', Icon: Shield }
      : { bg: '#F0EFEB', fg: '#71717A', Icon: UserIcon };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-0.5 rounded capitalize"
      style={{ background: c.bg, color: c.fg }}
    >
      <c.Icon size={11} />
      {role}
    </span>
  );
}

function TxnType({ type }: { type: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    purchase: { bg: '#BBF7D0', fg: '#166534', label: 'Purchase' },
    upload: { bg: '#FED7AA', fg: '#9A3412', label: 'Upload' },
    refund: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Refund' },
    admin_grant: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Admin grant' },
    admin_revoke: { bg: '#FBCFE8', fg: '#BE185D', label: 'Admin revoke' },
  };
  const s = map[type] ?? { bg: '#F0EFEB', fg: '#71717A', label: type };
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function PurchaseStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    success: { bg: '#BBF7D0', fg: '#166534' },
    pending: { bg: '#FDE68A', fg: '#CA8A04' },
    failed: { bg: '#FBCFE8', fg: '#BE185D' },
    abandoned: { bg: '#F0EFEB', fg: '#71717A' },
    initialized: { bg: '#F0EFEB', fg: '#71717A' },
  };
  const s = map[status] ?? { bg: '#F0EFEB', fg: '#71717A' };
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded capitalize"
      style={{ background: s.bg, color: s.fg }}
    >
      {status}
    </span>
  );
}

function CreditOpsDialog({
  tenantId,
  tenantName,
  type,
  onMutate,
}: {
  tenantId: string;
  tenantName: string;
  type: 'grant' | 'revoke';
  onMutate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/admin/tenants/${tenantId}/credits/${type}`, {
        amount: parseInt(amount, 10),
        note: note || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setAmount('');
      setNote('');
      setError(null);
      onMutate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || parseInt(amount, 10) < 1) return setError('Enter a positive number');
    mutate.mutate();
  }

  const isGrant = type === 'grant';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isGrant ? 'primary' : 'secondary'} size="md">
          {isGrant ? <Plus size={14} /> : <Minus size={14} />}
          {isGrant ? 'Grant credits' : 'Revoke credits'}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={isGrant ? `Grant credits to ${tenantName}` : `Revoke credits from ${tenantName}`}
        description={
          isGrant
            ? "Add upload credits to this workspace. Logged in the audit trail."
            : "Remove upload credits from this workspace. Logged in the audit trail."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Amount (uploads)</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isGrant ? 'e.g. trial extension' : 'e.g. accidental purchase'}
            />
          </div>
          {error && (
            <div className="text-[13px] text-coral bg-coral-soft rounded px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={isGrant ? 'primary' : 'accent'} disabled={mutate.isPending}>
              {mutate.isPending ? 'Working…' : isGrant ? 'Grant' : 'Revoke'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
