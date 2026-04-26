import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comprehensiveResults, summaryResults } from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import type { ExamType } from '@acumen/shared';

export const analyticsRouter = new Hono<AppEnv>();

// Weighted scoring (matches MGIS — A*=10, A=8, ...)
const GRADE_WEIGHT: Record<string, number> = {
  'A*': 10, A: 8, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1, U: 0,
};

const PASS_GRADES_AA = new Set(['A*', 'A']);
const PASS_GRADES_C = new Set(['A*', 'A', 'B', 'C']);

interface GradeRow {
  candidateNumber: string;
  candidateName: string;
  subject: string;
  syllabusCode: string | null;
  grade: string;
  period: string | null;
}

/**
 * Get all results for a tenant, normalised across comprehensive + summary tables.
 */
async function fetchGrades(args: {
  tenantId: string;
  examType: ExamType;
  year?: number;
}): Promise<GradeRow[]> {
  const compConditions = [
    eq(comprehensiveResults.tenantId, args.tenantId),
    eq(comprehensiveResults.examType, args.examType),
  ];
  const sumConditions = [
    eq(summaryResults.tenantId, args.tenantId),
    eq(summaryResults.examType, args.examType),
  ];
  if (args.year) {
    compConditions.push(sql`EXTRACT(YEAR FROM ${comprehensiveResults.period}) = ${args.year}`);
    sumConditions.push(sql`EXTRACT(YEAR FROM ${summaryResults.period}) = ${args.year}`);
  }

  const compRows = await db
    .select({
      candidateNumber: comprehensiveResults.candidateNumber,
      candidateName: comprehensiveResults.candidateName,
      subject: comprehensiveResults.syllabus,
      syllabusCode: comprehensiveResults.syllabus,
      grade: comprehensiveResults.syllabusGrade,
      period: comprehensiveResults.period,
    })
    .from(comprehensiveResults)
    .where(and(...compConditions));

  const sumRows = await db
    .select({
      candidateNumber: summaryResults.candidateNumber,
      candidateName: summaryResults.candidateName,
      subject: summaryResults.subject,
      syllabusCode: summaryResults.syllabusCode,
      grade: summaryResults.grade,
      period: summaryResults.period,
    })
    .from(summaryResults)
    .where(and(...sumConditions));

  return [
    ...compRows
      .filter((r) => r.grade)
      .map((r) => ({
        ...r,
        grade: r.grade as string,
        period: r.period as string | null,
      })),
    ...sumRows.map((r) => ({ ...r, period: r.period as string | null })),
  ];
}

function passRate(rows: { grade: string }[], grades: Set<string>): number {
  if (rows.length === 0) return 0;
  const passed = rows.filter((r) => grades.has(r.grade)).length;
  return Math.round((passed / rows.length) * 1000) / 10;
}

function gradeDistribution(rows: { grade: string }[]) {
  const dist: Record<string, number> = {};
  for (const r of rows) {
    dist[r.grade] = (dist[r.grade] ?? 0) + 1;
  }
  const order = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'];
  return order.map((g) => ({ grade: g, count: dist[g] ?? 0 }));
}

/**
 * GET /api/t/:tenantSlug/analytics/:examType?year=2024
 * Returns the full dashboard payload for IGCSE or A Level.
 */
