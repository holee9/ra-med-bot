#!/usr/bin/env node
// Seed the bootstrap admin account from environment variables.
// Run via: pnpm admin:create
// Required env vars: SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
// Idempotent: if the email already exists, promotes it to admin + active.

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { users } from '../lib/db/schema';

async function main() {
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 8) {
    console.error(
      '❌ Required env vars missing or invalid:\n' +
        '   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (min 8 chars)\n' +
        '   Add them to .env.local and re-run: pnpm admin:create',
    );
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ password_hash, role: 'admin', status: 'active' })
      .where(eq(users.email, email));
    console.log(`✅ Promoted to admin: ${email}`);
  } else {
    await db.insert(users).values({ name, email, password_hash, role: 'admin', status: 'active' });
    console.log(`✅ Admin account created: ${email}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
