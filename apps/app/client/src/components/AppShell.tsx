import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Logo } from './Logo';
import { signOut } from '@/lib/auth-client';
import { apiClient } from '@/lib/api';
import {
  ChevronDown,
  ChevronsUpDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  ArrowUpFromLine,
  GraduationCap,
  BookOpen,
  Award,
  CreditCard,
  Users as UsersIcon,
  UserSquare2,
  Tag,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ImpersonationBanner } from './ImpersonationBanner';
import { cn } from '@/lib/cn';

interface MeData {
  user: { id: string; email: string; name: string | null; isSuperAdmin: boolean };
  tenants: Array<{ slug: string; name: string; role: string }>;
}

const COLLAPSE_KEY = 'acumen.sidebar.collapsed';

function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);
  return [collapsed, setCollapsed];
}

export function AppShell({ children }: { children: ReactNode }) {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<MeData>('/api/me'),
  });
  const { data: tenantOverview } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: () =>
      apiClient.get<{ credits: { balance: number } }>(`/api/t/${tenantSlug}`),
    enabled: !!tenantSlug,
  });

  const currentTenant = me?.tenants.find((t) => t.slug === tenantSlug);
  const credits = tenantOverview?.credits.balance ?? 0;

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[240px]';
  const mainOffset = collapsed ? 'lg:pl-[68px]' : 'lg:pl-[240px]';

  return (
    <div className="min-h-screen">
      {/* ── SIDEBAR — fixed, never scrolls ── */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen flex-shrink-0',
          'bg-bg border-r border-border-soft flex flex-col',
          'transition-[width,transform] duration-200 ease-out',
          sidebarWidth,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
          {/* Logo + collapse toggle */}
          <div
            className={cn(
              'flex items-center pt-5 pb-4 transition-all',
              collapsed ? 'px-3 justify-center' : 'px-5 justify-between'
            )}
          >
            <Link to={`/${tenantSlug}/dashboard`} className="block">
              <Logo size="md" showWordmark={!collapsed} />
            </Link>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                className="hidden lg:flex p-1.5 -mr-1 text-faint hover:text-ink hover:bg-border-soft rounded transition-colors"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </div>

          {/* Tenant switcher */}
          <div className={cn('pb-4', collapsed ? 'px-3' : 'px-4')}>
            <TenantSwitcher
              me={me}
              currentTenant={currentTenant}
              collapsed={collapsed}
            />
          </div>

          {/* Nav */}
          <nav
            className={cn(
              'flex-1 overflow-y-auto pb-4 space-y-7',
              collapsed ? 'px-3' : 'px-3'
            )}
          >
            <NavSection collapsed={collapsed}>
              <NavItem
                href={`/${tenantSlug}/dashboard`}
                label="Dashboard"
                icon={<LayoutDashboard size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/upload`}
                label="Upload"
                icon={<ArrowUpFromLine size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
            </NavSection>

            <NavSection title="Analytics" collapsed={collapsed}>
              <NavItem
                href={`/${tenantSlug}/analytics/igcse`}
                label="IGCSE"
                icon={<GraduationCap size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/analytics/alevel`}
                label="A Level"
                icon={<BookOpen size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/analytics/promotion`}
                label="Promotion"
                icon={<Award size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
            </NavSection>

            <NavSection title="Workspace" collapsed={collapsed}>
              <NavItem
                href={`/${tenantSlug}/billing`}
                label="Billing"
                icon={<CreditCard size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/team`}
                label="Team"
                icon={<UsersIcon size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/teachers`}
                label="Teachers"
                icon={<UserSquare2 size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/nomenclature`}
                label="Nomenclature"
                icon={<Tag size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
              <NavItem
                href={`/${tenantSlug}/settings`}
                label="Settings"
                icon={<SettingsIcon size={17} strokeWidth={1.9} />}
                collapsed={collapsed}
                end
                onClick={() => setMobileOpen(false)}
              />
            </NavSection>
          </nav>

          {/* Footer: credits + user + expand button (when collapsed) */}
          <div
            className={cn(
              'pb-4 pt-3 border-t border-border-soft space-y-2',
              collapsed ? 'px-3' : 'px-4'
            )}
          >
            {collapsed ? (
              <>
                <Link
                  to={`/${tenantSlug}/billing`}
                  title={`${credits} credits`}
                  className="flex flex-col items-center justify-center w-full h-11 rounded
                    bg-accent-soft text-accent hover:opacity-90 transition-opacity"
                >
                  <span className="text-[11px] font-bold leading-none tracking-tight">
                    {credits}
                  </span>
                  <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] mt-0.5 opacity-70">
                    credits
                  </span>
                </Link>
                <UserMenu me={me} navigate={navigate} collapsed />
                <button
                  onClick={() => setCollapsed(false)}
                  className="hidden lg:flex w-full h-9 items-center justify-center text-faint hover:text-ink hover:bg-border-soft rounded transition-colors"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                >
                  <PanelLeftOpen size={15} />
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/${tenantSlug}/billing`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded
                    bg-accent-soft text-accent hover:opacity-90 transition-opacity"
                >
                  <span className="text-[12.5px] font-semibold tracking-tight">
                    Credits
                  </span>
                  <span className="text-[14px] font-bold tracking-tightest">
                    {credits}
                  </span>
                </Link>
                <UserMenu me={me} navigate={navigate} collapsed={false} />
              </>
            )}
          </div>
      </aside>

      {/* ── MOBILE BACKDROP ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── MAIN — offset by sidebar width on desktop ── */}
      <div className={cn('min-h-screen transition-[padding] duration-200', mainOffset)}>
        {/* Impersonation banner — sticky at top of main area */}
        <ImpersonationBanner />

        {/* Mobile-only top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-border-soft">
          <div className="px-4 h-[60px] flex items-center justify-between">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 text-ink hover:bg-border-soft rounded"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <Logo size="md" showWordmark={false} />
            <Link
              to={`/${tenantSlug}/billing`}
              className="inline-flex items-center px-2.5 py-1.5 rounded
                bg-accent-soft text-accent text-[12px] font-bold tracking-tight"
            >
              {credits}
            </Link>
          </div>
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}

function NavSection({
  title,
  children,
  collapsed,
}: {
  title?: string;
  children: ReactNode;
  collapsed: boolean;
}) {
  return (
    <div>
      {title && !collapsed && (
        <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted flex items-center gap-2">
          <span className="w-3 h-px bg-border" />
          <span>{title}</span>
        </div>
      )}
      {title && collapsed && (
        <div className="mx-2 my-2 h-px bg-border" aria-hidden />
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  end,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const location = useLocation();
  const active = end
    ? location.pathname === href
    : location.pathname.startsWith(href);

  if (collapsed) {
    return (
      <Link
        to={href}
        onClick={onClick}
        title={label}
        className={cn(
          'flex items-center justify-center h-10 rounded transition-colors',
          active
            ? 'bg-ink text-bg'
            : 'text-ink-soft hover:text-ink hover:bg-border-soft'
        )}
      >
        {icon}
      </Link>
    );
  }

  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded text-[14px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-ink text-bg'
          : 'text-ink-soft hover:text-ink hover:bg-border-soft'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function TenantSwitcher({
  me,
  currentTenant,
  collapsed,
}: {
  me: MeData | undefined;
  currentTenant: { slug: string; name: string; role: string } | undefined;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const initial = currentTenant?.name.charAt(0).toUpperCase() ?? '?';

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((s) => !s)}
          title={currentTenant?.name ?? 'Workspace'}
          className="w-full h-10 rounded bg-surface border border-border hover:border-ink transition-colors flex items-center justify-center"
        >
          <span
            className="w-7 h-7 rounded text-[12px] font-bold text-bg flex items-center justify-center"
            style={{ background: '#9A3412' }}
          >
            {initial}
          </span>
        </button>
        {open && me && (
          <SwitcherPopover
            me={me}
            currentSlug={currentTenant?.slug}
            onPick={(slug) => {
              navigate(`/${slug}/dashboard`);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
            anchor="left"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded
          bg-surface border border-border hover:border-ink transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded text-[11px] font-bold text-bg flex items-center justify-center flex-shrink-0"
            style={{ background: '#9A3412' }}
          >
            {initial}
          </span>
          <span className="text-[13.5px] font-semibold text-ink tracking-tight truncate">
            {currentTenant?.name ?? 'Loading…'}
          </span>
        </div>
        <ChevronsUpDown size={13} className="text-faint flex-shrink-0" />
      </button>
      {open && me && (
        <SwitcherPopover
          me={me}
          currentSlug={currentTenant?.slug}
          onPick={(slug) => {
            navigate(`/${slug}/dashboard`);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function SwitcherPopover({
  me,
  currentSlug,
  onPick,
  onClose,
  anchor = 'self',
}: {
  me: MeData;
  currentSlug?: string;
  onPick: (slug: string) => void;
  onClose: () => void;
  anchor?: 'self' | 'left';
}) {
  return (
    <div
      className={cn(
        'absolute top-full mt-2 w-64 bg-surface border border-border rounded shadow-lg py-1.5 z-20',
        anchor === 'left' ? 'left-full ml-2 -mt-10' : 'left-0 right-0'
      )}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
        Your workspaces
      </div>
      {me.tenants.map((t) => (
        <button
          key={t.slug}
          onClick={() => onPick(t.slug)}
          className="w-full text-left px-3 py-2 hover:bg-bg flex items-center justify-between"
        >
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink truncate">{t.name}</div>
            <div className="text-[11.5px] text-muted truncate">acumen.app/{t.slug}</div>
          </div>
          {t.slug === currentSlug && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
          )}
        </button>
      ))}
      <div className="border-t border-border-soft mt-1 pt-1">
        <Link
          to="/onboarding"
          onClick={onClose}
          className="block px-3 py-2 text-[13px] text-ink-soft hover:bg-bg"
        >
          + Create new workspace
        </Link>
      </div>
    </div>
  );
}

function UserMenu({
  me,
  navigate,
  collapsed,
}: {
  me: MeData | undefined;
  navigate: (to: string) => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const initial = (me.user.name ?? me.user.email).charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((s) => !s)}
          title={me.user.name ?? me.user.email}
          className="w-full h-10 flex items-center justify-center rounded hover:bg-border-soft transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-ink text-bg text-[12px] font-bold flex items-center justify-center">
            {initial}
          </span>
        </button>
        {open && (
          <div className="absolute bottom-0 left-full ml-2 w-56 bg-surface border border-border rounded shadow-lg py-1.5 z-20">
            <div className="px-3 py-2 border-b border-border-soft">
              <div className="text-[12.5px] font-semibold text-ink truncate">
                {me.user.name ?? me.user.email.split('@')[0]}
              </div>
              <div className="text-[11px] text-muted truncate">{me.user.email}</div>
            </div>
            <Link
              to="/admin/login"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-accent hover:bg-bg font-semibold"
            >
              Admin portal →
            </Link>
            <button
              onClick={async () => {
                await signOut();
                navigate('/signin');
              }}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-soft hover:bg-bg flex items-center gap-2"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded hover:bg-border-soft transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-ink text-bg text-[12px] font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </span>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[12.5px] font-semibold text-ink truncate">
            {me.user.name ?? me.user.email.split('@')[0]}
          </div>
          <div className="text-[11px] text-muted truncate">{me.user.email}</div>
        </div>
        <ChevronDown size={12} className="text-faint flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-border rounded shadow-lg py-1.5 z-20">
          {me.user.isSuperAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-accent hover:bg-bg font-semibold"
            >
              Super admin →
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              navigate('/signin');
            }}
            className="w-full text-left px-3 py-2 text-[13px] text-ink-soft hover:bg-bg flex items-center gap-2"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
