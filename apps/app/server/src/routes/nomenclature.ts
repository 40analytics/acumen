import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { syllabusNomenclature, componentsNomenclature } from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import { requireRole } from '../lib/tenant.js';

export const nomenclatureRouter = new Hono<AppEnv>();

const syllabusSchema = z.object({
  syllabusCode: z.string().min(1).max(20),
  syllabusName: z.string().min(1).max(120),
});

const componentSchema = z.object({
  syllabusCode: z.string().min(1).max(20),
  syllabusName: z.string().max(120).optional().nullable(),
  componentCode: z.string().min(1).max(20),
  componentName: z.string().min(1).max(120),
});

// ── Syllabus nomenclature ──
nomenclatureRouter.get('/syllabus', async (c) => {
  const tenant = c.get('tenant')!;
  const rows = await db
    .select()
    .from(syllabusNomenclature)
    .where(eq(syllabusNomenclature.tenantId, tenant.tenantId))
    .orderBy(asc(syllabusNomenclature.syllabusCode));
  return c.json({ entries: rows });
});

nomenclatureRouter.post('/syllabus', zValidator('json', syllabusSchema), async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const input = c.req.valid('json');
  const [created] = await db
    .insert(syllabusNomenclature)
    .values({ tenantId: tenant.tenantId, ...input })
    .onConflictDoUpdate({
      target: [syllabusNomenclature.tenantId, syllabusNomenclature.syllabusCode],
      set: { syllabusName: input.syllabusName },
    })
    .returning();
  return c.json({ entry: created }, 201);
});

nomenclatureRouter.delete('/syllabus/:id', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  await db
    .delete(syllabusNomenclature)
    .where(
      and(
        eq(syllabusNomenclature.id, c.req.param('id')),
        eq(syllabusNomenclature.tenantId, tenant.tenantId)
      )
    );
  return c.json({ ok: true });
});

// ── Syllabus bulk import ──
const bulkImportSchema = z.object({
  entries: z
    .array(
      z.object({
        syllabusCode: z.string().min(1).max(20),
        syllabusName: z.string().min(1).max(120),
      })
    )
    .min(1)
    .max(500),
});

nomenclatureRouter.post(
  '/syllabus/bulk',
  zValidator('json', bulkImportSchema),
  async (c) => {
    const tenant = c.get('tenant')!;
    requireRole(tenant, 'admin');
    const { entries } = c.req.valid('json');

    await db
      .insert(syllabusNomenclature)
      .values(entries.map((e) => ({ tenantId: tenant.tenantId, ...e })))
      .onConflictDoUpdate({
        target: [syllabusNomenclature.tenantId, syllabusNomenclature.syllabusCode],
        set: { syllabusName: sql`EXCLUDED.syllabus_name` },
      });

    return c.json({ imported: entries.length });
  }
);

// ── Component nomenclature ──
nomenclatureRouter.get('/components', async (c) => {
  const tenant = c.get('tenant')!;
  const rows = await db
    .select()
    .from(componentsNomenclature)
    .where(eq(componentsNomenclature.tenantId, tenant.tenantId))
    .orderBy(asc(componentsNomenclature.syllabusCode), asc(componentsNomenclature.componentCode));
  return c.json({ entries: rows });
});

nomenclatureRouter.post('/components', zValidator('json', componentSchema), async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const input = c.req.valid('json');
  const [created] = await db
    .insert(componentsNomenclature)
    .values({
      tenantId: tenant.tenantId,
      syllabusCode: input.syllabusCode,
      syllabusName: input.syllabusName ?? null,
      componentCode: input.componentCode,
      componentName: input.componentName,
    })
    .onConflictDoUpdate({
      target: [
        componentsNomenclature.tenantId,
        componentsNomenclature.syllabusCode,
        componentsNomenclature.componentCode,
      ],
      set: { componentName: input.componentName, syllabusName: input.syllabusName ?? null },
    })
    .returning();
  return c.json({ entry: created }, 201);
});

nomenclatureRouter.delete('/components/:id', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  await db
    .delete(componentsNomenclature)
    .where(
      and(
        eq(componentsNomenclature.id, c.req.param('id')),
        eq(componentsNomenclature.tenantId, tenant.tenantId)
      )
    );
  return c.json({ ok: true });
});
