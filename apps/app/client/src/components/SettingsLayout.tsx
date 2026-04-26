import type { ReactNode } from 'react';
import { AppShell } from './AppShell';

/**
 * Thin page wrapper for the workspace pages (General, Team, Teachers,
 * Nomenclature, Billing). The sidebar in AppShell already provides the
 * top-level navigation between these pages, so this layout intentionally
 * does NOT render an inner sub-nav — each page just gets a consistent
 * `container-page` padded area inside the app shell.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="container-page py-10">{children}</div>
    </AppShell>
  );
}
