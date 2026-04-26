import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db } from '../db/index.js';
import { sendMagicLinkEmail } from './email.js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const API_URL = process.env.API_URL ?? 'http://localhost:8787';
const MARKETING_URL = process.env.MARKETING_URL ?? 'http://localhost:4322';

// Allow auth requests to come from the app, the marketing site, and
// (in dev) localhost ports for both. De-dupes any overlap.
const trustedOrigins = Array.from(
  new Set([APP_URL, MARKETING_URL, 'http://localhost:5173', 'http://localhost:4322'])
);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  baseURL: API_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  account: {
    // Allow a Google sign-in to attach to an existing user with the same
    // verified email — needed so that pre-seeded super-admin records (set
    // up before first sign-in) are linked to instead of being shadowed by
    // a fresh user record on first OAuth flow.
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
      expiresIn: 60 * 15, // 15 minutes
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min
    },
  },
  advanced: {
    // Allow the session cookie set by api.acumen.40analytics.com to be
    // visible from app.acumen.40analytics.com (and the marketing host).
    // In dev this is undefined → cookie scopes to localhost.
    crossSubDomainCookies: process.env.COOKIE_DOMAIN
      ? {
          enabled: true,
          domain: process.env.COOKIE_DOMAIN,
        }
      : undefined,
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
