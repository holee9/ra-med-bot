# Security Audit — SPEC-REGULA-TRACEABILITY-001 (Issue #47)

**Auditor:** expert-security
**Date:** 2026-06-23
**Scope:** Uncommitted changeset on `feat/issue-47` (modified + untracked files) — local evidence-graph layer for 21 CFR Part 11 RA tooling.
**Branch state:** Changes are NOT yet committed (`git status` shows modified + untracked files). The diff under review is the working-tree changeset, not `main...feat/issue-47`.

**Method:** Read every changed/added file. Ran `pnpm test -- traceability` (50/50 pass). Traced each IDOR claim to the actual query and its test. Verified RLS policies in `migrations/0068_traceability.sql` against the DB-client GUC wiring. Checked audit emission ordering and transactional boundaries.

---

## Findings

Sorted CRITICAL > HIGH > MEDIUM > LOW.

---

### H1 — Edge-create IDOR double-gate has NO route-level integration test (L-006 repeat)

**OWASP:** A01 (Broken Access Control) — test gap masking potential IDOR
**CWE:** CWE-1385 (Missing/Test Gap for Security Controls)
**Files:** `app/api/traceability/edges/route.ts` (entire route), `lib/traceability/__tests__/graph.test.ts`, `tests/unit/api/`

**Description**
The IDOR defense in `createEdge` / `deleteEdgeByKey` (`lib/traceability/graph.ts:165-205`, `238-265`) is structurally correct: it resolves BOTH endpoints via `getNode(db, orgId, nodeId)` — which issues `WHERE id = ? AND org_id = ?` — and throws `EdgeIdorError` if either fails. The route catches that and returns 404.

**However, this defense is only exercised by unit tests that inject a MOCKED `storeResolver`** (`graph.test.ts:47-53`, `94-112`). The mock does the org check itself, so the tests verify the `createEdge` control flow against a fake — they do NOT verify that:

1. The real route handler `POST /api/traceability/edges` actually invokes `createEdge` with the session's `organizationId` (not a body-supplied value).
2. The real `getNode` Drizzle query (`db.select().from(evidenceNodes).where(and(eq(id,...), eq(orgId,...)))`) produces `null` for a cross-org node id, causing `EdgeIdorError` → 404.
3. The route's catch block maps `EdgeIdorError` → 404 (not 500, not a leak).

There is **no test file under `tests/unit/api/` for the local `/api/traceability/*` namespace at all** — confirmed by `grep -rln "api/traceability/edges" tests/` returning empty. The existing `tests/unit/api/traceability-route.test.ts` covers the OTHER namespace (`/api/ra/traceability/*`, Issue #169 BFF proxy), not this code.

This is precisely the L-006 anti-pattern recorded in project memory after #35: "mock-heavy tests masked a runtime defect." On #35 the replay path was runtime-broken despite passing unit tests. Here the risk is analogous: a future refactor of `createEdge` (e.g., dropping the `resolveNode` gate, changing the default resolver) would pass the existing mocked tests and ship an IDOR regression.

**Exploit scenario (if the gate silently regresses)**
An `ra-lead` in org A POSTs `{ fromNodeId: <own>, toNodeId: <org-B-node-id>, relation: 'cites' }`. If the double-gate is bypassed or removed in a refactor (and the mock still returns the "right" answer), the edge is created across orgs, linking org A's deliverable to org B's evidence. The matrix/packet/export routes are org-scoped on read, so the cross-org edge would be invisible in org A's packet (org B's node isn't in A's set) — but it would persist in `evidence_edges` with `org_id = A`, creating a dangling integrity defect and a potential leak if any future read path joins without org-filtering.

**Recommended fix**
Add `tests/unit/api/traceability-edges-route.test.ts` that:
- Imports the REAL `POST` handler and the REAL `withPermission` (or a thin pass-through that still injects a real session with `organizationId`).
- Stubs `db` so that `getNode` for the cross-org node id returns `null` (simulating the real `WHERE org_id = ?` filter), and for same-org returns the row.
- Calls the handler with org-A session + org-B `toNodeId` and asserts `status === 404` and `{ error: 'not_found' }`.
- Calls with same-org endpoints and asserts `201 { created: true }`.
Mirror for delete. This is the test that #35 lacked and that would have caught the replay defect.

---

### H2 — Edge mutation and audit are not transactional (21 CFR Part 11 violation)

