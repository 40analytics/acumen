import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { apiClient } from '@/lib/api';
import { Search, ChevronDown, ChevronUp, User } from 'lucide-react';

const GRADE_WEIGHT: Record<string, number> = {
  'A*': 10, A: 8, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1, U: 0,
};

const GRADE_COLORS: Record<string, { bg: string; fg: string }> = {
  'A*': { bg: '#FEF3C7', fg: '#92400E' },
  A: { bg: '#DCFCE7', fg: '#166534' },
  B: { bg: '#DBEAFE', fg: '#1E40AF' },
  C: { bg: '#F0FDF4', fg: '#166534' },
  D: { bg: '#F5F5F4', fg: '#78716C' },
  E: { bg: '#F5F5F4', fg: '#A8A29E' },
  U: { bg: '#FEE2E2', fg: '#991B1B' },
};

function gradeStyle(g: string) {
  return GRADE_COLORS[g] ?? { bg: '#F5F5F4', fg: '#71717A' };
}

interface SubjectEntry {
  subject: string;
  syllabusCode: string | null;
  grade: string;
  period: string | null;
}

interface Candidate {
  candidateNumber: string;
  name: string;
  aStars: number;
  weighted: number;
  passRateC: number;
  subjects: SubjectEntry[];
}

interface StudentsResponse {
  candidates: Candidate[];
  total: number;
  examType: string;
  q: string;
}

