// One-off: apply a SQL file to a Postgres URL.
// Usage: DATABASE_URL=... node scripts/apply-sql.mjs path/to/file.sql
import fs from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const url = process.env.DATABASE_URL;
const sqlFile = process.argv[2];
if (!url || !sqlFile) {
  console.error('Usage: DATABASE_URL=... node scripts/apply-sql.mjs <file.sql>');
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, 'utf8');
// Drizzle splits with --> statement-breakpoint
const statements = sql
  .split(/-->\s*statement-breakpoint/i)
  .map((s) => s.trim())
  .filter(Boolean);

const pool = new Pool({ connectionString: url });

let applied = 0;
let skipped = 0;
let failed = 0;

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    applied++;
  } catch (err) {
    const msg = err.message ?? String(err);
    if (/already exists/i.test(msg)) {
      skipped++;
    } else {
      failed++;
      console.error(`✗ Failed: ${msg.split('\n')[0]}`);
      console.error(`  ${stmt.slice(0, 100).replace(/\n/g, ' ')}…`);
    }
  }
}

await pool.end();
console.log(`\nApplied: ${applied}  Skipped (already existed): ${skipped}  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
