import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws as any;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema, casing: 'snake_case' });
export type Db = typeof db;
export { schema };
