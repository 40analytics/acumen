import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ArrowUpFromLine,
  GraduationCap,
  BookOpen,
  Award,
  FileSpreadsheet,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

interface TenantOverview {
  tenant: { id: string; slug: string; name: string };
  membership: { role: string };
  credits: { balance: number; lifetimePurchased: number; lifetimeSpent: number };
}

interface UploadRow {
  id: string;
  fileName: string;
  examType: 'IGCSE' | 'A Level';
  month: string;
  year: number;
  recordCount: number;
  status: 'processing' | 'processed' | 'failed';
  createdAt: string;
}

export default function Dashboard() {
  const { tenantSlug } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlug],
    queryFn: () => apiClient.get<TenantOverview>(`/api/t/${tenantSlug}`),
    enabled: !!tenantSlug,
  });

  const { data: uploadsData, isLoading: uploadsLoading } = useQuery({
    queryKey: ['uploads', tenantSlug],
    queryFn: () => apiClient.get<{ uploads: UploadRow[] }>(`/api/t/${tenantSlug}/uploads`),
    enabled: !!tenantSlug,
  });

  const recentUploads = uploadsData?.uploads.slice(0, 5) ?? [];
  const hasUploads = uploadsData && uploadsData.uploads.length > 0;

  return (
    <AppShell>
      <div className="container-page py-10">
        {/* Header */}
        <div className="mb-10">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            — Dashboard
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
            {isLoading ? 'Loading…' : data?.tenant.name}
          </h1>
        </div>

        {/* Credit stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {isLoading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-3 w-24 mb-4" />
                <Skeleton className="h-9 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                label="Upload credits"
                value={data?.credits.balance ?? 0}
                sub="Available"
                accent
                href={`/${tenantSlug}/billing`}
              />
              <StatCard
                label="Lifetime purchased"
                value={data?.credits.lifetimePurchased ?? 0}
                sub="Total credits bought"
              />
              <StatCard
                label="Credits used"
                value={data?.credits.lifetimeSpent ?? 0}
                sub="Total uploads processed"
              />
            </>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <QuickAction
            href={`/${tenantSlug}/upload`}
            icon={<ArrowUpFromLine size={20} />}
            label="Upload results"
            description="Add new data"
            primary
          />
          <QuickAction
            href={`/${tenantSlug}/analytics/igcse`}
            icon={<GraduationCap size={20} />}
            label="IGCSE analytics"
            description="View performance"
          />
          <QuickAction
            href={`/${tenantSlug}/analytics/alevel`}
            icon={<BookOpen size={20} />}
            label="A Level analytics"
            description="View performance"
          />
          <QuickAction
            href={`/${tenantSlug}/analytics/promotion`}
            icon={<Award size={20} />}
            label="Promotion report"
            description="Eligibility check"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent uploads */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-bold tracking-tight">Recent uploads</h2>
              <Link
                to={`/${tenantSlug}/upload`}
                className="text-[12.5px] text-accent font-semibold hover:underline"
              >
                View all →
              </Link>
            </div>
            {uploadsLoading ? (
              <div className="card overflow-hidden">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">File</th>
                      <th className="px-5 py-3">Exam</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3 text-right">Records</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2].map((i) => (
                      <tr key={i} className="border-b border-border-soft last:border-0">
                        <td className="px-5 py-3"><Skeleton className="h-4 w-36" /></td>
                        <td className="px-5 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-5 py-3 text-right"><Skeleton className="h-4 w-10 ml-auto" /></td>
                        <td className="px-5 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasUploads ? (
              <div className="card p-10 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-soft text-accent mb-4">
                  <FileSpreadsheet size={22} />
                </div>
                <h3 className="text-[15px] font-semibold mb-1.5">No uploads yet</h3>
                <p className="text-[13.5px] text-ink-soft mb-5 max-w-[320px] mx-auto">
                  Drop a Cambridge Excel file to get instant analytics across subjects, students, and sessions.
                </p>
                <Link to={`/${tenantSlug}/upload`} className="btn-primary text-[13.5px]">
                  Upload your first file →
                </Link>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-[13.5px]">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">File</th>
                      <th className="px-5 py-3">Exam</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3 text-right">Records</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUploads.map((u) => (
                      <tr key={u.id} className="border-b border-border-soft last:border-0">
                        <td className="px-5 py-3 font-semibold max-w-[200px]">
                          <span className="block truncate" title={u.fileName}>{u.fileName}</span>
                        </td>
                        <td className="px-5 py-3 text-ink-soft">{u.examType}</td>
                        <td className="px-5 py-3 text-ink-soft">
                          {u.month} {u.year}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">
                          {u.recordCount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <UploadStatusBadge
                            status={u.status}
                            uploadHref={`/${tenantSlug}/upload`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar: credits + billing CTA */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-muted" />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Credits
                </span>
              </div>
              <div
                className="text-[42px] font-bold tracking-tightest leading-none mb-1"
                style={{ color: '#9A3412' }}
              >
                {data?.credits.balance ?? 0}
              </div>
              <div className="text-[13px] text-ink-soft mb-5">
                upload credits available
              </div>
              {(data?.credits.balance ?? 0) === 0 ? (
                <Link
                  to={`/${tenantSlug}/billing`}
                  className="block w-full py-2.5 rounded bg-ink text-bg text-center text-[13.5px] font-semibold"
                >
                  Top up credits →
                </Link>
              ) : (
                <Link
                  to={`/${tenantSlug}/billing`}
                  className="block w-full py-2.5 rounded border border-border text-center text-[13.5px] font-semibold text-ink hover:bg-border-soft transition-colors"
                >
                  Manage billing
                </Link>
              )}
            </div>

            {hasUploads && (
              <div className="card p-5">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-3">
                  Quick search
                </div>
                <p className="text-[13px] text-ink-soft mb-4">
                  Find any student by name or candidate number.
                </p>
                <Link
                  to={`/${tenantSlug}/analytics/students`}
                  className="block w-full py-2.5 rounded border border-border text-center text-[13.5px] font-semibold text-ink hover:bg-border-soft transition-colors"
                >
                  Search students →
                </Link>
              </div>
            )}
          </div>
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
  href,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="card p-5 h-full group-hover:border-ink/20 transition-colors">
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
  if (href) return (
    <Link
      to={href}
      className="block cursor-pointer group hover:shadow-sm transition-shadow"
    >
      {inner}
    </Link>
  );
  return inner;
}

function QuickAction({
  href,
  icon,
  label,
  description,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={href}
      className={`card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${
        primary ? 'border-accent/40 bg-accent-soft/20' : ''
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          primary ? 'bg-accent text-bg' : 'bg-surface-alt text-ink-soft'
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-[13.5px] font-semibold text-ink tracking-tight">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5">{description}</div>
      </div>
    </Link>
  );
}

function UploadStatusBadge({
  status,
  uploadHref,
}: {
  status: 'processing' | 'processed' | 'failed';
  uploadHref?: string;
}) {
  if (status === 'processed')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 size={12} />
        Done
      </span>
    );
  if (status === 'processing')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
        <Clock size={12} />
        Processing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-coral">
      <XCircle size={12} />
      Failed
      {uploadHref && (
        <Link
          to={uploadHref}
          className="text-[11px] font-semibold text-accent underline underline-offset-2 hover:no-underline"
          title="Go to Uploads to retry"
        >
          Re-upload →
        </Link>
      )}
    </span>
  );
}
