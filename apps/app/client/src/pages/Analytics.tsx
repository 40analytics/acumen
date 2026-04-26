import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from 'recharts';
import { AppShell } from '@/components/AppShell';
import { apiClient } from '@/lib/api';
import { TrendingUp, Award, Users, BookOpen, Download, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ExamType } from '@acumen/shared';

interface Period {
  period: string;
  label: string;
  candidates?: number;
}

interface AnalyticsResponse {
  examType: ExamType;
  year?: number;
  overview: {
    totalRecords: number;
    uniqueCandidates: number;
    passRateAA: number;
    passRateC: number;
    avgSubjects: number;
  };
  gradeDistribution: { grade: string; count: number }[];
  topStudents: {
    byAStar: { candidateNumber: string; name: string; aStars: number; weighted: number; subjects: number }[];
    byWeighted: { candidateNumber: string; name: string; aStars: number; weighted: number; subjects: number }[];
  };
  subjects: { subject: string; students: number; passRateAA: number; passRateC: number }[];
  timeline: { period: string; label: string; students: number; passRateAA: number; passRateC: number }[];
}

const GRADE_COLORS: Record<string, string> = {
  'A*': '#9A3412', A: '#CA8A04', B: '#166534', C: '#0A0A0B',
  D: '#71717A', E: '#A1A1AA', F: '#D4D4D8', G: '#E5E5E5', U: '#F5F5F5',
};

