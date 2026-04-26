import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { Check, X, GraduationCap, Download } from 'lucide-react';

interface PromotionResponse {
  summary: {
    total: number;
    eligible: number;
    notEligible: number;
    eligibleRate: number;
  };
  candidates: Array<{
    candidateNumber: string;
    candidateName: string;
    totalSubjects: number;
    totalPassed: number;
    hasEnglish: boolean;
    hasMath: boolean;
    hasScience: boolean;
    eligible: boolean;
    reasons: string[];
  }>;
}

export default function Promotion() {
  const { tenantSlug } = useParams();
  const [year, setYear] = useState<number | undefined>(undefined);
  const [filter, setFilter] = useState<'all' | 'eligible' | 'not-eligible'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['promotion', tenantSlug, year],
    queryFn: () =>
      apiClient.get<PromotionResponse>(
        `/api/t/${tenantSlug}/analytics/promotion/igcse${year ? `?year=${year}` : ''}`
      ),
    enabled: !!tenantSlug,
  });

  const candidates =
    data?.candidates.filter((c) => {
      if (filter === 'eligible') return c.eligible;
      if (filter === 'not-eligible') return !c.eligible;
      return true;
    }) ?? [];

  return (
    <AppShell>
      <div className="container-page py-10">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                — Promotion eligibility
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-honey-soft text-honey border border-honey/20">
                IGCSE only
              </span>
            </div>
            <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
              IGCSE promotion analysis
            </h1>
            <p className="text-[15px] text-ink-soft mt-2 max-w-[560px]">
              Automated assessment of each candidate against Cambridge promotion criteria —
              minimum 5 C+ passes, plus English, Mathematics, and a Science.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year ?? ''}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
              className="px-4 py-2 rounded border border-border bg-surface text-[13.5px] font-semibold text-ink cursor-pointer hover:border-ink"
            >
              <option value="">All years</option>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button asChild variant="secondary" size="md">
              <a
                href={`/api/t/${tenantSlug}/export/promotion.csv${year ? `?year=${year}` : ''}`}
              >
                <Download size={14} />
                Export CSV
              </a>
            </Button>
          </div>
        </div>

        {/* IGCSE-only callout */}
        <div className="flex items-start gap-3 mb-8 px-4 py-3.5 rounded-lg bg-honey-soft border border-honey/20 text-[13.5px] text-ink-soft max-w-[680px]">
          <GraduationCap size={16} className="text-honey mt-0.5 flex-shrink-0" />
          <span>
            Promotion eligibility is assessed using{' '}
            <strong className="text-ink">IGCSE results only</strong>. A Level data is visible in
            the A Level analytics section but is not included in promotion calculations.
          </span>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Stat label="Total candidates" value={data.summary.total} />
            <Stat
              label="Eligible"
              value={data.summary.eligible}
              tint="sage"
            />
            <Stat
              label="Not eligible"
              value={data.summary.notEligible}
              tint="coral"
            />
            <Stat
              label="Eligible rate"
              value={`${data.summary.eligibleRate}%`}
              accent
            />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mb-5">
          {(['all', 'eligible', 'not-eligible'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded text-[13px] font-semibold transition-colors capitalize
                ${filter === f ? 'bg-ink text-bg' : 'bg-surface border border-border text-muted hover:text-ink'}`}
            >
              {f === 'not-eligible' ? 'Not eligible' : f}
              {data && (
                <span className="ml-1.5 text-[11.5px] opacity-70">
                  {f === 'all'
                    ? data.summary.total
                    : f === 'eligible'
                    ? data.summary.eligible
                    : data.summary.notEligible}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-muted py-20 text-center">Loading…</div>
        ) : candidates.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-soft text-accent mb-4">
              <GraduationCap size={26} />
            </div>
            <h3 className="text-[18px] font-bold tracking-tighter mb-2">
              {data?.summary.total === 0
                ? 'No IGCSE data yet'
                : 'No candidates match this filter'}
            </h3>
            <p className="text-[14.5px] text-ink-soft">
              {data?.summary.total === 0
                ? 'Upload an IGCSE results file to assess promotion eligibility.'
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-surface-alt border-b border-border">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3 text-center">English</th>
                  <th className="px-5 py-3 text-center">Math</th>
                  <th className="px-5 py-3 text-center">Science</th>
                  <th className="px-5 py-3 text-right">Passed</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr
                    key={c.candidateNumber}
                    className="border-b border-border-soft last:border-0"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold">{c.candidateName}</div>
                      <div className="text-[12.5px] text-muted">#{c.candidateNumber}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PassDot pass={c.hasEnglish} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PassDot pass={c.hasMath} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PassDot pass={c.hasScience} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      {c.totalPassed}
                      <span className="text-muted text-[12px]">/{c.totalSubjects}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.eligible ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold px-2 py-0.5 rounded bg-sage-soft text-sage">
                          <Check size={11} strokeWidth={3} />
                          Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold px-2 py-0.5 rounded bg-coral-soft text-coral">
                          <X size={11} strokeWidth={3} />
                          Not eligible
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] text-ink-soft">
                      {c.reasons.length === 0 ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {c.reasons.map((r, i) => (
                            <li key={i}>· {r}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
  tint,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  tint?: 'sage' | 'coral';
}) {
  const color = accent ? '#9A3412' : tint === 'sage' ? '#166534' : tint === 'coral' ? '#BE185D' : '#0A0A0B';
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
        {label}
      </div>
      <div className="text-[36px] font-bold tracking-tightest leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function PassDot({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sage-soft text-sage">
      <Check size={11} strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral-soft text-coral">
      <X size={11} strokeWidth={3} />
    </span>
  );
}
