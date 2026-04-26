import { Hono } from 'hono';
import { and, count, countDistinct, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  comprehensiveResults,
  summaryResults,
  teachers,
  teacherSubjects,
} from '../db/schema.js';
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
  period?: string; // ISO date — filters to exact exam session
}): Promise<GradeRow[]> {
  const compConditions = [
    eq(comprehensiveResults.tenantId, args.tenantId),
    eq(comprehensiveResults.examType, args.examType),
  ];
  const sumConditions = [
    eq(summaryResults.tenantId, args.tenantId),
    eq(summaryResults.examType, args.examType),
  ];

  if (args.period) {
    compConditions.push(eq(comprehensiveResults.period, args.period));
    sumConditions.push(eq(summaryResults.period, args.period));
  } else if (args.year) {
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

function formatPeriod(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getFullYear()}`;
}

function parseExamType(param: string): ExamType {
  return param === 'alevel' || param === 'a-level' ? 'A Level' : 'IGCSE';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/t/:tenantSlug/analytics/:examType/periods
// Returns the distinct exam sessions that have data (for the period selector).
// ─────────────────────────────────────────────────────────────────────────────
analyticsRouter.get('/:examType/periods', async (c) => {
  const tenant = c.get('tenant')!;
  const examType = parseExamType(c.req.param('examType'));

  // Fetch candidate counts per period from both result tables
  const [compPeriods, sumPeriods] = await Promise.all([
    db
      .select({
        period: comprehensiveResults.period,
        candidates: countDistinct(comprehensiveResults.candidateNumber),
      })
      .from(comprehensiveResults)
      .where(
        and(
          eq(comprehensiveResults.tenantId, tenant.tenantId),
          eq(comprehensiveResults.examType, examType),
          isNotNull(comprehensiveResults.period)
        )
      )
      .groupBy(comprehensiveResults.period),
    db
      .select({
        period: summaryResults.period,
        candidates: countDistinct(summaryResults.candidateNumber),
      })
      .from(summaryResults)
      .where(
        and(
          eq(summaryResults.tenantId, tenant.tenantId),
          eq(summaryResults.examType, examType),
          isNotNull(summaryResults.period)
        )
      )
      .groupBy(summaryResults.period),
  ]);

  // Merge: take the max candidate count per period across both tables
  const candidatesByPeriod = new Map<string, number>();
  for (const r of [...compPeriods, ...sumPeriods]) {
    if (!r.period) continue;
    const key = r.period as string;
    const existing = candidatesByPeriod.get(key) ?? 0;
    candidatesByPeriod.set(key, Math.max(existing, Number(r.candidates)));
  }

  const periods = Array.from(candidatesByPeriod.entries())
    .filter(([p]) => Boolean(p))
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([p, candidates]) => ({ period: p, label: formatPeriod(p), candidates }));

  return c.json({ periods });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/t/:tenantSlug/analytics/students?q=...&examType=IGCSE&year=2024
// Full-text candidate search across name + candidate number.
// ─────────────────────────────────────────────────────────────────────────────
analyticsRouter.get('/students', async (c) => {
  const tenant = c.get('tenant')!;
  const q = (c.req.query('q') ?? '').trim();
  const examType = parseExamType(c.req.query('examType') ?? 'igcse');
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;

  if (q.length < 2) return c.json({ candidates: [] });

  const searchPat = `%${q}%`;
  const baseCompCond = [
    eq(comprehensiveResults.tenantId, tenant.tenantId),
    eq(comprehensiveResults.examType, examType),
    or(
      ilike(comprehensiveResults.candidateName, searchPat),
      ilike(comprehensiveResults.candidateNumber, searchPat)
    )!,
  ];
  const baseSumCond = [
    eq(summaryResults.tenantId, tenant.tenantId),
    eq(summaryResults.examType, examType),
    or(
      ilike(summaryResults.candidateName, searchPat),
      ilike(summaryResults.candidateNumber, searchPat)
    )!,
  ];
  if (year) {
    baseCompCond.push(sql`EXTRACT(YEAR FROM ${comprehensiveResults.period}) = ${year}`);
    baseSumCond.push(sql`EXTRACT(YEAR FROM ${summaryResults.period}) = ${year}`);
  }

  const [compRows, sumRows] = await Promise.all([
    db
      .select({
        candidateNumber: comprehensiveResults.candidateNumber,
        candidateName: comprehensiveResults.candidateName,
        subject: comprehensiveResults.syllabus,
        syllabusCode: comprehensiveResults.syllabus,
        grade: comprehensiveResults.syllabusGrade,
        period: comprehensiveResults.period,
      })
      .from(comprehensiveResults)
      .where(and(...baseCompCond))
      .limit(500),
    db
      .select({
        candidateNumber: summaryResults.candidateNumber,
        candidateName: summaryResults.candidateName,
        subject: summaryResults.subject,
        syllabusCode: summaryResults.syllabusCode,
        grade: summaryResults.grade,
        period: summaryResults.period,
      })
      .from(summaryResults)
      .where(and(...baseSumCond))
      .limit(500),
  ]);

  // Group by candidate
  const byCandidate = new Map<
    string,
    {
      candidateNumber: string;
      name: string;
      subjects: { subject: string; syllabusCode: string | null; grade: string; period: string | null }[];
    }
  >();

  for (const r of [...compRows.filter((r) => r.grade), ...sumRows]) {
    const key = `${r.candidateNumber}::${r.candidateName}`;
    const cur = byCandidate.get(key) ?? {
      candidateNumber: r.candidateNumber,
      name: r.candidateName,
      subjects: [],
    };
    cur.subjects.push({
      subject: r.subject,
      syllabusCode: r.syllabusCode,
      grade: r.grade as string,
      period: r.period as string | null,
    });
    byCandidate.set(key, cur);
  }

  const candidates = Array.from(byCandidate.values())
    .map((c) => {
      const aStars = c.subjects.filter((s) => s.grade === 'A*').length;
      const weighted = c.subjects.reduce((sum, s) => sum + (GRADE_WEIGHT[s.grade] ?? 0), 0);
      const passedC = c.subjects.filter((s) => PASS_GRADES_C.has(s.grade)).length;
      return {
        ...c,
        aStars,
        weighted,
        passRateC: c.subjects.length > 0 ? Math.round((passedC / c.subjects.length) * 100) : 0,
        // sort subjects by period desc, then subject name
        subjects: c.subjects.sort((a, b) => {
          if (a.period && b.period) return b.period.localeCompare(a.period);
          return a.subject.localeCompare(b.subject);
        }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = candidates.length;
  const limited = candidates.slice(0, 100);

  return c.json({ candidates: limited, total, examType, q });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/t/:tenantSlug/analytics/teachers?examType=IGCSE&year=2024
// Cross-references teacher subject assignments with result data.
// ─────────────────────────────────────────────────────────────────────────────
analyticsRouter.get('/teachers', async (c) => {
  const tenant = c.get('tenant')!;
  const examType = parseExamType(c.req.query('examType') ?? 'igcse');
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;

  const [teacherRows, subjectRows, rows] = await Promise.all([
    db.select().from(teachers).where(eq(teachers.tenantId, tenant.tenantId)),
    db
      .select()
      .from(teacherSubjects)
      .where(
        and(eq(teacherSubjects.tenantId, tenant.tenantId), eq(teacherSubjects.examType, examType))
      ),
    fetchGrades({ tenantId: tenant.tenantId, examType, year }),
  ]);

  // Build syllabus-code → grade rows map
  const byCode = new Map<string, { grade: string }[]>();
  for (const r of rows) {
    const code = r.syllabusCode ?? r.subject;
    if (!code) continue;
    const cur = byCode.get(code) ?? [];
    cur.push({ grade: r.grade });
    byCode.set(code, cur);
  }

  // Build teacher → subjects
  const subjectsByTeacher = new Map<string, typeof subjectRows>();
  for (const s of subjectRows) {
    const cur = subjectsByTeacher.get(s.teacherId) ?? [];
    cur.push(s);
    subjectsByTeacher.set(s.teacherId, cur);
  }

  const result = teacherRows
    .map((t) => {
      const assignedSubjects = subjectsByTeacher.get(t.id) ?? [];
      const subjectStats = assignedSubjects.map((s) => {
        const grades = byCode.get(s.syllabusCode) ?? [];
        return {
          syllabusCode: s.syllabusCode,
          students: grades.length,
          passRateAA: passRate(grades, PASS_GRADES_AA),
          passRateC: passRate(grades, PASS_GRADES_C),
          isPrimary: s.isPrimaryTeacher,
        };
      });
      return {
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        department: t.department,
        position: t.position,
        subjects: subjectStats,
        totalStudents: subjectStats.reduce((sum, s) => sum + s.students, 0),
      };
    })
    .filter((t) => t.subjects.length > 0)
    .sort((a, b) => b.totalStudents - a.totalStudents);

  return c.json({ teachers: result, examType, year });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/t/:tenantSlug/analytics/:examType?year=2024&period=2024-06-01
// Full analytics dashboard payload.
// ─────────────────────────────────────────────────────────────────────────────
analyticsRouter.get('/:examType', async (c) => {
  const tenant = c.get('tenant')!;
  const examType = parseExamType(c.req.param('examType'));
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;
  const period = c.req.query('period') ?? undefined;

  const rows = await fetchGrades({ tenantId: tenant.tenantId, examType, year, period });

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
    const p = r.period ?? 'unknown';
    const cur = byPeriod.get(p) ?? { period: p, rows: [] };
    cur.rows.push({ grade: r.grade });
    byPeriod.set(p, cur);
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
    period,
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

// ─── PROMOTION ELIGIBILITY ─────────────────────────────
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

  const results = [];
  for (const [key, cand] of byCandidate.entries()) {
    const passed = cand.grades.filter((g) => PASSING_GRADES.has(g.grade));
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
      candidateName: cand.name,
      totalSubjects: cand.grades.length,
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