export default function Analytics({ examType }: { examType: 'igcse' | 'alevel' }) {
  const { tenantSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [showUploadBanner, setShowUploadBanner] = useState(
    () => searchParams.get('from') === 'upload'
  );
  const labelType = examType === 'igcse' ? 'IGCSE' : 'A Level';

  // Clean the ?from=upload param from the URL without triggering a re-render loop
  useEffect(() => {
    if (searchParams.get('from') === 'upload') {
      navigate({ search: '' }, { replace: true });
    }
  }, []);

  // Fetch available exam sessions for the period selector
  const { data: periodsData } = useQuery({
    queryKey: ['analytics-periods', tenantSlug, examType],
    queryFn: () =>
      apiClient.get<{ periods: Period[] }>(
        `/api/t/${tenantSlug}/analytics/${examType}/periods`
      ),
    enabled: !!tenantSlug,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', tenantSlug, examType, period],
    queryFn: () =>
      apiClient.get<AnalyticsResponse>(
        `/api/t/${tenantSlug}/analytics/${examType}${period ? `?period=${encodeURIComponent(period)}` : ''}`
      ),
    enabled: !!tenantSlug,
  });

  const empty = !isLoading && (!data || data.overview.totalRecords === 0);

  return (
    <AppShell>
      <div className="container-page py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
              — {labelType} analytics
            </span>
            <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
              {labelType} performance
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <SessionFilter
              periods={periodsData?.periods ?? []}
              period={period}
              onChange={setPeriod}
            />
            <Button
              asChild
              variant="secondary"
              size="md"
              title="CSV columns: candidate number, candidate name, subject, syllabus code, grade, session date. One row per subject entry."
            >
              <a
                href={`/api/t/${tenantSlug}/export/results.csv?examType=${labelType}${period ? `&period=${encodeURIComponent(period)}` : ''}`}
                onClick={() => toast.success('CSV download started')}
              >
                <Download size={14} />
                Export CSV
              </a>
            </Button>
          </div>
        </div>

        {/* Upload success banner */}
        {showUploadBanner && (
          <div className="flex items-center gap-3 mb-8 px-4 py-3 rounded-lg bg-sage-soft border border-sage/20">
            <CheckCircle2 size={16} className="text-sage flex-shrink-0" />
            <span className="text-[13.5px] font-medium text-sage">
              File uploaded and processed — your analytics are ready below.
            </span>
            <button
              onClick={() => setShowUploadBanner(false)}
              className="ml-auto text-sage/60 hover:text-sage text-[18px] leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-3 w-20 mb-4" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </div>
        ) : empty ? (
          <EmptyState
            examType={labelType}
            hasFilter={!!period}
            hasAnyData={(periodsData?.periods.length ?? 0) > 0}
            onClearFilter={() => setPeriod(undefined)}
          />
        ) : (
          <>
            {/* Overview metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <MetricCard
                label="A*/A pass rate"
                value={`${data?.overview.passRateAA ?? 0}%`}
                accent
              />
              <MetricCard label="C+ pass rate" value={`${data?.overview.passRateC ?? 0}%`} />
              <MetricCard
                label="Candidates"
                value={(data?.overview.uniqueCandidates ?? 0).toLocaleString()}
              />
              <MetricCard
                label="Avg subjects"
                value={(data?.overview.avgSubjects ?? 0).toFixed(1)}
              />
            </div>

            {/* Grade distribution + Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
              <div className="card p-6 lg:col-span-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  <TrendingUp size={13} />
                  Grade distribution
                </div>
                <p className="text-[14px] text-ink-soft mb-5">
                  All {labelType} grades across{' '}
                  {period
                    ? (periodsData?.periods.find((p) => p.period === period)?.label ?? period)
                    : 'all sessions'}
                </p>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={data?.gradeDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" vertical={false} />
                      <XAxis
                        dataKey="grade"
                        tick={{ fontSize: 12, fill: '#71717A' }}
                        axisLine={{ stroke: '#E7E5E0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#71717A' }}
                        axisLine={{ stroke: '#E7E5E0' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid #E7E5E0',
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                        formatter={(value) => [`${value} entries`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data?.gradeDistribution.map((d) => (
                          <Cell key={d.grade} fill={GRADE_COLORS[d.grade] ?? '#0A0A0B'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Grade colour legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
                  {Object.entries(GRADE_COLORS).map(([grade, color]) => (
                    <span key={grade} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: color }}
                      />
                      {grade}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card p-6 flex flex-col">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  <Award size={13} />
                  Top of cohort
                </div>
                <p className="text-[14px] text-ink-soft mb-5">By A* count — top 5</p>
                <div className="space-y-3 flex-1">
                  {data?.topStudents.byAStar.slice(0, 5).map((s, i) => (
                    <div
                      key={s.candidateNumber}
                      className="flex items-center justify-between py-2 border-b border-border-soft last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-bold text-faint w-4">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-ink truncate">
                            {s.name}
                          </div>
                          <div className="text-[11px] text-muted">
                            {s.subjects} subjects · {s.weighted} pts
                          </div>
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-accent flex-shrink-0">
                        {s.aStars} × A*
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  to={`/${tenantSlug}/analytics/students`}
                  className="block text-center text-[12.5px] font-semibold text-accent hover:underline mt-4 pt-3 border-t border-border-soft"
                >
                  Search all students →
                </Link>
              </div>
            </div>

            {/* Timeline — only shown when there are 2+ sessions */}
            {data && data.timeline.length === 1 && (
              <div className="card px-6 py-5 mb-10 flex items-center gap-4 bg-surface-alt/40">
                <TrendingUp size={18} className="text-faint flex-shrink-0" />
                <p className="text-[13.5px] text-ink-soft">
                  <strong className="text-ink">Session trend</strong> — Upload results from a second session to unlock a pass-rate timeline across sessions.
                </p>
              </div>
            )}
            {data && data.timeline.length > 1 && (
              <div className="card p-6 mb-10">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  <TrendingUp size={13} />
                  Pass rates across sessions
                </div>
                <p className="text-[14px] text-ink-soft mb-5">
                  Timeline of {labelType} pass rates
                </p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={data.timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#71717A' }}
                        axisLine={{ stroke: '#E7E5E0' }}
                      />
                      <YAxis
                        unit="%"
                        tick={{ fontSize: 11, fill: '#71717A' }}
                        axisLine={{ stroke: '#E7E5E0' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid #E7E5E0',
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="passRateAA"
                        stroke="#9A3412"
                        strokeWidth={2.5}
                        dot={{ fill: '#9A3412', r: 4 }}
                        name="A*/A"
                      />
                      <Line
                        type="monotone"
                        dataKey="passRateC"
                        stroke="#166534"
                        strokeWidth={2.5}
                        dot={{ fill: '#166534', r: 4 }}
                        name="C+"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Subject performance */}
            {data && data.subjects.length > 0 && (
              <div>
                <h2 className="text-[20px] font-bold tracking-tighter mb-5 flex items-center gap-2">
                  <BookOpen size={18} className="text-muted" />
                  Subject performance
                </h2>
                <div className="card overflow-hidden">
                  <table className="w-full text-[14px]">
                    <thead className="bg-surface-alt border-b border-border">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3 text-right">Students</th>
                        <th className="px-5 py-3 text-right">A*/A rate</th>
                        <th className="px-5 py-3 text-right">C+ rate</th>
                        <th className="px-5 py-3">Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((s) => (
                        <tr
                          key={s.subject}
                          className="border-b border-border-soft last:border-0"
                        >
                          <td className="px-5 py-3 font-semibold">{s.subject}</td>
                          <td className="px-5 py-3 text-right">{s.students}</td>
                          <td className="px-5 py-3 text-right font-semibold text-accent">
                            {s.passRateAA}%
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-sage">
                            {s.passRateC}%
                          </td>
                          <td className="px-5 py-3 w-[200px]">
                            <div className="h-2 bg-border-soft rounded-full overflow-hidden flex">
                              <div
                                className="bg-accent"
                                style={{ width: `${s.passRateAA}%` }}
                                title={`A*/A: ${s.passRateAA}%`}
                              />
                              <div
                                className="bg-sage"
                                style={{ width: `${s.passRateC - s.passRateAA}%` }}
                                title={`B–C: ${s.passRateC - s.passRateAA}%`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
        {label}
      </div>
      <div
        className="text-[36px] font-bold tracking-tightest leading-none"
        style={{ color: accent ? '#9A3412' : '#0A0A0B' }}
      >
        {value}
      </div>
    </div>
  );
}

function SessionFilter({
  periods,
  period,
  onChange,
}: {
  periods: Period[];
  period: string | undefined;
  onChange: (p: string | undefined) => void;
}) {
  return (
    <div className="relative">
      <CalendarDays
        size={13}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
      />
      <select
        value={period ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="pl-8 pr-9 py-2 rounded border border-border bg-surface text-[13.5px] font-semibold text-ink cursor-pointer hover:border-ink appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        <option value="">All sessions</option>
        {periods.map((p) => (
          <option key={p.period} value={p.period}>
            {p.label}
            {typeof p.candidates === 'number' ? ` · ${p.candidates} candidates` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({
  examType,
  hasFilter,
  hasAnyData,
  onClearFilter,
}: {
  examType: string;
  hasFilter?: boolean;
  hasAnyData?: boolean;
  onClearFilter?: () => void;
}) {
  // Data exists but selected period has no results
  if (hasFilter) {
    return (
      <div className="card p-12 text-center max-w-[520px] mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-honey-soft text-honey mb-5">
          <CalendarDays size={26} />
        </div>
        <h3 className="text-[20px] font-bold tracking-tightest mb-2">
          No data for this session
        </h3>
        <p className="text-[14.5px] text-ink-soft mb-7">
          There are no {examType} results for the selected period. Try a different session or check your uploads.
        </p>
        <button onClick={onClearFilter} className="btn-primary">
          View all sessions →
        </button>
      </div>
    );
  }

  // Some data uploaded but none for this exam type
  if (hasAnyData) {
    return (
      <div className="card p-12 text-center max-w-[520px] mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-honey-soft text-honey mb-5">
          <BookOpen size={26} />
        </div>
        <h3 className="text-[20px] font-bold tracking-tightest mb-2">
          No {examType} results yet
        </h3>
        <p className="text-[14.5px] text-ink-soft mb-7">
          You have uploads in the system, but none contain {examType} data. Upload an {examType} results file to populate this dashboard.
        </p>
        <a href="../upload" className="btn-primary">
          Upload {examType} results →
        </a>
      </div>
    );
  }

  // No uploads at all
  return (
    <div className="card p-12 text-center max-w-[520px] mx-auto">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-soft text-accent mb-5">
        <Users size={26} />
      </div>
      <h3 className="text-[20px] font-bold tracking-tightest mb-2">
        No {examType} data yet
      </h3>
      <p className="text-[14.5px] text-ink-soft mb-7">
        Upload your first {examType} results file to populate this dashboard.
      </p>
      <a href="../upload" className="btn-primary">
        Upload results →
      </a>
    </div>
  );
}
