import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/api';
import { UserSquare2, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface SubjectStat {
  syllabusCode: string;
  students: number;
  passRateAA: number;
  passRateC: number;
  isPrimary: boolean;
}

interface TeacherStat {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  subjects: SubjectStat[];
  totalStudents: number;
}

interface TeachersResponse {
  teachers: TeacherStat[];
  examType: string;
  year?: number;
}

const YEARS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

export default function TeacherAnalytics() {
  const { tenantSlug } = useParams();
  const [examType, setExamType] = useState<'igcse' | 'alevel'>('igcse');
  const [year, setYear] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [teacherSearch, setTeacherSearch] = useState('');

  const labelType = examType === 'igcse' ? 'IGCSE' : 'A Level';

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-analytics', tenantSlug, examType, year],
    queryFn: () =>
      apiClient.get<TeachersResponse>(
        `/api/t/${tenantSlug}/analytics/teachers?examType=${encodeURIComponent(labelType)}${year ? `&year=${year}` : ''}`
      ),
    enabled: !!tenantSlug,
  });

  function toggleExpand(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allTeachers = data?.teachers ?? [];
  const teachers = teacherSearch.trim()
    ? allTeachers.filter((t) =>
        t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        (t.department ?? '').toLowerCase().includes(teacherSearch.toLowerCase())
      )
    : allTeachers;

  return (
    <AppShell>
      <div className="container-page py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
              — Analytics
            </span>
            <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2">
              Teacher performance
            </h1>
            <p className="text-[15px] text-ink-soft mt-2 max-w-[560px]">
              Pass rates for each teacher across their assigned subjects. Assign subjects in{' '}
              <a
                href={`/${tenantSlug}/teachers`}
                className="text-ink underline underline-offset-2 hover:text-accent"
              >
                Teachers settings
              </a>{' '}
              to see data here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Exam type toggle */}
            <div className="flex gap-1 p-1 rounded border border-border bg-surface">
              {(['igcse', 'alevel'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setExamType(t)}
                  className={`px-3.5 py-1.5 rounded text-[13px] font-semibold transition-colors ${
                    examType === t ? 'bg-ink text-bg' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {t === 'igcse' ? 'IGCSE' : 'A Level'}
                </button>
              ))}
            </div>
            {/* Year filter */}
            <select
              value={year ?? ''}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
              className="px-4 py-2 rounded border border-border bg-surface text-[13.5px] font-semibold text-ink cursor-pointer hover:border-ink"
            >
              <option value="">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card px-5 py-4 flex items-center gap-6">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <div className="card p-12 text-center max-w-[520px] mx-auto">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-honey-soft text-honey mb-5">
              <UserSquare2 size={26} />
            </div>
            <h3 className="text-[20px] font-bold tracking-tightest mb-2">
              No teacher data yet
            </h3>
            <p className="text-[14.5px] text-ink-soft mb-6">
              Assign subjects to teachers in the Teachers settings page, then upload results to
              see performance attributed by teacher.
            </p>
            <a href={`/${tenantSlug}/teachers`} className="btn-primary">
              Manage teachers →
            </a>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <p className="text-[13px] text-muted">
                {teacherSearch
                  ? `${teachers.length} of ${allTeachers.length} teacher${allTeachers.length !== 1 ? 's' : ''}`
                  : `${allTeachers.length} teacher${allTeachers.length !== 1 ? 's' : ''}`}{' '}
                with {labelType} subject assignments
              </p>
              {allTeachers.length >= 4 && (
                <div className="relative flex-shrink-0">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
                  />
                  <input
                    type="text"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="Filter by name or department…"
                    className="pl-8 pr-4 py-1.5 rounded border border-border bg-surface text-[13px] text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors"
                  />
                </div>
              )}
            </div>
            <div className="card overflow-hidden">
              {teachers.length === 0 && teacherSearch ? (
                <div className="px-5 py-10 text-center text-[13.5px] text-muted">
                  No teachers match "{teacherSearch}"
                </div>
              ) : null}
              {teachers.map((t, idx) => {
                const open = expanded.has(t.id);
                const avgPassAA =
                  t.subjects.length > 0
                    ? Math.round(
                        t.subjects.reduce((s, x) => s + x.passRateAA, 0) / t.subjects.length
                      )
                    : 0;
                const avgPassC =
                  t.subjects.length > 0
                    ? Math.round(
                        t.subjects.reduce((s, x) => s + x.passRateC, 0) / t.subjects.length
                      )
                    : 0;

                return (
                  <div
                    key={t.id}
                    className={idx < teachers.length - 1 ? 'border-b border-border-soft' : ''}
                  >
                    {/* Summary row */}
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-surface-alt/40 transition-colors text-left"
                    >
                      <div className="text-faint flex-shrink-0 mt-1">
                        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </div>

                      {/* Name + mobile stats */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-[14.5px] font-semibold text-ink">{t.name}</div>
                          <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded bg-honey-soft text-honey flex-shrink-0">
                            {t.subjects.length} subject{t.subjects.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {(t.department || t.position) && (
                          <div className="text-[12.5px] text-muted mt-0.5">
                            {[t.position, t.department].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {/* Compact stats row — always visible on mobile, hidden on sm+ */}
                        <div className="flex items-center gap-4 mt-2 sm:hidden">
                          <span className="text-[12px] text-ink-soft">
                            <span className="font-semibold text-ink">{t.totalStudents.toLocaleString()}</span> students
                          </span>
                          <span className="text-[12px] text-accent font-semibold">{avgPassAA}% A*/A</span>
                          <span className="text-[12px] text-sage font-semibold">{avgPassC}% C+</span>
                        </div>
                      </div>

                      {/* Stats — desktop only */}
                      <div className="hidden sm:flex items-center gap-8 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-[10.5px] uppercase tracking-wider text-muted mb-0.5">
                            Students
                          </div>
                          <div className="text-[15px] font-bold text-ink">
                            {t.totalStudents.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10.5px] uppercase tracking-wider text-muted mb-0.5">
                            A*/A avg
                          </div>
                          <div className="text-[15px] font-bold text-accent">{avgPassAA}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10.5px] uppercase tracking-wider text-muted mb-0.5">
                            C+ avg
                          </div>
                          <div className="text-[15px] font-bold text-sage">{avgPassC}%</div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded subject breakdown */}
                    {open && (
                      <div className="border-t border-border-soft bg-surface-alt/30">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                              <th className="pl-12 pr-5 py-2.5">Syllabus code</th>
                              <th className="px-5 py-2.5 text-right">Students</th>
                              <th className="px-5 py-2.5 text-right">A*/A rate</th>
                              <th className="px-5 py-2.5 text-right">C+ rate</th>
                              <th className="px-5 py-2.5 w-[160px]">Distribution</th>
                              <th className="px-5 py-2.5">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.subjects.map((s) => (
                              <tr
                                key={s.syllabusCode}
                                className="border-t border-border-soft/50 hover:bg-surface-alt/20"
                              >
                                <td className="pl-12 pr-5 py-2.5">
                                  <code className="text-[12px] font-semibold bg-surface px-2 py-0.5 rounded border border-border">
                                    {s.syllabusCode}
                                  </code>
                                </td>
                                <td className="px-5 py-2.5 text-right font-semibold">
                                  {s.students.toLocaleString()}
                                </td>
                                <td className="px-5 py-2.5 text-right font-semibold text-accent">
                                  {s.passRateAA}%
                                </td>
                                <td className="px-5 py-2.5 text-right font-semibold text-sage">
                                  {s.passRateC}%
                                </td>
                                <td className="px-5 py-2.5">
                                  <div className="h-1.5 bg-border-soft rounded-full overflow-hidden flex">
                                    <div
                                      className="bg-accent"
                                      style={{ width: `${s.passRateAA}%` }}
                                      title={`A*/A: ${s.passRateAA}%`}
                                    />
                                    <div
                                      className="bg-sage"
                                      style={{ width: `${Math.max(s.passRateC - s.passRateAA, 0)}%` }}
                                      title={`B–C: ${s.passRateC - s.passRateAA}%`}
                                    />
                                  </div>
                                </td>
                                <td className="px-5 py-2.5">
                                  {s.isPrimary ? (
                                    <span className="text-[11px] font-semibold text-honey bg-honey-soft px-1.5 py-0.5 rounded">
                                      Primary
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-faint">Supporting</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
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