analyticsRouter.get('/:examType', async (c) => {
  const tenant = c.get('tenant')!;
  const examTypeParam = c.req.param('examType');
  const examType: ExamType =
    examTypeParam === 'alevel' || examTypeParam === 'a-level' ? 'A Level' : 'IGCSE';
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;

  const rows = await fetchGrades({ tenantId: tenant.tenantId, examType, year });

  // Top students — group by candidate, compute weighted score and A* count
  const byCandidate = new Map<
    string,
    { name: string; subjects: number; aStars: number; weighted: number; grades: string[] }
  >();
  for (const r of rows) {
    const key = `${r.candidateNumber}::${r.candidateName}`;
    const cur = byCandidate.get(key) ?? {
      name: r.candidateName,
      subjects: 0,
      aStars: 0,
      weighted: 0,
      grades: [],
    };
    cur.subjects += 1;
    cur.weighted += GRADE_WEIGHT[r.grade] ?? 0;
    if (r.grade === 'A*') cur.aStars += 1;
    cur.grades.push(r.grade);
    byCandidate.set(key, cur);
  }
  const candidates = Array.from(byCandidate.entries()).map(([key, v]) => ({
    candidateNumber: key.split('::')[0],
    ...v,
  }));
  const topByAStar = [...candidates]
    .sort((a, b) => b.aStars - a.aStars || b.weighted - a.weighted)
    .slice(0, 10);
  const topByWeighted = [...candidates]
    .sort((a, b) => b.weighted - a.weighted || b.aStars - a.aStars)
    .slice(0, 10);

  // Subject performance
  const bySubject = new Map<string, { rows: { grade: string }[]; subject: string }>();
  for (const r of rows) {
    const cur = bySubject.get(r.subject) ?? { rows: [], subject: r.subject };
    cur.rows.push({ grade: r.grade });
    bySubject.set(r.subject, cur);
  }
  const subjects = Array.from(bySubject.values())
    .map((s) => ({
      subject: s.subject,
      students: s.rows.length,
      passRateAA: passRate(s.rows, PASS_GRADES_AA),
      passRateC: passRate(s.rows, PASS_GRADES_C),
    }))
    .sort((a, b) => b.passRateAA - a.passRateAA);

  // Timeline — group by period
  const byPeriod = new Map<string, { period: string; rows: { grade: string }[] }>();
  for (const r of rows) {
    const period = r.period ?? 'unknown';
    const cur = byPeriod.get(period) ?? { period, rows: [] };
    cur.rows.push({ grade: r.grade });
    byPeriod.set(period, cur);
  }
  const timeline = Array.from(byPeriod.values())
    .map((p) => ({
      period: p.period,
      label: p.period === 'unknown' ? 'Unknown' : formatPeriod(p.period),
      students: p.rows.length,
      passRateAA: passRate(p.rows, PASS_GRADES_AA),
      passRateC: passRate(p.rows, PASS_GRADES_C),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return c.json({
    examType,
    year,
    overview: {
      totalRecords: rows.length,
      uniqueCandidates: byCandidate.size,
      passRateAA: passRate(rows, PASS_GRADES_AA),
      passRateC: passRate(rows, PASS_GRADES_C),
      avgSubjects:
        byCandidate.size > 0
          ? Math.round((rows.length / byCandidate.size) * 10) / 10
          : 0,
    },
    gradeDistribution: gradeDistribution(rows),
    topStudents: { byAStar: topByAStar, byWeighted: topByWeighted },
    subjects,
    timeline,
  });
});

function formatPeriod(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getFullYear()}`;
}

// ─── PROMOTION ELIGIBILITY ─────────────────────────────
// Cambridge IGCSE promotion rules (defaults — schools can override later):
// - At least 5 subjects passed at C or above
// - English (any code matching 05xx or named 'English Language') passed at C+
// - Mathematics (0580 or named 'Mathematics') passed at C+
// - At least one Science (Biology/Chemistry/Physics/Combined Sciences/Co-ordinated Sciences) passed at C+

const ENG_NAMES = /english\s*language|first\s*language\s*english/i;
const ENG_CODES = /^05(00|10)$/;
const MATH_NAMES = /^mathematics$|extended\s*mathematics/i;
const MATH_CODES = /^058(0|1)$/;
const SCIENCE_NAMES = /biology|chemistry|physics|combined\s*scien|co-?ordinated\s*scien/i;
const SCIENCE_CODES = /^(061[0-9]|062[0-9]|0654|0653)/;
const PASSING_GRADES = new Set(['A*', 'A', 'B', 'C']);

interface CandidateGrade {
  subject: string;
  syllabusCode: string | null;
  grade: string;
}

function classifySubject(g: CandidateGrade): 'english' | 'math' | 'science' | 'other' {
  const code = g.syllabusCode ?? '';
  const name = g.subject;
  if (ENG_CODES.test(code) || ENG_NAMES.test(name)) return 'english';
  if (MATH_CODES.test(code) || MATH_NAMES.test(name)) return 'math';
  if (SCIENCE_CODES.test(code) || SCIENCE_NAMES.test(name)) return 'science';
  return 'other';
}

interface PromotionResult {
  candidateNumber: string;
  candidateName: string;
  totalSubjects: number;
  totalPassed: number;
  hasEnglish: boolean;
  hasMath: boolean;
  hasScience: boolean;
  eligible: boolean;
  reasons: string[];
}

analyticsRouter.get('/promotion/igcse', async (c) => {
  const tenant = c.get('tenant')!;
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;

  const rows = await fetchGrades({ tenantId: tenant.tenantId, examType: 'IGCSE', year });

  const byCandidate = new Map<string, { name: string; grades: CandidateGrade[] }>();
  for (const r of rows) {
    const key = `${r.candidateNumber}::${r.candidateName}`;
    const cur = byCandidate.get(key) ?? { name: r.candidateName, grades: [] };
    cur.grades.push({ subject: r.subject, syllabusCode: r.syllabusCode, grade: r.grade });
    byCandidate.set(key, cur);
  }

  const results: PromotionResult[] = [];
  for (const [key, c] of byCandidate.entries()) {
    const passed = c.grades.filter((g) => PASSING_GRADES.has(g.grade));
    const buckets = passed.map(classifySubject);
    const hasEnglish = buckets.includes('english');
    const hasMath = buckets.includes('math');
    const hasScience = buckets.includes('science');
    const reasons: string[] = [];
    if (passed.length < 5) reasons.push(`Only ${passed.length} subjects passed at C or above (need 5)`);
    if (!hasEnglish) reasons.push('Missing C+ in English');
    if (!hasMath) reasons.push('Missing C+ in Mathematics');
    if (!hasScience) reasons.push('Missing C+ in any Science');
    results.push({
      candidateNumber: key.split('::')[0],
      candidateName: c.name,
      totalSubjects: c.grades.length,
      totalPassed: passed.length,
      hasEnglish,
      hasMath,
      hasScience,
      eligible: reasons.length === 0,
      reasons,
    });
  }

  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return a.candidateName.localeCompare(b.candidateName);
  });

  const eligibleCount = results.filter((r) => r.eligible).length;
  return c.json({
    summary: {
      total: results.length,
      eligible: eligibleCount,
      notEligible: results.length - eligibleCount,
      eligibleRate:
        results.length > 0 ? Math.round((eligibleCount / results.length) * 1000) / 10 : 0,
    },
    candidates: results,
  });
});
