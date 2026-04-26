import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Eye, X } from 'lucide-react';

interface MeWithImpersonation {
  user: { email: string; name: string | null };
  impersonation: { realEmail: string; realName: string | null } | null;
}

/**
 * Sticky banner shown on every page when the current session is impersonating.
 * Survives navigation. Clicking "Stop" returns to the super admin's identity.
 */
export function ImpersonationBanner() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<MeWithImpersonation>('/api/me'),
  });
  const stop = useMutation({
    mutationFn: () => apiClient.post('/api/admin/stop-impersonate'),
    onSuccess: () => {
      qc.invalidateQueries();
      window.location.href = '/admin';
    },
  });

  if (!data?.impersonation) return null;

  return (
    <div
      className="sticky top-0 z-[100] border-b text-bg"
      style={{
        background:
          'linear-gradient(95deg, #9A3412 0%, #BE185D 50%, #9A3412 100%)',
        backgroundSize: '200% 100%',
      }}
    >
      <div className="container-page py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg/20 backdrop-blur-sm flex-shrink-0">
            <Eye size={14} />
          </span>
          <div className="text-[13px] truncate">
            <span className="font-semibold">Impersonating</span>{' '}
            <span className="opacity-85">
              {data.user.name ?? data.user.email}
            </span>
            <span className="hidden sm:inline opacity-65 ml-2">
              · signed in as{' '}
              {data.impersonation.realName ?? data.impersonation.realEmail}
            </span>
          </div>
        </div>
        <button
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded
            bg-bg/15 hover:bg-bg/25 transition-colors flex-shrink-0"
        >
          <X size={12} />
          {stop.isPending ? 'Stopping…' : 'Stop impersonating'}
        </button>
      </div>
    </div>
  );
}
