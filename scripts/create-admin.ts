#!/usr/bin/env node
// Seed the bootstrap admin account from environment variables.
// Run via: pnpm admin:create
// Required env vars: SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
// DATABASE_URL must also be set (from .env.local).
// Idempotent: if the email already exists, promotes it to admin + active.

import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';

// Load .env.local if present (script runs outside Next.js loader).
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!name || !email || !password || password.length < 8) {
    console.error(
      '❌ Required env vars missing or invalid:\n' +
        '   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (min 8 chars)\n' +
        '   Add them to .env.local and re-run: pnpm admin:create',
    );
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set. Add it to .env.local.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const password_hash = await bcrypt.hash(password, 12);

  const [existing] = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing) {
    await sql`
      UPDATE users
      SET password_hash = ${password_hash},
          role = 'admin',
          status = 'active',
          must_change_password = true
      WHERE email = ${email}
    `;
  } else {
    await sql`
      INSERT INTO users (name, email, password_hash, role, status, must_change_password)
      VALUES (${name}, ${email}, ${password_hash}, 'admin', 'active', true)
    `;
  }

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
