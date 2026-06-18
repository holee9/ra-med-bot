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

// Updated for drizzle-kit 0.31+ which uses `dialect: 'postgresql'` + `url`.
// Previous versions used `driver: 'pg'` + `connectionString`.
export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
} satisfies Config;
