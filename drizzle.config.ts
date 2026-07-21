// @MX:NOTE Drizzle Kit configuration. Reads DATABASE_URL from env and
// targets PostgreSQL 16 (per handoff §4 / §12). Schema location:
// lib/kernel/db/schema.ts (created in a later phase).

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
  // B3 (SPEC-V3-RESTRUCTURE-001): multi-file schema glob — kernel tables split
  // into schema-kernel.ts; schema-docingest.ts now explicitly wired (previously
  // unconfigured). drizzle-kit resolves all 3 files as a unified schema.
  schema: [
    './lib/kernel/db/schema-kernel.ts',
    './lib/kernel/db/schema.ts',
    './lib/kernel/db/schema-docingest.ts',
  ],
  out: './lib/kernel/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
} satisfies Config;
