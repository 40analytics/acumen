import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comprehensiveResults, summaryResults } from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import type { ExamType } from '@acumen/shared';

export const exportRouter = new Hono<AppEnv>();

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

/**
 * GET /api/t/:tenantSlug/export/results.csv?examType=IGCSE&year=2024
 * Streams a CSV of all results for the chosen filters.
 */
exportRouter.get('/results.csv', async (c) => {
  const tenant = c.get('tenant')!;
  const examType = (c.req.query('examType') as ExamType) ?? 'IGCSE';
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;

  const compConds = [
    eq(comprehensiveResults.tenantId, tenant.tenantId),
    eq(comprehensiveResults.examType, examType),
  ];
  const sumConds = [
    eq(summaryResults.tenantId, tenant.tenantId),
    eq(summaryResults.examType, examType),
  ];
  if (year) {
    compConds.push(sql`EXTRACT(YEAR FROM ${comprehensiveResults.period}) = ${year}`);
    sumConds.push(sql`EXTRACT(YEAR FROM ${summaryResults.period}) = ${year}`);
  }

  const compRows = await db
    .select({
      candidateNumber: comprehensiveResults.candidateNumber,
      candidateName: comprehensiveResults.candidateName,
      syllabus: comprehensiveResults.syllabus,
      grade: comprehensiveResults.syllabusGrade,
      total: comprehensiveResults.syllabusTotal,
      examType: comprehensiveResults.examType,
      period: comprehensiveResults.period,
    })
    .from(comprehensiveResults)
    .where(and(...compConds));

  const sumRows = await db
    .select({
      candidateNumber: summaryResults.candidateNumber,
      candidateName: summaryResults.candidateName,
      syllabus: summaryResults.subject,
      syllabusCode: summaryResults.syllabusCode,
      grade: summaryResults.grade,
      examType: summaryResults.examType,
      period: summaryResults.period,
    })
    .from(summaryResults)
    .where(and(...sumConds));

  const merged = [
    ...compRows.map((r) => ({
      candidateNumber: r.candidateNumber,
      candidateName: r.candidateName,
      subject: r.syllabus,
      syllabusCode: '',
      grade: r.grade ?? '',
      total: r.total ?? '',
      examType: r.examType,
      period: r.period ?? '',
    })),
    ...sumRows.map((r) => ({
      candidateNumber: r.candidateNumber,
      candidateName: r.candidateName,
      subject: r.syllabus,
      syllabusCode: r.syllabusCode ?? '',
      grade: r.grade,
      total: '',
      examType: r.examType,
      period: r.period ?? '',
    })),
  ];

  const headers = [
    'candidateNumber',
    'candidateName',
    'subject',
    'syllabusCode',
    'grade',
    'total',
    'examType',
    'period',
  ];
  const csv = rowsToCsv(merged, headers);

  const fileName = `acumen_${examType.replace(/\s+/g, '')}_${year ?? 'all'}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});

/**
 * GET /api/t/:tenantSlug/export/promotion.csv?year=2024 — promotion eligibility CSV
 */
exportRouter.get('/promotion.csv', async (c) => {
  const tenant = c.get('tenant')!;
  // Reuse the analytics route by hitting it directly through the DB the same way.
  // For simplicity we delegate by calling fetch within the same server isn't
  // available — duplicate the logic minimally.
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined;
  // Reuse comprehensive + summary as before.
  const compConds = [
    eq(comprehensiveResults.tenantId, tenant.tenantId),
    eq(comprehensiveResults.examType, 'IGCSE'),
  ];
  const sumConds = [
    eq(summaryResults.tenantId, tenant.tenantId),
    eq(summaryResults.examType, 'IGCSE'),
  ];
  if (year) {
    compConds.push(sql`EXTRACT(YEAR FROM ${comprehensiveResults.period}) = ${year}`);
    sumConds.push(sql`EXTRACT(YEAR FROM ${summaryResults.period}) = ${year}`);
  }
  const compRows = await db
    .select({
      candidateNumber: comprehensiveResults.candidateNumber,
      candidateName: comprehensiveResults.candidateName,
      subject: comprehensiveResults.syllabus,
      grade: comprehensiveResults.syllabusGrade,
    })
    .from(comprehensiveResults)
    .where(and(...compConds));
  const sumRows = await db
    .select({
      candidateNumber: summaryResults.candidateNumber,
      candidateName: summaryResults.candidateName,
      subject: summaryResults.subject,
      grade: summaryResults.grade,
    })
    .from(summaryResults)
    .where(and(...sumConds));

  const all = [
    ...compRows.filter((r) => r.grade).map((r) => ({ ...r, grade: r.grade as string })),
    ...sumRows,
  ];
  const byCandidate = new Map<string, { name: string; grades: string[] }>();
  for (const r of all) {
    const k = `${r.candidateNumber}::${r.candidateName}`;
    const cur = byCandidate.get(k) ?? { name: r.candidateName, grades: [] };
    cur.grades.push(r.grade);
    byCandidate.set(k, cur);
  }
  const PASS = new Set(['A*', 'A', 'B', 'C']);
  const out = Array.from(byCandidate.entries()).map(([k, v]) => {
    const passed = v.grades.filter((g) => PASS.has(g)).length;
    return {
      candidateNumber: k.split('::')[0],
      candidateName: v.name,
      subjects: v.grades.length,
      passed,
      eligible: passed >= 5,
    };
  });

  const csv = rowsToCsv(out as any, [
    'candidateNumber',
    'candidateName',
    'subjects',
    'passed',
    'eligible',
  ]);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="acumen_promotion_${year ?? 'all'}.csv"`,
    },
  });
});
