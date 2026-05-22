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

// drizzle-kit 0.20.x uses `driver: 'pg'` + `connectionString`. The 0.21+
// release renamed these to `dialect: 'postgresql'` + `url`. Pinned to 0.20
// for compatibility with the current handoff stack.
export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: databaseUrl,
  },
  strict: false,
  verbose: true,
} satisfies Config;
