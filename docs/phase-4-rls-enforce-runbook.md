# Phase 4 — RLS Enforce Runbook (SPEC-REGULA-RLS-ENFORCE-001, Issue #239)

Operational runbook for enforcing Row-Level Security at runtime. Applies after
migrations `0084_force_rls.sql` and `0085_app_role.sql` land. The actual cutover
(migration application + env switch + canary) is an **ops action**, not a code
change — this document is the single source of truth for that action.

## 1. Prerequisites (already merged)

- **Phase 1 (migration 0083)**: 20 org-scoped policies carry `WITH CHECK` equal
  to `USING`. INSERT/UPDATE now gated.
- **Phase 2 (PR #271)**: All org-scoped DB ops in routes wired through
  `withTenantScope` (`lib/db/with-tenant-scope.ts`), which sets the
  `app.current_org_id` GUC.
- **Phase 3 (PR #271)**: `lib/*` wiring complete. Coverage gate at
  `tests/unit/db/with-tenant-scope-coverage.test.ts` is green.
- **M-1 (PR #272)**: `auth.ts` uses `SERVICE_DATABASE_URL` (superuser / bypass).
  `serviceDb` is the **only** bypass client and is confined to `auth.ts`.

## 2. Pre-flight checks (before cutover)

1. `pnpm test tests/unit/db/with-tenant-scope-coverage.test.ts` is green.
2. Grep audit: `serviceDb` appears **only** in `lib/auth.ts` (and its own
   definition site `lib/db/client.ts`, which exports it from
   `SERVICE_DATABASE_URL`). Run:
   `grep -rn "serviceDb" app lib --include="*.ts" | grep -v "lib/db/client.ts"`
   Expected: zero hits outside `lib/auth.ts`.
3. No route handler or lib function issues an org-scoped query without
   `withTenantScope`. The coverage gate enforces this statically.

## 3. Step 1 — Set the real password (ops)

The password in `0085_app_role.sql` is a placeholder. After applying 0085, set
the real password from the secrets manager — **never commit it**:

```sql
ALTER ROLE regula_app WITH PASSWORD '<from-secrets-manager>';
```

## 4. Step 2 — Set environment variables

Both URLs must be set. `DATABASE_URL` is the RLS-subject connection the app runs
on; `SERVICE_DATABASE_URL` is the superuser bypass used only by `auth.ts`.

```
DATABASE_URL=postgresql://regula_app:<pwd>@host:5432/regula
SERVICE_DATABASE_URL=postgresql://postgres:<superuser_pwd>@host:5432/regula
```

If `SERVICE_DATABASE_URL` is unset, `auth.ts` bootstrap (session lookup, user
provisioning) fails. If `DATABASE_URL` is not switched to `regula_app`, RLS
remains a no-op (superuser bypass).

## 5. Step 3 — Apply migrations 0084 + 0085

Run via the project's migration tool (drizzle-kit or the existing migration
runner). Order matters only in that 0085 creates the role that 0001's
GRANT/REVOKE references — but since 0001 already ran historically, apply in
numeric order: **0084 then 0085**.

- `0085` creates `regula_app` (NOBYPASSRLS) + grants.
- `0084` sets `FORCE ROW LEVEL SECURITY` on the 20 tables.

## 6. Step 4 — Canary verification

With the app running as `regula_app` + FORCE RLS applied, run a canary that
asserts both the positive and negative isolation paths.

**Suggested vitest integration test**:

```ts
// tests/integration/rls-enforce.canary.spec.ts
describe('RLS enforce canary (Phase 4)', () => {
  it('returns only the caller org rows when GUC is set', async () => {
    // 1. Seed two orgs (A, B) with one row each in e.g. organization_documents.
    // 2. Inside withTenantScope({ orgId: A, userId }, () => db.select()...)
    // 3. Assert: only org A rows returned.
  });

  it('returns 0 rows (fail-closed) when GUC is unset outside withTenantScope', async () => {
    // 1. Same seed.
    // 2. Issue a raw query on organization_documents WITHOUT withTenantScope,
    //    using the app role (regula_app) connection.
    // 3. Assert: current_setting('app.current_org_id', true) IS NULL.
    // 4. Assert: query returns 0 rows (policy's USING evaluates to NULL = false).
  });
});
```

Assertion shape: `current_setting('app.current_org_id', true)` must be `NULL`
outside a `withTenantScope` call, and any org-scoped `SELECT` must return 0 rows
in that state (fail-closed). This is the guarantee that an forgotten
`withTenantScope` wiring does not leak cross-org data.

**Implemented** (2026-07-10, BLOCK-3): `tests/integration/rls-enforce-canary-real-db.test.ts`
exercises this on `knowledge_sources` (a 2nd FORCE table, extending the #317
sources canary). It found (L-013) that the 0099 policy used bare
`current_setting(...)::uuid` (no NULLIF) — an empty GUC raised `invalid uuid`
instead of fail-closing. migration `0116_knowledge_sources_rls_nullif.sql`
hardens it with `NULLIF(..., '')::uuid` (matching sources 0114). The canary runs
in CI (migrations-real-db.yml RLS canary step). Other 0099-era FORCE tables may
have the same gap — a broader NULLIF audit is a follow-up.

## 7. Rollback

FORCE RLS and the role switch are both **additive and reversible**.

- Disable FORCE on a specific table (keeps policies, just removes FORCE flag):
  `ALTER TABLE <table> NO FORCE ROW LEVEL SECURITY;`
- Full disable across all 20 tables: issue `NO FORCE` for each (a rollback
  migration `0086_unforce_rls.sql` can be authored on demand).
- Revert the env switch: set `DATABASE_URL` back to the superuser connection.
  RLS policies remain attached but become inert again (superuser bypass).

Neither action drops data or policies. The role `regula_app` can be left in
place (it is harmless if unused).

## 8. Known limits / Phase 4 follow-ups

- **M-2 (sources / source_sections catalog policy)**: these are global catalog
  tables read cross-org (e.g. the FDA/EU MDR/MFDS corpus). If their RLS policy
  requires `org_id` match, a `regula_app` connection without a GUC set will see
  0 rows — breaking global catalog reads. Confirm the policy allows
  `org_id IS NULL` rows to be visible without a GUC, or exempt the catalog read
  path. This is a **policy-shape** question, not addressed by 0084/0085.
- **Weekly-digest cron (cross-org admin enumeration)**: any job that enumerates
  across all orgs (e.g. a weekly digest) cannot use the `regula_app`
  connection — RLS would restrict it to one org. It must use
  `SERVICE_DATABASE_URL` (superuser bypass) or a dedicated bypass role. Confirm
  the cron's DB client before cutover.
- **`audit_logs` is intentionally NOT in the 20 FORCE tables**: it is
  append-only (trigger-enforced, migration 0001) and append access must not be
  blocked by tenant GUC. Audit writes go through `writeAudit` which uses the
  caller's connection — confirm `audit_logs` has no `org_id` policy or is
  exempted.
