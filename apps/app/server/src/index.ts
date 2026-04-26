import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './lib/auth.js';
import { meRouter } from './routes/me.js';
import { tenantsRouter } from './routes/tenants.js';
import { tenantRouter } from './routes/tenant.js';
import { orgsRouter } from './routes/orgs.js';
import { adminRouter } from './routes/admin.js';
import { adminAuthRouter } from './routes/adminAuth.js';
import { invitesRouter } from './routes/invites.js';
// NOTE: Paystack webhook intentionally NOT mounted — the Paystack account
// is shared across multiple Acumen-unrelated apps, so we cannot rely on
// webhook events being scoped to us. Verification happens via the active
// sweep in routes/billing.ts (auto-sweep on /balance + manual POST /sweep).
import type { AppEnv } from './middleware/auth.js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

const app = new Hono<AppEnv>();

app.use(logger());
app.use(
  '*',
  cors({
    origin: APP_URL,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// Better Auth handler — handles all /api/auth/* routes
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// API routes
app.route('/api/me', meRouter);
app.route('/api/tenants', tenantsRouter);
app.route('/api/t/:tenantSlug', tenantRouter);
app.route('/api/orgs', orgsRouter);
app.route('/api/admin/auth', adminAuthRouter);   // public — login/logout/me
app.route('/api/admin', adminRouter);             // protected — requireAdminToken
app.route('/api/invites', invitesRouter);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('[error]', err);
  return c.json({ error: err.message ?? 'Internal error' }, 500);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`◆ Acumen API ready on http://localhost:${info.port}`);
});
