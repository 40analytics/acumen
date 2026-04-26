import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Compass } from 'lucide-react';

export default function NotFound() {
  const { tenantSlug } = useParams();

  return (
    <AppShell>
      <div className="container-page py-20 flex items-center justify-center">
        <div className="text-center max-w-[420px]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-alt text-muted mb-6">
            <Compass size={28} />
          </div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-muted mb-3">
            404 — Page not found
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-3">
            Nothing here
          </h1>
          <p className="text-[15px] text-ink-soft leading-relaxed mb-8">
            This page doesn't exist. It may have been moved, deleted, or you may have mistyped the address.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <Link
              to={tenantSlug ? `/${tenantSlug}/dashboard` : '/'}
              className="btn-primary text-[14px]"
            >
              Go to dashboard
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-5 py-2.5 rounded border border-border text-[14px] font-semibold text-ink hover:bg-surface-alt transition-colors"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
