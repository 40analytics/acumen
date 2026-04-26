import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { signOut } from '@/lib/auth-client';
import { apiClient } from '@/lib/api';

interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  memberCount: number;
  uploadCount: number;
  creditBalance: number;
}

interface AdminStats {
  total_tenants: number;
  total_uploads: number;
  total_credits_in_circulation: number;
  total_credits_spent: number;
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<{ stats: AdminStats }>('/api/admin/stats'),
  });
  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => apiClient.get<{ tenants: AdminTenant[] }>('/api/admin/tenants'),
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
              await signOut();
              navigate('/signin');
            }}
            className="text-[13px] text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="container-page py-10">
        <h1 className="text-[32px] font-bold tracking-tightest mb-8">All tenants</h1>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <StatCard label="Tenants" value={stats.stats.total_tenants} />
            <StatCard label="Uploads" value={stats.stats.total_uploads} />
            <StatCard
              label="Credits in circulation"
              value={stats.stats.total_credits_in_circulation}
            />
            <StatCard label="Credits spent" value={stats.stats.total_credits_spent} />
          </div>
        )}

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
              {tenants?.tenants.map((t) => (
                <tr key={t.id} className="border-b border-border-soft last:border-0">
                  <Td>
                    <span className="font-semibold">{t.name}</span>
                  </Td>
                  <Td>
                    <code className="text-[12.5px] text-muted">{t.slug}</code>
                  </Td>
                  <Td right>{t.memberCount}</Td>
                  <Td right>{t.uploadCount}</Td>
                  <Td right>
                    <span className="font-semibold text-accent">{t.creditBalance}</span>
                  </Td>
                  <Td>
                    <span className="text-[12.5px] text-muted">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      to={`/admin/tenants/${t.id}`}
                      className="text-[13px] text-ink hover:text-accent font-semibold"
                    >
                      Open →
                    </Link>
                  </Td>
                </tr>
              ))}
              {tenants?.tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted">
                    No tenants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
        {label}
      </div>
      <div className="text-[28px] font-bold tracking-tightest">{value.toLocaleString()}</div>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-5 py-3 ${right ? 'text-right' : ''}`}>{children}</th>;
}

function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td className={`px-5 py-3 ${right ? 'text-right' : ''}`}>{children}</td>;
}
