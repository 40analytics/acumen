import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  uploads,
  comprehensiveResults,
  summaryResults,
  creditBalances,
  creditTransactions,
} from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import { parseCambridgeFile, monthYearToPeriod, type FileFormat } from '../lib/parser.js';
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES, type ExamType } from '@acumen/shared';

export const uploadsRouter = new Hono<AppEnv>();

/**
 * POST /api/t/:tenantSlug/uploads
 * Multipart: file, examType, month, year
 * Atomically: deduct 1 credit → parse → store rows → finalize.
 * If parse fails, the credit deduction is rolled back.
 */
uploadsRouter.post('/', async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');

  const body = await c.req.parseBody();
  const file = body['file'] as File | undefined;
  const examType = (body['examType'] as ExamType) ?? 'IGCSE';
  const month = (body['month'] as string) ?? '';
  const year = parseInt((body['year'] as string) ?? '', 10);

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }
  if (!month || !year || isNaN(year)) {
    return c.json({ error: 'Month and year are required' }, 400);
  }
  if (!['IGCSE', 'A Level'].includes(examType)) {
    return c.json({ error: 'Invalid exam type' }, 400);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return c.json({ error: 'File exceeds 10MB' }, 400);
  }
  const ext = (file.name.toLowerCase().match(/\.[a-z]+$/)?.[0] ?? '') as
    | (typeof ALLOWED_UPLOAD_EXTENSIONS)[number]
    | '';
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext as any)) {
    return c.json({ error: 'Only .xlsx and .xls files are supported' }, 400);
  }

  // Credits are held at org level
  if (!tenant.orgId) {
    return c.json({ error: 'Workspace has no organisation — contact support.' }, 400);
  }

  // Check org balance up-front
  const balance = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.orgId, tenant.orgId),
  });
  if (!balance || balance.balance < 1) {
    return c.json(
      { error: 'No upload credits remaining. Please top up.', code: 'INSUFFICIENT_CREDITS' },
      402
    );
  }

  // Parse the file (do this BEFORE charging credits so we don't charge on bad files)
  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseCambridgeFile(buffer, examType);
  } catch (err: any) {
    return c.json(
      { error: `Could not parse file: ${err?.message ?? 'Unknown error'}` },
      400
    );
  }

  if (parsed.rowsTotal === 0) {
    return c.json(
      { error: 'No rows could be parsed from this file. Check the format.' },
      400
    );
  }

  const period = monthYearToPeriod(month, year);

  // Atomic: deduct credit, insert upload, insert all rows
  const result = await db.transaction(async (tx) => {
    // Lock & deduct from org balance
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} - 1`,
        lifetimeSpent: sql`${creditBalances.lifetimeSpent} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(creditBalances.orgId, tenant.orgId!), sql`${creditBalances.balance} >= 1`)
      )
      .returning({ balance: creditBalances.balance });
    if (!updated) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    // Insert the upload row
    const [upload] = await tx
      .insert(uploads)
      .values({
        tenantId: tenant.tenantId,
        uploadedById: user.id,
        examType,
        month,
        year,
        fileName: file.name,
        fileSize: file.size,
        fileFormat: parsed.format,
        status: 'processed',
        recordCount: parsed.rowsTotal,
        creditsCharged: 1,
        period: period.toISOString().slice(0, 10),
        processedAt: new Date(),
      })
      .returning();

    // Log the credit transaction against the org (with workspace context)
    const [txn] = await tx
      .insert(creditTransactions)
      .values({
        orgId: tenant.orgId,
        tenantId: tenant.tenantId,
        type: 'upload',
        amount: -1,
        balanceAfter: updated.balance,
        uploadId: upload.id,
        actorUserId: user.id,
        note: `Upload: ${file.name}`,
      })
      .returning();

    await tx
      .update(uploads)
      .set({ creditTransactionId: txn.id })
      .where(eq(uploads.id, upload.id));

    // Insert parsed rows in batches
    const periodIso = period.toISOString().slice(0, 10);
    if (parsed.format === 'comprehensive' && parsed.comprehensive.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < parsed.comprehensive.length; i += chunkSize) {
        const chunk = parsed.comprehensive.slice(i, i + chunkSize);
        await tx.insert(comprehensiveResults).values(
          chunk.map((r) => ({
            tenantId: tenant.tenantId,
            uploadId: upload.id,
            syllabus: r.syllabus,
            optionCode: r.optionCode,
            centreNumber: r.centreNumber,
            candidateNumber: r.candidateNumber,
            candidateName: r.candidateName,
            componentData: r.componentData,
            finalMarks: r.finalMarks,
            syllabusTotal: r.syllabusTotal,
            syllabusGrade: r.syllabusGrade,
            sheetName: r.sheetName,
            period: periodIso,
            examType,
            rawData: r.rawData,
          }))
        );
      }
    } else if (parsed.format === 'summary' && parsed.summary.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < parsed.summary.length; i += chunkSize) {
        const chunk = parsed.summary.slice(i, i + chunkSize);
        await tx.insert(summaryResults).values(
          chunk.map((r) => ({
            tenantId: tenant.tenantId,
            uploadId: upload.id,
            candidateNumber: r.candidateNumber,
            candidateName: r.candidateName,
            subject: r.subject,
            syllabusCode: r.syllabusCode,
            grade: r.grade,
            qualification: r.qualification,
            examType,
            period: periodIso,
          }))
        );
      }
    }

    return { upload, balance: updated.balance };
  });

  return c.json({
    upload: result.upload,
    rowsParsed: parsed.rowsTotal,
    balanceAfter: result.balance,
    warnings: parsed.warnings,
    format: parsed.format as FileFormat,
  });
});

/**
 * GET /api/t/:tenantSlug/uploads — list uploads
 */
uploadsRouter.get('/', async (c) => {
  const tenant = c.get('tenant')!;
  const rows = await db
    .select()
    .from(uploads)
    .where(eq(uploads.tenantId, tenant.tenantId))
    .orderBy(desc(uploads.createdAt))
    .limit(50);
  return c.json({ uploads: rows });
});

/**
 * DELETE /api/t/:tenantSlug/uploads/:uploadId — delete an upload + cascade rows
 * Refunds the credit to the tenant.
 */
uploadsRouter.delete('/:uploadId', async (c) => {
  const tenant = c.get('tenant')!;
  const uploadId = c.req.param('uploadId');

  const upload = await db.query.uploads.findFirst({
    where: and(eq(uploads.id, uploadId), eq(uploads.tenantId, tenant.tenantId)),
  });
  if (!upload) return c.json({ error: 'Upload not found' }, 404);

  if (!tenant.orgId) return c.json({ error: 'Workspace has no organisation' }, 400);

  await db.transaction(async (tx) => {
    // Refund credit to org balance
    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${upload.creditsCharged}`,
        lifetimeSpent: sql`${creditBalances.lifetimeSpent} - ${upload.creditsCharged}`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.orgId, tenant.orgId!))
      .returning({ balance: creditBalances.balance });

    await tx.insert(creditTransactions).values({
      orgId: tenant.orgId,
      tenantId: tenant.tenantId,
      type: 'refund',
      amount: upload.creditsCharged,
      balanceAfter: updated.balance,
      uploadId: upload.id,
      actorUserId: c.get('user').id,
      note: `Refund: deleted upload ${upload.fileName}`,
    });

    // Cascade delete handles the result rows
    await tx.delete(uploads).where(eq(uploads.id, upload.id));
  });

  return c.json({ ok: true });
});