**OWASP:** A09 (Security Logging Failures)
**CWE:** CWE-778 (Insufficient Logging), CWE-367 (TOCTOU / non-atomic security decision)
**Files:** `app/api/traceability/edges/route.ts:56-94` (create), `:97-116` (delete)

**Description**
In the create path, the sequence is:
1. `await createEdge(db, ...)` — INSERT into `evidence_edges` (autocommitted; no transaction).
2. `await writeAudit({ action: 'traceability.edge_created', ... })` — INSERT into `audit_logs`.
3. (if `staleReason`) `await propagateStaleFromNode(...)` with its own `writeAudit`.

`createEdge` and `writeAudit` are **independent, non-transactional INSERTs**. Confirmed: no `db.transaction(...)` wraps the route handler, and `graph.ts` uses the injected singleton `db` (not a `tx`).

If step 1 succeeds and step 2 fails (transient DB error, connection blip, enum mismatch, any throw inside `writeAudit`), the edge row is **persisted without a corresponding audit record**. For a 21 CFR Part 11 medical-device tool where evidence edges are audit-material regulatory records, an unaudited mutation is a compliance violation (Part 11.10(e): "secure, computer-generated, time-stamped audit trails"). This is the same defect class as #35's "misleading resolved audit" — the audit row lies about (or omits) a real state change.

The delete path has the identical structure (`deleteEdgeByKey` then `writeAudit`), same gap.

**Exploit scenario**
Not a direct adversarial exploit — a reliability/compliance defect. On a DB hiccup mid-request, an ra-lead creates an edge that the audit trail does not record. During an FDA audit, the evidence graph shows an edge with no creation record → Part 11 finding. Worse: the ra-lead receives a 500 (the rethrown error) but the edge is already committed — they may retry, creating an inconsistent state.

