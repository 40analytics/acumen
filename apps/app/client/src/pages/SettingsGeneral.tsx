import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SettingsLayout } from '@/components/SettingsLayout';
import { apiClient } from '@/lib/api';

interface TenantOverview {
  tenant: { id: string; slug: string; name: string };
  membership: { role: 'owner' | 'admin' | 'member' };
}

export default function SettingsGeneral() {
  const { tenantSlug } = useParams();
  const { data } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: () => apiClient.get<TenantOverview>(`/api/t/${tenantSlug}`),
    enabled: !!tenantSlug,
  });

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
          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Workspace name</div>
            <div className="px-4 py-3 rounded border border-border bg-surface-alt text-[14.5px] text-ink">
              {data?.tenant.name ?? '—'}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Workspace URL</div>
            <div className="flex items-center rounded border border-border bg-surface-alt">
              <span className="pl-4 pr-1 text-[14px] text-faint select-none">acumen.app/</span>
              <span className="flex-1 px-1 py-3 text-[14.5px] text-ink">
                {data?.tenant.slug ?? '—'}
              </span>
            </div>
            <p className="text-[12px] text-muted mt-1.5">
              Cannot be changed once created.
            </p>
          </div>

          <div>
            <div className="text-[13px] font-semibold text-ink mb-1.5">Your role</div>
            <div className="px-4 py-3 rounded border border-border bg-surface-alt text-[14.5px] text-ink capitalize">
              {data?.membership.role ?? '—'}
            </div>
          </div>
        </div>

        <div className="rounded border border-border-soft bg-surface-alt px-5 py-4 text-[13.5px] text-ink-soft">
          Need to change your workspace name? Email{' '}
          <a href="mailto:hello@acumen.app" className="text-ink underline underline-offset-2">
            hello@acumen.app
          </a>{' '}
          and we'll update it for you.
        </div>
      </div>
    </SettingsLayout>
  );
}
