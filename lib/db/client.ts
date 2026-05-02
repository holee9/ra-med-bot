// @MX:ANCHOR Drizzle client singleton — used by every server-side data access.
// @MX:REASON Re-creating a postgres-js connection per request would exhaust
// the pool. The singleton is module-scoped so Next.js Route Handlers reuse it.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-031, supports REQ-FND-046+)

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../env';
import * as schema from './schema';

// One connection pool per Node.js process. `max: 10` is conservative for
// Vercel serverless (each lambda gets its own process anyway) and safe for
// long-running Node servers.
const env = getEnv();
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