**Recommended fix**
Wrap the mutation + audit in a single transaction:
```ts
await db.transaction(async (tx) => {
  const res = await createEdge(tx, { ... });
  await writeAudit(tx, { ... });  // writeAudit must accept a tx handle
});
```
`writeAudit` currently imports the `db` singleton directly (`lib/audit.ts`) — it needs to accept an optional `tx` parameter so the audit insert rides the same transaction. This is a broader change (touches `writeAudit`'s signature) but is required for Part 11 atomicity. Delegate to `expert-backend`.

---

### M1 — RLS policies on new tables are a no-op backstop (no `WITH CHECK`, GUC never set)

**OWASP:** A01 (Broken Access Control) — defense-in-depth gap
**CWE:** CWE-732, CWE-749
**Files:** `migrations/0068_traceability.sql:80-84`, `107-111`, `131-135`; `lib/db/client.ts` (`withTenantScope` unused); all four route files (use raw `db`)

**Description**
The migration creates RLS policies:
```sql
CREATE POLICY "tenant_isolation_evidence_nodes" ON evidence_nodes
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
```
Two problems:

1. **No `WITH CHECK` clause.** Postgres RLS `USING` only filters `SELECT/UPDATE/DELETE`. `INSERT` is not gated unless a `WITH CHECK` clause exists. So even if RLS were active, an INSERT with a foreign `org_id` would succeed. (This is a project-wide pattern — `grep "WITH CHECK" migrations/` returns zero hits across all 68 migrations.)

2. **The `app.current_org_id` GUC is never set by these routes.** The routes import the raw `db` singleton (`lib/db/client.ts`) directly, not `withTenantScope`. The GUC-setting helper `withTenantScope` exists in the client but `grep "withTenantScope" app/api/ lib/traceability/` returns empty — no route in the codebase uses it. Result: `current_setting('app.current_org_id', true)` returns NULL → policy evaluates `org_id = NULL` → false → all rows invisible (or, if the connection role is the table owner / has `BYPASSRLS`, RLS is skipped entirely).

The **actual** org isolation is therefore the app-level `eq(evidenceNodes.orgId, opts.orgId)` filter present in every query in `graph.ts`, `matrix.ts`, `evidence-packet.ts`, `stale-propagation.ts`. RLS is a dead backstop. This is a pre-existing systemic issue (inherited from #35/#59), not introduced by this SPEC — but the new tables inherit the gap.

**Exploit scenario**
If a future refactor drops the app-level `orgId` filter from any query (e.g., a new "global" admin route), RLS will NOT catch it — the policy is inert. The defense-in-depth layer that the migration `CREATE POLICY` suggests exists does not actually function.

**Recommended fix (defense-in-depth)**
Either (a) wire `withTenantScope` into the traceability routes (and verify `SET LOCAL` runs inside the tx), OR (b) document explicitly that RLS is intentionally inert and the app-level filter is the sole gate — then add `WITH CHECK` to future-proof INSERT gating. Given the project-wide scope, track as a separate hardening issue; do not block this merge on it, but flag it.

---

### M2 — Stale-propagation failure in edge-create path throws uncaught → 500 after successful commit

**OWASP:** A05 (Security Misconfiguration) — inconsistent state
**CWE:** CWE-754 (Improper Check for Unusual Condition)
**Files:** `app/api/traceability/edges/route.ts:78-93`

**Description**
After a successful `createEdge` + audit, if `body.staleReason` is set, the route calls `propagateStaleFromNode` directly. The route's `try/catch` only handles `EdgeIdorError` and `SelfReferenceError` (lines 117-126); any error from `propagateStaleFromNode` (e.g., DB failure on `stale_flags` insert) is rethrown → the handler rejects → `withPermission`'s caller returns 500.

The edge is **already committed** (non-transactional, see H2). The client sees a 500 and may retry, but the edge exists (idempotent retry returns `{ created: false }`). The stale propagation, however, did not complete — downstream nodes are not flagged stale. This is an inconsistent state: the edge records a supersession relationship but the `stale_flags` that should fan out from it are missing.

Note: the library-level hooks (`lib/traceability/hooks.ts:29-72`) DO wrap `propagateStaleFromNode` in try/catch and emit a `propagationFailed: true` audit row. But the route calls `propagateStaleFromNode` directly, bypassing that protective wrapper.

**Recommended fix**
Route the stale propagation through the `onSourceSectionSuperseded` / `onRegulatoryUpdateSuperseded` hooks (which are non-blocking and audit the failure), OR wrap the direct `propagateStaleFromNode` call in its own try/catch that emits a failed-audit row and continues. Combined with H2's transaction, this should be inside the same atomic boundary.

---

### L1 — Matrix read audited under generic `dashboard.view` action

**OWASP:** A09 (Security Logging Failures) — audit clarity
**Files:** `app/api/traceability/route.ts:44-55`

**Description**
The matrix GET route writes its audit row with `action: 'dashboard.view'` and `meta_json.scope: 'matrix'` (line 47, 51). There is no matrix-specific audit action. During a Part 11 audit log review, matrix views are indistinguishable from dashboard views without parsing `meta_json.scope`. The SPEC added 4 traceability-specific audit actions but none for matrix read.

**Recommended fix**
Either add a `traceability.matrix_viewed` action (migration + enum + audit.ts), or document that matrix reads are intentionally rolled into `dashboard.view`. Low severity, but for a regulated tool, distinct actions ease audit review.

---

### L2 — Export route leaks exporter error detail in 502 response

**OWASP:** A05 — information disclosure
**Files:** `app/api/traceability/[deliverableId]/export/route.ts:49-53`

**Description**
On export failure, the route returns `{ error: 'export_failed', detail: result.error?.message ?? 'unknown' }`. The `detail` field forwards the underlying exporter error message (e.g., a PDF renderer internal error) to the client. For an authenticated ra-member, this is low-impact, but it can leak library internals / stack-adjacent strings.

**Recommended fix**
Log the full detail server-side (Sentry/audit) and return a generic `{ error: 'export_failed' }` to the client. Keep the detail in the audit `meta_json` for Part 11 traceability.

---

### L3 — `Content-Disposition` filename may carry unsanitized `refId`

**OWASP:** A03 (Injection) — HTTP response splitting / header injection
**Files:** `app/api/traceability/[deliverableId]/export/route.ts:69-71`; `lib/traceability/export-packet.ts:117`

**Description**
The export route builds the download filename as `result.filename ?? \`evidence-packet-${deliverableId}.${ext}\``. `exportPacket` passes `customFilename: \`evidence-packet-${packet.deliverable.refId}\`` to ExportHub. If ExportHub echoes `customFilename` back as `result.filename`, then the `Content-Disposition: attachment; filename="..."` header carries `refId` — a DB-sourced text value that is NOT sanitized for `"` / `\r\n` / control characters. A `refId` containing a quote or CRLF could break or inject into the header.

In practice: `deliverableId` (URL segment) is a UUID validated by the DB lookup, and `refId` is typically a row id. The default fallback path is safe. The risk materializes only if (a) ExportHub surfaces `customFilename` as `result.filename` AND (b) an ra-lead/system creates a node with a `refId` containing header-breaking characters.

**Recommended fix**
Sanitize the filename before header interpolation: strip `"` / `\r` / `\n` / control chars, or use RFC 6266 `filename*=UTF-8''<encoded>` form. Defense-in-depth; low severity given the UUID fallback.

---

### L4 — DB-sourced values interpolated into Markdown/PDF without sanitization

**OWASP:** A03 (Injection) — content injection
**Files:** `lib/traceability/export-packet.ts:24-58` (`packetToMarkdown`)

**Description**
`packetToMarkdown` interpolates `d.refTable`, `d.refId`, `d.authority`, `d.version`, `node.nodeType`, `node.relation`, `node.artifactHash` directly into the Markdown string. These flow into the PDF/MD export via ExportHub. A `refId` or `authority` containing Markdown metacharacters (`#`, backticks, `[link](url)`) would be rendered as Markdown structure, not escaped text.

Mitigating factors: these values are written only by `ra-lead` users (trusted) or system hooks (delta-sync with system-derived ids). A malicious ra-lead could inject formatting but not scripts (ExportHub renders MD→PDF, not MD→HTML-in-browser). Low impact for a trusted-writer model.

**Recommended fix**
Escape `refTable`/`refId`/`authority`/`version` with backticks or a Markdown-escape helper before interpolation. Defense-in-depth; low severity given the trust model.

---

## Summary Table

| ID | Severity | OWASP | One-liner |
|----|----------|-------|-----------|
| H1 | HIGH | A01 | Edge IDOR double-gate has zero route-level tests (mocked resolver only — L-06 repeat) |
| H2 | HIGH | A09 | Mutation + audit are non-transactional; edge can persist without audit row (Part 11) |
| M1 | MEDIUM | A01 | RLS policies are inert: no `WITH CHECK`, GUC never set — app filter is sole gate |
| M2 | MEDIUM | A05 | Stale-propagation error in create path → 500 after committed edge (inconsistent state) |
| L1 | LOW | A09 | Matrix read reuses `dashboard.view` audit action — reduces Part 11 audit clarity |
| L2 | LOW | A05 | Export 502 leaks exporter error detail to client |
| L3 | LOW | A03 | `Content-Disposition` filename may carry unsanitized DB `refId` |
| L4 | LOW | A03 | DB-sourced values interpolated into MD/PDF without escaping (trusted-writer) |

---

## Verdict: BLOCK-MERGE

Two HIGH findings, both consistent with the defect classes that blocked #35 and #59:

- **H1** is a direct repeat of the L-006 lesson recorded in project memory: the IDOR defense is tested only through mocks, with zero route-level coverage of the actual HTTP+DB path. The project explicitly committed to not repeating this. Adding the missing route-level IDOR test is a merge prerequisite.

- **H2** is a genuine 21 CFR Part 11 compliance defect for a regulated medical-device tool: an evidence-edge mutation can persist without a corresponding audit record on any transient DB failure, because the INSERT and the audit INSERT are not atomic. This is the same "audit lies about state" class as #35's misleading-resolved-audit finding. `writeAudit` must accept a transaction handle and ride the same boundary as the mutation.

The lib-level IDOR code (`createEdge`/`deleteEdgeByKey` double-gate), the RBAC wiring (`traceability.manage` = ra-lead), the Zod input validation, the mass-assignment hardening (`orgId`/`createdBy` server-derived), the append-only audit invariant (no UPDATE/DELETE on `audit_logs`), and the absence of secrets/SSRF are all **correct**. The block is on the two HIGH findings, not on a fundamental design flaw.

M1–L4 are tracked for follow-up hardening and do not block merge.

**Routing for fixes (for orchestrator):**
- H1, M2 → `expert-testing` (route-level IDOR test; wrap stale-propagation in try/catch + audit-on-fail)
- H2 → `expert-backend` (`writeAudit` accept `tx`; wrap edge create/delete + audit in `db.transaction`)
- M1, L1–L4 → `expert-backend` / `regula-security-audit` (defense-in-depth, separate hardening issue)
