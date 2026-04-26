import * as XLSX from 'xlsx';
import type { ExamType } from '@acumen/shared';

export type FileFormat = 'comprehensive' | 'summary';

export interface ParsedComprehensiveRow {
  syllabus: string;
  optionCode: string | null;
  centreNumber: string | null;
  candidateNumber: string;
  candidateName: string;
  componentData: Record<string, Record<string, number | string>>;
  finalMarks: Record<string, number>;
  syllabusTotal: number | null;
  syllabusGrade: string | null;
  sheetName: string;
  rawData: Record<string, unknown>;
}

export interface ParsedSummaryRow {
  candidateNumber: string;
  candidateName: string;
  subject: string;
  syllabusCode: string | null;
  grade: string;
  qualification: string;
}

export interface ParseResult {
  format: FileFormat;
  examType: ExamType;
  comprehensive: ParsedComprehensiveRow[];
  summary: ParsedSummaryRow[];
  rowsTotal: number;
  warnings: string[];
}

/**
 * Common Cambridge subject name → syllabus code mapping.
 * Schools can override per-tenant via syllabus_nomenclature table.
 */
const SUBJECT_TO_CODE: Record<string, string> = {
  'biology': '9700',
  'chemistry': '9701',
  'physics': '9702',
  'mathematics': '9709',
  'further mathematics': '9231',
  'english language': '9093',
  'english literature': '9695',
  'economics': '9708',
  'business': '9609',
  'business studies': '9609',
  'accounting': '9706',
  'computer science': '9608',
  'computing': '9608',
  'geography': '9696',
  'history': '9489',
  'psychology': '9990',
  'sociology': '9699',
  'art & design': '9479',
  'music': '9483',
  // IGCSE codes
  'mathematics igcse': '0580',
  'english language igcse': '0500',
  'english literature igcse': '0475',
  'biology igcse': '0610',
  'chemistry igcse': '0620',
  'physics igcse': '0625',
  'combined science': '0653',
  'co-ordinated sciences': '0654',
  'french': '0520',
  'spanish': '0530',
  'german': '0525',
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s&]/g, '');
}

function mapSubjectToCode(subjectName: string): string | null {
  const norm = normalizeName(subjectName);
  if (SUBJECT_TO_CODE[norm]) return SUBJECT_TO_CODE[norm];
  // Try without "(0X)" or other suffixes
  const stripped = norm.replace(/\s*\(.*\)\s*/g, '').trim();
  if (SUBJECT_TO_CODE[stripped]) return SUBJECT_TO_CODE[stripped];
  return null;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Detect file format by inspecting the first sheet's structure.
 */
function detectFormat(workbook: XLSX.WorkBook): FileFormat {
  const sheets = workbook.SheetNames.filter((n) => !/guide|info|cover/i.test(n));
  if (sheets.length === 0) return 'summary';

  // Comprehensive files have many sheets, one per syllabus, each with
  // "Component" headers. Summary files are typically a single sheet
  // with candidate names down the left and subjects across the top.
  if (sheets.length > 2) return 'comprehensive';

  // Single sheet — look for "Component" in the first 6 rows
  const firstSheet = workbook.Sheets[sheets[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const flat = rows[i].map((c) => asString(c).toLowerCase()).join(' ');
    if (/component\s*\d/.test(flat)) return 'comprehensive';
  }
  return 'summary';
}

/**
 * Find the header row index by looking for "Cand. No" or "Candidate No"
 */
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const flat = rows[i].map((c) => asString(c).toLowerCase()).join(' ');
    if (/cand(idate|\.)\s*(no|number)/.test(flat)) return i;
  }
  return -1;
}

/**
 * Parse a single comprehensive sheet (one syllabus per sheet).
 */
function parseComprehensiveSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet
): ParsedComprehensiveRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  if (rows.length < 4) return [];

  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx < 0) return [];

  const headerRow = rows[headerRowIdx].map((c) => asString(c));
  const subHeaderRow =
    rows[headerRowIdx + 1] && rows[headerRowIdx + 1].length > 0
      ? rows[headerRowIdx + 1].map((c) => asString(c))
      : [];

  // Find column indices
  const candNoIdx = headerRow.findIndex((h) => /cand(idate|\.)\s*(no|number)/i.test(h));
  const candNameIdx = headerRow.findIndex((h) => /cand(idate)?\s*name/i.test(h));
  const centreIdx = headerRow.findIndex((h) => /centre/i.test(h));
  const optionIdx = headerRow.findIndex((h) => /^option/i.test(h));
  const sylTotalIdx = headerRow.findIndex((h) => /syllabus\s*(total|mark)/i.test(h));
  const sylGradeIdx = headerRow.findIndex((h) => /syllabus\s*grade/i.test(h) || /^grade$/i.test(h));

  // Build component column map: { "01": { "Raw mark": 12, "Adjusted": 5, "Final": 14 } }
  // Component columns look like "Component 01" / "Component 02" possibly merged across sub-headers
  const componentCols: { compCode: string; field: string; col: number }[] = [];
  let currentComp: string | null = null;
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    const sub = subHeaderRow[c] ?? '';
    const compMatch = h.match(/component\s*0?(\d+)/i);
    if (compMatch) {
      currentComp = compMatch[1].padStart(2, '0');
    }
    if (currentComp && sub) {
      componentCols.push({ compCode: currentComp, field: sub.trim(), col: c });
    }
  }

  // Parse data starting from row after sub-header (or header+1 if no sub-header)
  const dataStart = subHeaderRow.length > 0 ? headerRowIdx + 2 : headerRowIdx + 1;
  const out: ParsedComprehensiveRow[] = [];

  // Sheet name often contains the syllabus code (e.g., "9700 Bio")
  const sheetSyllabusMatch = sheetName.match(/(\d{4})/);
  const fallbackSyllabus = sheetSyllabusMatch ? sheetSyllabusMatch[1] : sheetName.trim();

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const candidateNumber = candNoIdx >= 0 ? asString(row[candNoIdx]) : '';
    const candidateName = candNameIdx >= 0 ? asString(row[candNameIdx]) : '';
    if (!candidateNumber || !candidateName) continue;

    const componentData: Record<string, Record<string, number | string>> = {};
    const finalMarks: Record<string, number> = {};

    for (const col of componentCols) {
      const value = row[col.col];
      if (value === undefined || value === null || value === '') continue;
      componentData[col.compCode] = componentData[col.compCode] ?? {};
      const num = asNumber(value);
      componentData[col.compCode][col.field] = num ?? asString(value);
      if (num !== null && /final|mark/i.test(col.field) && !/raw|adjust/i.test(col.field)) {
        finalMarks[col.compCode] = num;
      }
    }

    out.push({
      syllabus: fallbackSyllabus,
      optionCode: optionIdx >= 0 ? asString(row[optionIdx]) || null : null,
      centreNumber: centreIdx >= 0 ? asString(row[centreIdx]) || null : null,
      candidateNumber,
      candidateName,
      componentData,
      finalMarks,
      syllabusTotal: sylTotalIdx >= 0 ? asNumber(row[sylTotalIdx]) : null,
      syllabusGrade: sylGradeIdx >= 0 ? (asString(row[sylGradeIdx]) || null) : null,
      sheetName,
      rawData: { row, headers: headerRow },
    });
  }

  return out;
}

/**
 * Parse a summary file: single sheet, candidate names down + subjects across.
 * Each cell is a grade (A*, A, B, C, D, E, F, G, U).
 */
function parseSummary(workbook: XLSX.WorkBook, qualHint: string): ParsedSummaryRow[] {
  const sheets = workbook.SheetNames.filter((n) => !/guide|info|cover/i.test(n));
  if (sheets.length === 0) return [];
  const sheet = workbook.Sheets[sheets[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  if (rows.length === 0) return [];

  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) return [];

  const headerRow = rows[headerIdx].map((c) => asString(c));
  const candNoIdx = headerRow.findIndex((h) => /cand(idate|\.)\s*(no|number)/i.test(h));
  const candNameIdx = headerRow.findIndex((h) => /cand(idate)?\s*name|name/i.test(h));
  const subjectStartIdx = Math.max(candNoIdx, candNameIdx) + 1;

  const subjects = headerRow.slice(subjectStartIdx).filter((s) => s);
  const out: ParsedSummaryRow[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const candidateNumber = candNoIdx >= 0 ? asString(row[candNoIdx]) : '';
    const candidateName = candNameIdx >= 0 ? asString(row[candNameIdx]) : '';
    if (!candidateNumber || !candidateName) continue;

    for (let s = 0; s < subjects.length; s++) {
      const subject = subjects[s];
      const grade = asString(row[subjectStartIdx + s]).toUpperCase();
      if (!grade || grade === '-' || grade === 'N/A') continue;
      out.push({
        candidateNumber,
        candidateName,
        subject,
        syllabusCode: mapSubjectToCode(subject),
        grade,
        qualification: qualHint,
      });
    }
  }

  return out;
}

/**
 * Main entry point. Parse a Cambridge Excel buffer, returning a structured
 * result that the upload pipeline can write to the DB.
 */
export function parseCambridgeFile(buffer: Buffer, examType: ExamType): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const format = detectFormat(workbook);
  const warnings: string[] = [];

  if (format === 'comprehensive') {
    const comprehensive: ParsedComprehensiveRow[] = [];
    const sheetsToProcess = workbook.SheetNames.filter(
      (n) => !/guide|info|cover/i.test(n)
    );
    for (const name of sheetsToProcess) {
      try {
        const rows = parseComprehensiveSheet(name, workbook.Sheets[name]);
        comprehensive.push(...rows);
      } catch (err: any) {
        warnings.push(`Sheet "${name}" could not be parsed: ${err?.message ?? err}`);
      }
    }
    return {
      format,
      examType,
      comprehensive,
      summary: [],
      rowsTotal: comprehensive.length,
      warnings,
    };
  }

  // Summary
  const summary = parseSummary(workbook, examType);
  return { format, examType, comprehensive: [], summary, rowsTotal: summary.length, warnings };
}

/**
 * Convert a month name to a numeric date (the 1st of that month).
 * Used to normalize exam periods for time-series queries.
 */
export function monthYearToPeriod(month: string, year: number): Date {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const idx = months.indexOf(month.toLowerCase());
  if (idx < 0) return new Date(year, 0, 1);
  return new Date(year, idx, 1);
}
