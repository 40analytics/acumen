import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { apiClient } from '@/lib/api';
import { CREDIT_PACKS } from '@acumen/shared';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  CreditCard,
  TrendingUp,
  Coins,
  Search,
  Shield,
  User as UserIcon,
  Crown,
  ExternalLink,
  ClipboardList,
  Tag,
} from 'lucide-react';

type Tab = 'overview' | 'users' | 'pricing' | 'audit';

interface AdminStats {
  total_tenants: number;
  total_users: number;
  total_uploads: number;
  total_credits_in_circulation: number;
  total_credits_spent: number;
  total_revenue_kobo: number;
}

interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  memberCount: number;
  uploadCount: number;
  creditBalance: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  tenantCount: number;
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  targetTenantId: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const CURRENCY = 'GHS';

function formatRevenue(kobo: number) {
  return `${CURRENCY} ${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [tenantSearch, setTenantSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<{ stats: AdminStats }>('/api/admin/stats'),
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiClient.get<{ tenants: AdminTenant[] }>('/api/admin/tenants'),
    enabled: tab === 'overview',
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: () =>
      apiClient.get<{ users: AdminUser[] }>(
        `/api/admin/users${userSearch ? `?q=${encodeURIComponent(userSearch)}` : ''}`
      ),
    enabled: tab === 'users',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiClient.get<{ entries: AuditEntry[] }>('/api/admin/audit-log'),
    enabled: tab === 'audit',
  });

  const stats = statsData?.stats;

  const filteredTenants = (tenantsData?.tenants ?? []).filter((t) =>
    tenantSearch
      ? t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
        t.slug.toLowerCase().includes(tenantSearch.toLowerCase())
      : true
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
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

      {/* Tabs */}
      <div className="border-b border-border-soft bg-bg sticky top-[60px] z-40">
        <div className="container-page">
          <div className="flex gap-0.5">
            {([
              ['overview', 'Overview', <LayoutDashboard size={14} />],
              ['users', 'Users', <Users size={14} />],
              ['pricing', 'Pricing', <Tag size={14} />],
              ['audit', 'Audit log', <ClipboardList size={14} />],
            ] as const).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[13.5px] font-medium border-b-2 transition-colors ${
                  tab === id
                    ? 'border-ink text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container-page py-10 flex-1">

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
              <StatCard
                icon={<LayoutDashboard size={15} />}
                label="Workspaces"
                value={stats?.total_tenants ?? 0}
              />
              <StatCard
                icon={<Users size={15} />}
                label="Users"
                value={stats?.total_users ?? 0}
              />
              <StatCard
                icon={<FileSpreadsheet size={15} />}
                label="Uploads"
                value={stats?.total_uploads ?? 0}
              />
              <StatCard
                icon={<TrendingUp size={15} />}
                label="Revenue"
                value={formatRevenue(stats?.total_revenue_kobo ?? 0)}
                accent
              />
              <StatCard
                icon={<Coins size={15} />}
                label="Credits active"
                value={stats?.total_credits_in_circulation ?? 0}
              />
              <StatCard
                icon={<CreditCard size={15} />}
                label="Credits spent"
                value={stats?.total_credits_spent ?? 0}
              />
            </div>

            {/* Tenant list */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-[18px] font-bold tracking-tighter">Workspaces</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  placeholder="Search by name or slug…"
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-[13.5px] border border-border rounded bg-surface focus:outline-none focus:border-ink w-64"
                />
              </div>
            </div>

            <div className="card overflow-hidden">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-alt border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <Th>Workspace</Th>
                    <Th>Slug</Th>
                    <Th right>Members</Th>
                    <Th right>Uploads</Th>
                    <Th right>Credits</Th>
                    <Th>Created</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => (
                    <tr key={t.id} className="border-b border-border-soft last:border-0 hover:bg-surface-alt/40 transition-colors">
                      <Td><span className="font-semibold">{t.name}</span></Td>
                      <Td><code className="text-[12.5px] text-muted">{t.slug}</code></Td>
                      <Td right>{t.memberCount}</Td>
                      <Td right>{t.uploadCount}</Td>
                      <Td right>
                        <span className={`font-semibold ${t.creditBalance === 0 ? 'text-coral' : 'text-accent'}`}>
                          {t.creditBalance}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-muted">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/tenants/${t.id}`}
                            className="text-[13px] text-ink hover:text-accent font-semibold"
                          >
                            Manage →
                          </Link>
                          <a
                            href={`/${t.slug}/dashboard`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] text-muted hover:text-ink"
                            title="Open workspace"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-muted">
                        {tenantSearch ? 'No workspaces match your search.' : 'No workspaces yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <>
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-[22px] font-bold tracking-tighter">All users</h2>
                <p className="text-[14px] text-ink-soft mt-0.5">Every account registered in the platform.</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-[13.5px] border border-border rounded bg-surface focus:outline-none focus:border-ink w-72"
                />
              </div>
            </div>

            <div className="card overflow-hidden">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-alt border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th right>Workspaces</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody>
                  {(usersData?.users ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border-soft last:border-0">
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-ink text-bg text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                            {(u.name ?? u.email).charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-semibold">{u.name ?? <span className="text-muted italic">No name</span>}</div>
                            <div className="text-[12.5px] text-muted">{u.email}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {u.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-accent-soft text-accent">
                            <Shield size={10} /> Super admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-alt text-muted">
                            <UserIcon size={10} /> User
                          </span>
                        )}
                      </Td>
                      <Td right>
                        <span className={u.tenantCount === 0 ? 'text-coral' : ''}>
                          {u.tenantCount}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-muted">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {usersData && usersData.users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-muted">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── PRICING TAB ── */}
        {tab === 'pricing' && (
          <>
            <div className="mb-8">
              <h2 className="text-[22px] font-bold tracking-tighter">Credit pack pricing</h2>
              <p className="text-[14px] text-ink-soft mt-1">
                Prices are converted from USD using the <code className="bg-surface-alt px-1 rounded text-[13px]">PAYSTACK_USD_RATE</code> environment variable.
                To change pricing, update the packs in <code className="bg-surface-alt px-1 rounded text-[13px]">apps/app/shared/src/constants.ts</code> and redeploy.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {CREDIT_PACKS.map((pack) => (
                <div key={pack.id} className={`card p-6 relative ${pack.popular ? 'ring-2 ring-ink' : ''}`}>
                  {pack.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wider bg-ink text-bg px-3 py-0.5 rounded-full">
                      Most popular
                    </span>
                  )}
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">{pack.id}</div>
                  <div className="text-[20px] font-bold tracking-tighter mb-0.5">{pack.name}</div>
                  <div className="text-[28px] font-bold text-accent tracking-tightest leading-none mb-1">
                    ${pack.priceUsd}
                    <span className="text-[14px] font-medium text-muted ml-1">USD</span>
                  </div>
                  <div className="text-[13px] text-ink-soft mb-4">
                    ${pack.perUploadUsd.toFixed(2)} / upload
                  </div>
                  <div className="flex items-center justify-between border-t border-border-soft pt-4">
                    <span className="text-[13px] text-muted">Uploads included</span>
                    <span className="text-[16px] font-bold">{pack.uploads}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-6 max-w-lg">
              <h3 className="text-[15px] font-semibold mb-2">Current rate config</h3>
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-muted">Currency</span>
                  <code className="font-semibold">GHS</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">USD → GHS rate</span>
                  <code className="font-semibold">Set via PAYSTACK_USD_RATE env var</code>
                </div>
              </div>
              <p className="text-[12.5px] text-muted mt-4">
                To adjust the exchange rate or add new packs, update the Cloud Run service environment variables or the shared constants file and trigger a new deploy.
              </p>
            </div>
          </>
        )}

        {/* ── AUDIT LOG TAB ── */}
        {tab === 'audit' && (
          <>
            <div className="mb-6">
              <h2 className="text-[22px] font-bold tracking-tighter">Audit log</h2>
              <p className="text-[14px] text-ink-soft mt-0.5">All super-admin actions: impersonations, credit grants/revokes.</p>
            </div>

            <div className="card overflow-hidden">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-alt border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <Th>Action</Th>
                    <Th>Actor</Th>
                    <Th>Details</Th>
                    <Th>IP</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {(auditData?.entries ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-border-soft last:border-0">
                      <Td>
                        <ActionBadge action={e.action} />
                      </Td>
                      <Td>
                        <div className="font-semibold text-[13px]">{e.actorName ?? e.actorEmail?.split('@')[0]}</div>
                        <div className="text-[12px] text-muted">{e.actorEmail}</div>
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-ink-soft font-mono">
                          {e.metadata ? JSON.stringify(e.metadata).slice(0, 80) : '—'}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[12px] text-muted font-mono">{e.ipAddress ?? '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-muted whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  {auditData && auditData.entries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-muted">
                        No audit events yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-[24px] font-bold tracking-tightest leading-none ${accent ? 'text-accent' : ''}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    'impersonation.started': { bg: '#FDE68A', fg: '#92400E' },
    'impersonation.stopped': { bg: '#D1FAE5', fg: '#065F46' },
    'credits.grant': { bg: '#DBEAFE', fg: '#1E40AF' },
    'credits.revoke': { bg: '#FBCFE8', fg: '#BE185D' },
  };
  const style = map[action] ?? { bg: '#F0EFEB', fg: '#71717A' };
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: style.bg, color: style.fg }}
    >
      {action}
    </span>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-5 py-3 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>;
}

function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td className={`px-5 py-3 ${right ? 'text-right' : ''}`}>{children}</td>;
}
