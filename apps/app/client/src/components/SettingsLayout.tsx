import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from './AppShell';

// These must match the actual flat routes in App.tsx
const SETTINGS_PAGES = [
  { label: 'General', href: (slug: string) => `/${slug}/settings`, exact: true },
  { label: 'Team', href: (slug: string) => `/${slug}/team`, exact: false },
  { label: 'Teachers', href: (slug: string) => `/${slug}/teachers`, exact: false },
  { label: 'Nomenclature', href: (slug: string) => `/${slug}/nomenclature`, exact: false },
];

/**
 * Page wrapper for workspace settings pages with a horizontal tab-style
 * sub-nav that makes the active section immediately obvious.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams();
  const { pathname } = useLocation();

  return (
    <AppShell>
      {/* Breadcrumb + sub-nav strip */}
      <div className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="container-page">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 pt-3 pb-1 text-[12px] text-muted">
            <Link to={`/${tenantSlug}/dashboard`} className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <span className="text-faint">/</span>
            <span className="text-ink font-medium">Settings</span>
          </div>
          {/* Tab nav */}
          <nav className="flex gap-1 -mb-px" aria-label="Settings sections">
            {SETTINGS_PAGES.map((page) => {
              const href = page.href(tenantSlug ?? '');
              const active = page.exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={page.label}
                  to={href}
                  className={`px-3 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors
                    ${active
                      ? 'border-ink text-ink'
                      : 'border-transparent text-muted hover:text-ink hover:border-border'
                    }`}
                >
                  {page.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="container-page py-10">{children}</div>
    </AppShell>
  );
}
