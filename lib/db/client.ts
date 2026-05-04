// @MX:ANCHOR Drizzle client singleton — used by every server-side data access.
// @MX:REASON Re-creating a postgres-js connection per request would exhaust
// the pool. The singleton is module-scoped so Next.js Route Handlers reuse it.
// @MX:SPEC SPEC-REGULA-FOUNDATION-001 (REQ-FND-031, supports REQ-FND-046+)

import { sql } from 'drizzle-orm';
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

// Drizzle client type inferred from the db instance — exported for radar crawlers
export type DrizzleClient = typeof db;

/**
 * Execute a function within a tenant-scoped transaction.
 * Sets `app.current_org_id` GUC so RLS policies can enforce org isolation.
 * REQ-DOC-042: all org document queries MUST use this wrapper.
 */
export async function withTenantScope<T>(
  orgId: string,
  fn: (db: DrizzleClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Set the GUC for RLS policy enforcement
    await tx.execute(sql.raw(`SET LOCAL app.current_org_id = '${orgId}'`));
    return fn(tx as unknown as DrizzleClient);
  });
}
