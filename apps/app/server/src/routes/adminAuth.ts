import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  validateAdminCredentials,
  buildAdminCookie,
  clearAdminCookie,
  getAdminPayload,
  ADMIN_EMAIL,
} from '../middleware/adminAuth.js';

export const adminAuthRouter = new Hono();

// ─── POST /api/admin/auth/login ──────────────────────────
adminAuthRouter.post(
  '/login',
  zValidator('json', z.object({ username: z.string().min(1), password: z.string().min(1) })),
  async (c) => {
    const { username, password } = c.req.valid('json');
    if (!validateAdminCredentials(username, password)) {
      // Fixed-cost delay to mitigate brute-force
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    c.header('Set-Cookie', buildAdminCookie());
    return c.json({ ok: true, email: ADMIN_EMAIL });
  }
);

// ─── GET /api/admin/auth/me ──────────────────────────────
adminAuthRouter.get('/me', (c) => {
  const payload = getAdminPayload(c.req.header('Cookie') ?? '');
  if (!payload) return c.json({ error: 'Not authenticated' }, 401);
  return c.json({ username: payload.sub, email: payload.email });
});

// ─── POST /api/admin/auth/logout ────────────────────────
adminAuthRouter.post('/logout', (c) => {
  c.header('Set-Cookie', clearAdminCookie());
  return c.json({ ok: true });
});