function formatPeriod(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function StudentSearch() {
  const { tenantSlug } = useParams();
  const [query, setQuery] = useState('');
  const [examType, setExamType] = useState<'igcse' | 'alevel'>('igcse');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const debouncedQ = useDebounce(query, 350);
  const labelType = examType === 'igcse' ? 'IGCSE' : 'A Level';

  const { data, isFetching } = useQuery({
    queryKey: ['students', tenantSlug, debouncedQ, examType],
    queryFn: () =>
      apiClient.get<StudentsResponse>(
        `/api/t/${tenantSlug}/analytics/students?q=${encodeURIComponent(debouncedQ)}&examType=${examType}`
      ),
    enabled: !!tenantSlug && debouncedQ.length >= 2,
    placeholderData: (prev) => prev,
  });

  function toggleExpand(key: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const candidates = data?.candidates ?? [];
  const showResults = debouncedQ.length >= 2;

  return (
    <AppShell>
      <div className="container-page py-10">
        {/* Header */}
        <div className="mb-8">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            — Analytics
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
            Student search
          </h1>
          <p className="text-[15px] text-ink-soft mt-2 max-w-[540px]">
            Find any student by name or candidate number. See every subject, grade, and session across all uploaded data.
          </p>
        </div>

        {/* Search bar + exam type toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or candidate number…"
              className="w-full pl-10 pr-4 py-2.5 rounded border border-border bg-surface text-[14px] text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors"
              autoFocus
            />
            {isFetching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-ink/20 border-t-ink/60 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Exam type */}
          <div className="flex gap-1 p-1 rounded border border-border bg-surface">
            {(['igcse', 'alevel'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setExamType(t)}
                className={`px-4 py-1.5 rounded text-[13px] font-semibold transition-colors ${
                  examType === t ? 'bg-ink text-bg' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t === 'igcse' ? 'IGCSE' : 'A Level'}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {!showResults ? (
          <EmptyPrompt />
        ) : candidates.length === 0 ? (
          <NoResults q={debouncedQ} examType={labelType} />
        ) : (
          <div>
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div>
                <p className="text-[13px] text-muted">
                  {(data?.total ?? candidates.length) > 100
                    ? `Showing 100 of ${data!.total} matches`
                    : `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} found`}
                </p>
                {(data?.total ?? 0) > 100 && (
                  <p className="text-[12px] text-faint mt-0.5">
                    Refine your search to see fewer, more relevant results.
                  </p>
                )}
              </div>
              <span className="text-[12px] text-faint flex-shrink-0">{labelType}</span>
            </div>

            <div className="space-y-2">
              {candidates.map((c) => {
                const key = `${c.candidateNumber}::${c.name}`;
                const open = expanded.has(key);
                return (
                  <div key={key} className="card overflow-hidden">
                    {/* Candidate summary row */}
                    <button
                      onClick={() => toggleExpand(key)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center flex-shrink-0">
                        <User size={15} className="text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[14.5px] font-semibold text-ink">{c.name}</span>
                          <span className="text-[12px] text-muted font-mono">{c.candidateNumber}</span>
                        </div>
                        <div className="text-[12.5px] text-muted mt-0.5">
                          {c.subjects.length} subject{c.subjects.length !== 1 ? 's' : ''}
                          {' · '}
                          {c.aStars > 0 && (
                            <span className="text-accent font-semibold">{c.aStars} × A*{' · '}</span>
                          )}
                          {c.passRateC}% at C+
                        </div>
                      </div>
                      {/* Grade pill preview — 3 on mobile, 6 on sm+ */}
                      <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                        {c.subjects.slice(0, 3).map((s, i) => {
                          const gs = gradeStyle(s.grade);
                          return (
                            <span
                              key={i}
                              className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: gs.bg, color: gs.fg }}
                            >
                              {s.grade}
                            </span>
                          );
                        })}
                        {c.subjects.slice(3, 6).map((s, i) => {
                          const gs = gradeStyle(s.grade);
                          return (
                            <span
                              key={i + 3}
                              className="hidden sm:inline-block text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: gs.bg, color: gs.fg }}
                            >
                              {s.grade}
                            </span>
                          );
                        })}
                        {c.subjects.length > 6 && (
                          <span className="text-[11px] text-muted">+{c.subjects.length - 6}</span>
                        )}
                      </div>
                      <div className="text-faint flex-shrink-0">
                        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </button>

                    {/* Expanded subject table */}
                    {open && (
                      <div className="border-t border-border-soft">
                        <table className="w-full text-[13px]">
                          <thead className="bg-surface-alt">
                            <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                              <th className="px-5 py-2.5">Subject</th>
                              <th className="px-5 py-2.5">Code</th>
                              <th className="px-5 py-2.5">Session</th>
                              <th className="px-5 py-2.5 text-center">Grade</th>
                              <th className="px-5 py-2.5 text-right">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.subjects.map((s, i) => {
                              const gs = gradeStyle(s.grade);
                              return (
                                <tr
                                  key={i}
                                  className="border-t border-border-soft/60 first:border-0"
                                >
                                  <td className="px-5 py-2.5 font-medium text-ink">
                                    {s.subject}
                                  </td>
                                  <td className="px-5 py-2.5">
                                    {s.syllabusCode ? (
                                      <code className="text-[11.5px] bg-surface-alt px-1.5 py-0.5 rounded text-muted">
                                        {s.syllabusCode}
                                      </code>
                                    ) : (
                                      <span className="text-faint">—</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-2.5 text-ink-soft">
                                    {s.period ? formatPeriod(s.period) : '—'}
                                  </td>
                                  <td className="px-5 py-2.5 text-center">
                                    <span
                                      className="inline-block text-[12px] font-bold px-2 py-0.5 rounded"
                                      style={{ background: gs.bg, color: gs.fg }}
                                    >
                                      {s.grade}
                                    </span>
                                  </td>
                                  <td className="px-5 py-2.5 text-right text-muted font-medium">
                                    {GRADE_WEIGHT[s.grade] ?? 0}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border bg-surface-alt/50">
                              <td colSpan={4} className="px-5 py-2.5 text-[12px] font-semibold text-muted text-right">
                                Total weighted score
                              </td>
                              <td className="px-5 py-2.5 text-right font-bold text-ink">
                                {c.weighted}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyPrompt() {
  return (
    <div className="card p-12 text-center max-w-[480px] mx-auto">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-alt text-muted mb-5">
        <Search size={24} />
      </div>
      <h3 className="text-[17px] font-bold tracking-tighter mb-2">
        Search for a student
      </h3>
      <p className="text-[14px] text-ink-soft">
        Type at least 2 characters — name or candidate number — to see matching records from all uploaded sessions.
      </p>
    </div>
  );
}

function NoResults({ q, examType }: { q: string; examType: string }) {
  return (
    <div className="card p-12 text-center max-w-[480px] mx-auto">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-alt text-muted mb-5">
        <User size={24} />
      </div>
      <h3 className="text-[17px] font-bold tracking-tighter mb-2">No results</h3>
      <p className="text-[14px] text-ink-soft">
        No {examType} candidates match <strong>"{q}"</strong>. Check spelling or try the other exam type.
      </p>
    </div>
  );
}
