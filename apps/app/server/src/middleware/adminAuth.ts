import type { MiddlewareHandler } from 'hono';
import { timingSafeEqual, createHmac, randomBytes } from 'crypto';

// ─── Config ─────────────────────────────────────────────
const COOKIE_NAME = 'acumen_admin';
const SECRET = process.env.ADMIN_JWT_SECRET ?? 'dev-admin-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Token helpers ───────────────────────────────────────
function b64url(s: string) {
  return Buffer.from(s).toString('base64url');
}
function sign(payload: object): string {
  const data = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function unsign(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SECRET).update(data).digest('base64url');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }
}

// ─── Cookie helpers ──────────────────────────────────────
function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(';').map((p) => {
      const eq = p.indexOf('=');
      return [p.slice(0, eq).trim(), decodeURIComponent(p.slice(eq + 1).trim())];
    })
  );
}

const COOKIE_OPTS = [
  `HttpOnly`,
  `SameSite=Lax`,
  IS_PROD ? `Secure` : '',
  `Path=/`,
  `Max-Age=${60 * 60 * 24}`, // 24 h
].filter(Boolean).join('; ');

// ─── Public API ──────────────────────────────────────────

/** Validate ADMIN_USERNAME / ADMIN_PASSWORD from env vars. */
export function validateAdminCredentials(username: string, password: string): boolean {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return false;
  const uOk = timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USERNAME));
  const pOk = timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));
  return uOk && pOk;
}

/** Build the Set-Cookie header that grants admin access. */
export function buildAdminCookie(): string {
  const tok = sign({
    sub: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    jti: randomBytes(8).toString('hex'),
  });
  return `${COOKIE_NAME}=${encodeURIComponent(tok)}; ${COOKIE_OPTS}`;
}

/** Build the Set-Cookie header that clears the admin session. */
export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export interface AdminPayload {
  sub: string;   // username
  email: string;
}

/** Extract + verify the admin token from a Cookie header. */
export function getAdminPayload(cookieHeader: string): AdminPayload | null {
  const tok = parseCookies(cookieHeader)[COOKIE_NAME];
  if (!tok) return null;
  const payload = unsign(decodeURIComponent(tok)) as (AdminPayload & { exp: number }) | null;
  if (!payload) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Hono middleware — blocks the request with 401 unless a valid admin cookie is present. */
export const requireAdminToken: MiddlewareHandler = async (c, next) => {
  const cookie = c.req.header('Cookie') ?? '';
  const payload = getAdminPayload(cookie);
  if (!payload) {
    return c.json({ error: 'Admin authentication required', code: 'ADMIN_UNAUTHENTICATED' }, 401);
  }
  // Expose payload for downstream handlers
  (c as any).set('adminPayload', payload);
  await next();
};
