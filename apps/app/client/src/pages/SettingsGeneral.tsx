import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SettingsLayout } from '@/components/SettingsLayout';
import { apiClient } from '@/lib/api';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
            <Label>Workspace name</Label>
            <Input defaultValue={data?.tenant.name} disabled />
            <p className="text-[12px] text-muted mt-1.5">
              Shown in the nav, on receipts, and in invitation emails.
            </p>
          </div>
          <div>
            <Label>Workspace URL</Label>
            <div className="flex items-center rounded border border-border bg-surface-alt">
              <span className="pl-4 pr-1 text-[14px] text-faint select-none">acumen.app/</span>
              <input
                className="flex-1 px-1 py-3 text-[14.5px] text-ink bg-transparent outline-none"
                value={data?.tenant.slug ?? ''}
                disabled
              />
            </div>
            <p className="text-[12px] text-muted mt-1.5">
              Cannot be changed once created.
            </p>
          </div>
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" disabled>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
