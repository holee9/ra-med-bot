// @MX:ANCHOR [AUTO] Kernel public API — thin re-export barrel.
// @MX:REASON Establishes the lib/kernel/ boundary: all kernel infrastructure
// (db client, auth, audit, ratelimit, storage) is importable from '@/lib/kernel'.
// REQ-V3R-004: thin wrapper only — NO new abstractions, DI interfaces, or
// dependency inversion. Every export below is a pass-through re-export of an
// existing symbol in a kernel submodule.
// @MX:SPEC SPEC-V3-RESTRUCTURE-001 Phase B (REQ-V3R-012, REQ-V3R-004)
//
// SPEC body discrepancy (documented for manager-spec amendment):
// REQ-V3R-012 / T11.1 list getSession, requireRole, verifyHashChain, rateLimit,
// uploadAsset as required kernel re-exports. These symbols do NOT exist in the
// current codebase:
//   - getSession     — absent (auth uses NextAuth `auth()` export, not getSession)
//   - requireRole    — absent (RBAC via withPermission + rbac.ts, no standalone)
//   - verifyHashChain — absent (verify-chain.ts exports verifyAuditChain)
//   - rateLimit       — absent (ratelimit exports createKVRateLimiter factory)
//   - uploadAsset     — absent (storage exports R2Client class)
// Per REQ-V3R-004 (no new abstractions), these are NOT synthesized here.
// The actual public surface is re-exported below.

// ---------------------------------------------------------------------------
// db/client — Drizzle ORM client singleton + tenant-scoping helper
// ---------------------------------------------------------------------------
export { db, serviceDb, withTenantScope } from './db/client';
export type { Database, DrizzleClient } from './db/client';

// ---------------------------------------------------------------------------
// auth — NextAuth.js v5 configuration barrel
// ---------------------------------------------------------------------------
export { auth, handlers, signIn, signOut } from './auth';

// auth/with-permission — RBAC enforcement wrapper
export { withPermission } from './auth/with-permission';
export type { AuthSession } from './auth/with-permission';

// ---------------------------------------------------------------------------
// audit — append-only audit trail (21 CFR Part 11)
// ---------------------------------------------------------------------------
export { writeAudit, writeAuditReturningId } from './audit';
export type { AuditAction, AuditEvent, AuditDbHandle } from './audit';

// ---------------------------------------------------------------------------
// ratelimit — Cloudflare KV rate limiter
// ---------------------------------------------------------------------------
export { createKVRateLimiter } from './ratelimit/cloudflare-kv';
export type {
  KVRateLimiter,
  KVRateLimiterOptions,
  RateLimitResult,
} from './ratelimit/cloudflare-kv';

// ---------------------------------------------------------------------------
// storage — R2 object storage client
// ---------------------------------------------------------------------------
export { R2Client } from './storage/r2';
export type { R2PutOptions, R2ListOptions, R2ListResult } from './storage/r2';
