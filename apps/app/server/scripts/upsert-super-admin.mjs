import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const email = 'mawuli@40analytics.com';
const name = 'Mawuli (40 Analytics)';
// Stable preset ID so we can identify the seeded row later if needed.
// Better Auth tolerates any text PK; account-linking by email merges this
// when the user signs in via Google.
const id = 'preset_super_admin_mawuli_40analytics';

const pool = new Pool({ connectionString: url });

const result = await pool.query(
  `
  INSERT INTO users (id, email, name, email_verified, is_super_admin, created_at, updated_at)
  VALUES ($1, $2, $3, true, true, now(), now())
  ON CONFLICT (email) DO UPDATE
    SET is_super_admin = true,
        updated_at = now()
  RETURNING id, email, name, is_super_admin, created_at;
  `,
  [id, email, name]
);

console.log('✓ Super admin upserted:');
console.log(JSON.stringify(result.rows[0], null, 2));

await pool.end();
