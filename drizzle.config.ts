// @MX:NOTE Drizzle Kit configuration. Reads DATABASE_URL from env and
// targets PostgreSQL 16 (per handoff §4 / §12). Schema location:
// lib/db/schema.ts (created in a later phase).

import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Fail fast: drizzle-kit cannot generate or push migrations without a connection string.
  // Keep the message actionable so contributors know to copy .env.example.
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and fill in the connection string.',
  );
}

// drizzle-kit 0.31.x uses `dialect: 'postgresql'` + `url`. The earlier
// 0.20.x format used `driver: 'pg'` + `connectionString` but was renamed
// in later releases.
export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: false,
  verbose: true,
} satisfies Config;
