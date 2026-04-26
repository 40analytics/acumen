import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/AppShell';

interface TenantOverview {
  tenant: { id: string; slug: string; name: string };
  membership: { role: string };
  credits: { balance: number; lifetimePurchased: number; lifetimeSpent: number };
}

export default function Dashboard() {
  const { tenantSlug } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: () => apiClient.get<TenantOverview>(`/api/t/${tenantSlug}`),
    enabled: !!tenantSlug,
  });

  return (
    <AppShell>
      <div className="container-page py-10">
        <div className="mb-10">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            — Dashboard
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
            {isLoading ? 'Loading…' : data?.tenant.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <StatCard
            label="Upload credits"
            value={data?.credits.balance ?? 0}
            sub="Available"
            accent
          />
          <StatCard
            label="Lifetime purchased"
            value={data?.credits.lifetimePurchased ?? 0}
            sub="Total credits bought"
          />
          <StatCard
            label="Lifetime spent"
            value={data?.credits.lifetimeSpent ?? 0}
            sub="Files processed"
          />
        </div>

        <div className="card p-10 text-center">
          <h3 className="text-[18px] font-semibold mb-2">Upload your first results file</h3>
          <p className="text-[14.5px] text-ink-soft max-w-[420px] mx-auto mb-6">
            Drag and drop a Cambridge IGCSE or A Level Excel file to get instant analytics.
          </p>
          <button className="btn-primary">Upload results →</button>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
        {label}
      </div>
      <div
        className="text-[36px] font-bold tracking-tightest leading-none"
        style={{ color: accent ? '#9A3412' : '#0A0A0B' }}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[12.5px] text-muted mt-1.5">{sub}</div>
    </div>
  );
}
