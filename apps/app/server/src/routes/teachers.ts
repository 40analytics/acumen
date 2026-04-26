import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { teachers, teacherSubjects } from '../db/schema.js';
import { type AppEnv } from '../middleware/auth.js';
import { requireRole } from '../lib/tenant.js';

export const teachersRouter = new Hono<AppEnv>();

const teacherSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  employeeId: z.string().max(40).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  position: z.string().max(80).optional().nullable(),
  dateJoined: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const subjectSchema = z.object({
  syllabusCode: z.string().min(1),
  examType: z.enum(['IGCSE', 'A Level']),
  isPrimaryTeacher: z.boolean().default(false),
});

teachersRouter.get('/', async (c) => {
  const tenant = c.get('tenant')!;
  const rows = await db
    .select()
    .from(teachers)
    .where(eq(teachers.tenantId, tenant.tenantId))
    .orderBy(desc(teachers.createdAt));

  // Pull subject assignments for all teachers
  const allSubjects = await db
    .select()
    .from(teacherSubjects)
    .where(eq(teacherSubjects.tenantId, tenant.tenantId));
  const byTeacher = new Map<string, typeof allSubjects>();
  for (const s of allSubjects) {
    const cur = byTeacher.get(s.teacherId) ?? [];
    cur.push(s);
    byTeacher.set(s.teacherId, cur);
  }

  return c.json({
    teachers: rows.map((t) => ({ ...t, subjects: byTeacher.get(t.id) ?? [] })),
  });
});

teachersRouter.post('/', zValidator('json', teacherSchema), async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const input = c.req.valid('json');
  const [created] = await db
    .insert(teachers)
    .values({
      tenantId: tenant.tenantId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      employeeId: input.employeeId ?? null,
      department: input.department ?? null,
      position: input.position ?? null,
      dateJoined: input.dateJoined ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return c.json({ teacher: created }, 201);
});

teachersRouter.patch('/:id', zValidator('json', teacherSchema.partial()), async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const [updated] = await db
    .update(teachers)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenant.tenantId)))
    .returning();
  if (!updated) return c.json({ error: 'Teacher not found' }, 404);
  return c.json({ teacher: updated });
});

teachersRouter.delete('/:id', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const id = c.req.param('id');
  await db
    .delete(teachers)
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenant.tenantId)));
  return c.json({ ok: true });
});

teachersRouter.post('/:id/subjects', zValidator('json', subjectSchema), async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  const teacherId = c.req.param('id');
  const input = c.req.valid('json');
  const [created] = await db
    .insert(teacherSubjects)
    .values({
      tenantId: tenant.tenantId,
      teacherId,
      syllabusCode: input.syllabusCode,
      examType: input.examType,
      isPrimaryTeacher: input.isPrimaryTeacher,
    })
    .returning();
  return c.json({ subject: created }, 201);
});

teachersRouter.delete('/:id/subjects/:subjectId', async (c) => {
  const tenant = c.get('tenant')!;
  requireRole(tenant, 'admin');
  await db
    .delete(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.id, c.req.param('subjectId')),
        eq(teacherSubjects.teacherId, c.req.param('id')),
        eq(teacherSubjects.tenantId, tenant.tenantId)
      )
    );
  return c.json({ ok: true });
});
