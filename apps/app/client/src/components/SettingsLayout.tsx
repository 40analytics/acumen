import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from './AppShell';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  end?: boolean;
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams();
  const location = useLocation();

  const items: NavItem[] = [
    { href: `/${tenantSlug}/settings`, label: 'General', end: true },
    { href: `/${tenantSlug}/settings/team`, label: 'Team' },
    { href: `/${tenantSlug}/billing`, label: 'Billing' },
    { href: `/${tenantSlug}/settings/nomenclature`, label: 'Nomenclature' },
    { href: `/${tenantSlug}/settings/teachers`, label: 'Teachers' },
  ];

  return (
    <AppShell>
      <div className="container-page py-10">
        <div className="mb-8">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            — Settings
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
            Workspace settings
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10">
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = item.end
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'px-3 py-2 rounded text-[14px] font-medium transition-colors',
                    active
                      ? 'bg-ink text-bg'
                      : 'text-muted hover:text-ink hover:bg-surface-alt'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div>{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
