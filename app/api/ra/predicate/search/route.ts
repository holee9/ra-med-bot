// @MX:ANCHOR [AUTO] POST /api/ra/predicate/search — predicate 510(k) discovery entry point.
// @MX:REASON Sole API boundary for predicate search: department RBAC, KV cache,
//   cascade search, and 21 CFR Part 11 audit logging all converge here.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-001, REQ-PRE-007, REQ-PRE-009, REQ-PRE-010, REQ-PRE-029)

// REQ-PRE-029: nodejs runtime required — department lookup uses the pg driver,
// which is not edge-runtime compatible.
export const runtime = 'nodejs';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit';
import { canSearchPredicates } from '@/lib/auth/predicate-permissions';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { createCascadeSearch } from '@/lib/predicate/cascade-search';
import { createPredicateCache } from '@/lib/predicate/cache';
import {
  type CreateOpenFDAClientEnv,
  createOpenFDAClient,
} from '@/lib/predicate/openfda-client';
import type { PredicateCandidate } from '@/lib/predicate/types';

/** Number of K-numbers recorded in the audit trail (REQ-PRE-010). */
const AUDIT_TOP_K = 5;

const SearchSchema = z.object({
  device_name: z.string().min(1).max(500),
});

/**
 * Resolve the predicate KV namespace and openFDA client env. KV bindings are
 * not yet threaded through the Next-on-Workers context here, so the cache
 * degrades to a no-op (createPredicateCache treats `undefined` as disabled)
 * until the binding is wired. The openFDA API key is read from the environment.
 */
function getPredicateEnv(): { kv: KVNamespace | undefined; openfdaEnv: CreateOpenFDAClientEnv } {
  const kv = (globalThis as { KV_PREDICATE_CACHE?: KVNamespace }).KV_PREDICATE_CACHE;
  return {
    kv,
    openfdaEnv: {
      KV_PREDICATE_CACHE: kv,
      OPENFDA_API_KEY: process.env.OPENFDA_API_KEY,
    },
  };
}

/** Fetch the caller's department; null when unset or the user row is missing. */
async function getDepartment(userId: string): Promise<string | null> {
  const rows = await db
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.department ?? null;
}

export const POST = withPermission('consult.create', async (req, _ctx, session) => {
  // 1. Body parse + validation (REQ-PRE-001).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SearchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { device_name } = parsed.data;

  // 2. Department RBAC (REQ-PRE-029): RA/Dev may search; Exec/External may not.
  const department = await getDepartment(session.user.id);
  if (!canSearchPredicates(department)) {
    return Response.json(
      { error: 'permission_denied', reason: 'department' },
      { status: 403 },
    );
  }

  const { kv, openfdaEnv } = getPredicateEnv();
  const cache = createPredicateCache(kv);

  // 3. Cache check BEFORE cascade search (REQ-PRE-009).
  let candidates: PredicateCandidate[];
  let cached: boolean;
  let hasCoverageGap = false;
  let searchStrategy = 'device_name';

  try {
    const hit = await cache.get(device_name);
    if (hit) {
      candidates = hit;
      cached = true;
    } else {
      // 4. Cache miss → cascade search, then cache the result.
      const openfdaClient = createOpenFDAClient(openfdaEnv);
      const cascade = createCascadeSearch(openfdaClient);
      const result = await cascade.search(device_name, {});
      candidates = result.candidates;
      cached = false;
      hasCoverageGap = result.has_coverage_gap;
      searchStrategy = result.search_strategy;
      await cache.set(device_name, candidates);
    }
  } catch (_err) {
    // REQ-PRE-001: openFDA fetch / cascade failure.
    return Response.json({ error: 'predicate_search_failed' }, { status: 500 });
  }

  // 5. Audit log on every call (REQ-PRE-010) — record only the top-5 K-numbers.
  await writeAudit({
    action: 'predicate_search',
    actor_id: session.user.id,
    resource_type: 'predicate',
    resource_id: 'search',
    meta_json: {
      query: device_name,
      result_count: candidates.length,
      top_k_numbers: candidates.slice(0, AUDIT_TOP_K).map((c) => c.k_number),
    },
  });

  // 6. Response.
  return Response.json({
    candidates,
    cached,
    has_coverage_gap: hasCoverageGap,
    search_strategy: searchStrategy,
  });
});
