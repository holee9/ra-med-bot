# Regula Implementation Status

Reviewed: 2026-06-21 KST (implementation review/fix pass)
Implementation review baseline commit: `0e6c479` (`main` after PR #206 / Issue #92 external auditor read-only view merge)

This document includes the 2026-06-18 PR cleanup after PR #184 merge,
PR #177 superseded closure, the completed Predicate Visualization addendum
for Issue #185 / PR #186, E2E validation MRD completion for Issue #182,
the Issue #188 hybrid-ra-saas inbound webhook hardening pass,
the Issue #156 hybrid-ra-saas outbound typed adapter merge,
the 2026-06-20 security/quality fixes (#162 RBAC, #164 Predicate E2E, #152 workflow mock audit, #163 onboarding E2E seed),
the Issue #46 / PR #195 ISO 14971 Risk Management integration plus the follow-up `8065cc8` CI restoration commit, PR #204 / Issue #88 21 CFR Part 11 electronic signatures, PR #205 ESIG Part 11 signature workflow documentation, and PR #206 / Issue #92 external auditor read-only view with 1-click audit package. This review also covers PR #196, PR #197, the #166 hydration mismatch fixes, and the QA Gate/Wave 5 SPEC documentation commits now present on `main`.

## Executive State

PR #184 was merged to main after CI recovery. The merged state includes the
E2E user validation framework and Traceability integration surface. PR #177 was
closed as superseded because its substantive Traceability changes were already
present on main and the branch was stale/conflicting.

PR #186 (Predicate Visualization) was completed and merged to main, adding
interactive chart-first view for Predicate comparison results with Bar/Radar/Table
modes, Before-After comparison, and demo animation capabilities.

Issue #182 E2E validation framework is complete with Smoke Test 8/8 specs passing
and comprehensive MRD documentation at `docs/e2e-validation-mrd.md`.

CI Gates, Playwright chromium/firefox/webkit, LLM Eval Harness, E2E Smoke,
Vercel preview, and Security Scan all passed for PR #184 before merge.

Issue #188 is closed. The final review pass hardened the inbound webhook
boundary by returning 400 for malformed JSON, comparing SHA-256 digests via
`crypto.timingSafeEqual`, removing production no-op logging, and adding focused
unit coverage for webhook error handling and timing-safe comparison behavior.

Issue #156 is complete via PR #192. Regula now has a server-only typed adapter
for outbound hybrid-ra-saas calls with endpoint-specific request/response
types, Bearer + tenant header injection, 30 second timeout handling, and
classified `HybridRaClientError.kind` values for unconfigured, auth, schema,
server, timeout, and network failures.

Issue #46 is complete via PR #195. Regula now includes an ISO 14971 Risk
Management workflow with hazard identification, severity/probability risk
matrix, control hierarchy, residual risk evaluation, GSPR mapping, DOCX export,
and RA-lead approval gate. The follow-up commit `8065cc8` restored the build,
lint, unit, E2E, security, and deploy gates on `main`.

The 2026-06-20 implementation review found one post-merge regression on the
latest `main`: the #166 hydration mismatch follow-up added correct
`suppressHydrationWarning` boundaries, but three files were not formatted by
Biome, causing the `CI Gates` lint/format path to fail. The review fix formats
those files and refreshes the current verification evidence.

The 2026-06-21 review of PR #204 found and fixed two signature-specific security regressions before merge: signature endpoints now authorize the requested `messageId` through the caller's conversation/project scope before signing, manifestation lookup, or revocation; `qa-lead` no longer inherits every `ra-lead` permission and is instead allowlisted only for `signature.sign`.

Issue #92 is complete via PR #206. Regula now ships a read-only `auditor`
persona plus a 1-click audit package builder. The read-only guarantee is
enforced centrally inside `withPermission` (all write methods return 403 with
an `audit.denied` record), the audit package is assembled as an in-memory ZIP
with a SHA-256 per-file manifest, and a watermark component marks every screen
during an auditor session.

## Verified Repository State (2026-06-21)

| Area | State | Evidence |
|---|---|---|
| Active branch | `main` | review baseline commit `0e6c479` |
| Completed PRs/issues | #184, #186, #188, #192/#156, #190/#182, #193/#162, #194, #195/#46, #196, #197, #204/#88, #205, #206/#92, #166 | all merged or closed |
| E2E Validation | COMPLETE | Go/No-Go spec, Smoke Test 8/8 specs, MRD complete |
| Traceability Integration | COMPLETE | BFF routes, UI, RBAC all implemented |
| Webhook Integration | COMPLETE | `/api/webhooks/audit`, `ifu`, `knowledge-sync` hardened |
| hybrid-ra-saas typed adapter | COMPLETE | `createHybridRaClient()` covers 7 upstream endpoint contracts |
| ISO 14971 Risk Management | COMPLETE | `/workflows/risk`, `/api/ra/risk/*`, `lib/risk/*`, risk DB tables, RA-lead approval |
| 21 CFR Part 11 Electronic Signature | COMPLETE | `/api/ra/messages/[messageId]/signature`, `answer_signatures`, answer lock, §11.50/§11.70 linkage |
| External Auditor Read-Only View | COMPLETE | `auditor` role, central write-block, `/api/ra/audit-log`, `/api/ra/audit-package` ZIP + SHA-256 manifest |
| Submission drafter contract (#196) | COMPLETE | build env bypass path, `workflow_runs` status contract, source health-check import fixed |
| Hydration mismatch (#166) | COMPLETE | date render boundaries plus 2026-06-20 Biome format recovery |
| QA Gate 0 helper (#74) | COMPLETE | `scripts/qa-gate-0-checklist.ts`, shared checklist template, ignored generated outputs |
| QA Gate 0–5 SPEC promotion (#74–#79) | COMPLETE | All 6 gate SPECs promoted Draft → Active with expanded EARS REQs, Application Scope, Evidence Artifacts, SSoT Alignment sections (PR #212 Gate 1–5, PR #218 Gate 0); `docs/qa/qa-gate-definitions.md` Owner SPEC markers synced from `(planned)` to actual status |
| RBAC security (#162) | COMPLETE | ra-lead → /403 redirect E2E validated (PR #193) |
| Predicate E2E stability (#164) | COMPLETE | hydration + RBAC locator fixed (in PR #190) |
| Mock workflow audit (#152) | COMPLETE | mock_data, workflow_run_id metadata connected (in PR #190) |
| Onboarding E2E seed (#163) | COMPLETE | globalSetup.ts bootstrapProjects + empty-state CTA in Sidebar |
| Work gate | #18 active | mandatory before new P0 work |

## 2026-06-21 External Auditor Read-Only View — Issue #92 / PR #206

SPEC-REGULA-AUDITOR-VIEW-001 is implemented and merged. Regula now exposes a
read-only `auditor` persona (FDA inspector, MFDS 심사관, BSI/TÜV) with a
1-click audit package builder, and every write path is centrally blocked so the
read-only guarantee cannot be bypassed by a missing per-route guard.

| Area | State | Evidence |
|---|---|---|
| RBAC role | Complete | `auditor` role (hierarchy 0.5, `lib/auth/rbac.ts`); `audit.read` + `audit.package.generate` granted via `additionalRoles` only (`lib/auth/permissions.ts`) |
| Central write-block | Complete | `withPermission` rejects POST/PUT/PATCH/DELETE for auditor sessions with 403 + `audit.denied` log (`lib/auth/with-permission.ts`); supersedes per-route guards |
| Audit log view | Complete | `GET /api/ra/audit-log` pagination (50/page) with date/event/actor filters; `app/(app)/audit/page.tsx` read-only UI |
| 1-click audit package | Complete | `POST /api/ra/audit-package` assembles ZIP with 5 sections (audit-log / signed-answers / citations / expert-reviews / compliance-reports), 12-month window under 60s |
| Integrity | Complete | `lib/audit-package/manifest.ts` SHA-256 per-file manifest + `verifyManifest`; `lib/audit-package/zip.ts` STORE-mode ZIP writer (no external deps, `node:zlib` crc32) |
| Watermark UI | Complete | `AuditorWatermark` component displayed on every screen during auditor sessions |
| DB migration | Complete | `migrations/0062_auditor_view_enums.sql` extends `user_role.auditor`, `audit_action.audit.denied` / `audit.package.generated` |
| Documentation | Complete | README, QA matrix, threat model, SPEC progress updated |

Design decisions:

1. **Central write-block over per-route guards**: enforcing inside `withPermission` means every existing and future route is automatically protected — there is no bypass surface from a forgotten guard.
2. **Zero-dependency ZIP writer**: a 150-line STORE-mode writer (Enforce Simplicity) avoids adding a packaging dependency while still producing a verifiable manifest.
3. **`auditor` hierarchy 0.5**: the role intentionally sits below the existing `minRole` chain and is reachable only through `additionalRoles`, so it can never escalate into a general RA/admin path.

Follow-ups (separate issues): 24h download-link expiry (presigned URL), wiring real data into the `citations` / `compliance-reports` package sections once their backing SPEC tables land.

Validation evidence:

- `corepack pnpm typecheck` — pass.
- `corepack pnpm lint` (biome) — pass.
- `corepack pnpm ci:rbac` — pass.
- `corepack pnpm test` — 2,847 tests passed, 7 skipped (46 new tests across 6 files).
- `SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build` — pass.
- PR #206 checks — CI Gates, E2E Smoke, Playwright, Security Scan, Deploy all pass.

## 2026-06-21 Electronic Signature — Issue #88 / PR #204

SPEC-REGULA-ESIG-001 is implemented and merged. The feature adds 21 CFR Part 11 electronic signatures for answer approval records and ties each signature to the exact answer content by hash.

| Area | State | Evidence |
|---|---|---|
| Signature API | Complete | `POST`/`GET /api/ra/messages/[messageId]/signature`, `POST /signature/revoke` |
| Message authorization | Complete | `lib/signature/authorization.ts` validates `messages` through `conversations` and `projects` before lookup side effects |
| RBAC | Complete | `signature.sign` uses `minRole: ra-lead` plus `additionalRoles: ['qa-lead']`; `qa-lead` is below `ra-lead` in general hierarchy |
| Record linkage | Complete | `computeAnswerHash()` hashes answer prose + ordered blocks with SHA-256 |
| Locking | Complete | `isAnswerLocked()` blocks refine and block PATCH mutation paths while a signature is active |
| Manifestation | Complete | `SignatureManifestation` component and PDF injection include signer, title, meaning, signed timestamp, record hash, revocation state |
| Audit | Complete | `signature.applied` and `signature.revoked` are written through append-only `writeAudit()` |
| Documentation | Complete | README, API reference, Part 11 docs, SPEC progress/tasks updated |

Validation evidence:

- `corepack pnpm typecheck` — pass.
- `corepack pnpm lint` — pass.
- `corepack pnpm ci:rbac` — pass.
- Targeted regression tests — 320 tests passed across signature and auth/RBAC suites.
- `corepack pnpm test` — 2,766 tests passed, 7 skipped.
- `SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build` — pass.
- PR #204 checks — CI Gates, E2E Smoke, Playwright chromium/firefox/webkit, LLM Eval Harness, Vercel Preview, Security Scan all pass.
- Main after merge — CI, Security Scan, E2E Tests, Deploy all success.

## 2026-06-20 ISO 14971 Risk Management — Issue #46 / PR #195

SPEC-REGULA-RISK-001 is implemented and merged. The feature introduces a
regulated workflow for ISO 14971 risk management file creation, with an explicit
human approval boundary for final legal/quality decisions.

| Area | State | Evidence |
|---|---|---|
| Workflow UI | Complete | `/workflows/risk`, `/workflows/risk/[runId]`, `components/risk/*` |
| BFF routes | Complete | `/api/ra/risk/runs`, `/identify`, `/items/[id]`, `/items/[id]/evaluate`, `/controls/recommend`, `/controls/[id]`, `/runs/[id]/gspr`, `/export`, `/approve` |
| Domain logic | Complete | `lib/risk/risk-evaluation.ts`, `residual-risk.ts`, `hazard-identification.ts`, `control-recommendation.ts`, `report-builder.ts` |
| DB schema | Complete | `risk_items`, `risk_controls`, `risk_gspr_mappings`, `risk_level`, `control_tier`, `workflow_type='risk'` |
| RBAC | Complete | `risk.generate`, `risk.view`, `risk.update`, `risk.approve`; approve is RA-lead only |
| Audit | Complete | `risk.hazard_identified`, `risk.matrix_evaluated`, `risk.item_deleted`, `risk.control_adopted`, `risk.residual_accepted`, `risk.gspr_mapped`, `risk.report_approved` |
| Report export | Complete | DOCX builder with ISO 14971 sections, GSPR mapping table, approval status, draft watermark |
| Documentation | Complete | `docs/risk-management.md`, API reference, architecture, env matrix, README |

Validation evidence:

- `corepack pnpm typecheck` — pass.
- `corepack pnpm exec biome check .` — pass.
- `corepack pnpm run lint:hex` — pass.
- `corepack pnpm test` — PR #195 baseline: 2,536 tests passed, 7 skipped; current review fix baseline: 2,556 tests passed, 7 skipped.
- `SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build` — pass.
- GitHub Actions on `8065cc8` — `CI`, `E2E Tests`, `Security Scan`, `Deploy` all success. Latest review baseline `b2bd5d1` had a Biome format-only failure, fixed in this pass.

Operational notes:

- E2E smoke jobs skip browser execution when no staging URL is configured; this is an intended CI branch behavior.
- Local Playwright browser execution requires installing Playwright browsers with `corepack pnpm exec playwright install chromium`.
- Build emits non-blocking optional extractor warnings for missing `mammoth`/`exceljs` and `pdf-parse` import shape in document extraction paths; `next build` still exits successfully.

## 2026-06-20 hybrid-ra-saas Typed Adapter — Issue #156 / PR #192

Regula now has a typed outbound integration layer for hybrid-ra-saas in
`lib/api/hybrid-ra-client.ts`. The adapter centralizes server-side env loading,
auth headers, tenant scoping, timeout handling, and error classification so BFF
routes do not hand-roll upstream fetch calls.

| Area | State | Evidence |
|---|---|---|
| Low-level wrapper | Complete | `createHybridRaFetch(timeoutMs?)` injects `Authorization`, `X-Tenant-Id`, JSON content type |
| Typed client | Complete | `createHybridRaClient()` exposes 7 named methods |
| Endpoint coverage | Complete | `/health`, `/sync/manifest`, `/rag/query`, `/documents/upload`, `/parse/jobs`, `/guardrail/run`, `/audit/export` |
| Error taxonomy | Complete | `unconfigured`, `auth`, `schema_mismatch`, `server_error`, `timeout`, `network` |
| Contract tests | Complete | `tests/unit/api/hybrid-ra-client.test.ts` has 15 tests |
| PR status | Merged | PR #192 squash merge `04b6333` |

Validation evidence:

- `corepack pnpm typecheck` — pass.
- `corepack pnpm exec biome check .` — pass.
- `corepack pnpm lint:hex` — pass.
- `corepack pnpm ci:format` — pass.
- `corepack pnpm test` — 2,556 tests passed, 7 skipped on the current review baseline.
- `corepack pnpm build` — pass.
- GitHub PR #192 checks — CI Gates, Playwright chromium/firefox/webkit, LLM Eval, E2E Smoke, Security Scan, Vercel Preview all pass.

## 2026-06-19 hybrid-ra-saas Webhook Hardening — Issue #188

hybrid-ra-saas now has three inbound push points into Regula:
`POST /api/webhooks/audit`, `POST /api/webhooks/ifu`, and
`POST /api/webhooks/knowledge-sync`. The endpoints authenticate with
shared-secret headers, validate payload shape with Zod, and return explicit
failure status codes instead of silently accepting bad input.

| Area | State | Evidence |
|---|---|---|
| Audit webhook | Complete | `X-Regula-API-Key`, audit payload schema, 202 Accepted |
| IFU webhook | Complete | `X-Regula-API-Key`, IFU extraction payload schema, 202 Accepted |
| Knowledge sync webhook | Complete | `X-Crawl-Push-Secret`, document array schema, 200 `{ received: true }` |
| Auth comparison | Hardened | SHA-256 digest normalization before `crypto.timingSafeEqual` |
| Bad JSON handling | Hardened | malformed JSON returns 400 `{ "error": "Invalid JSON" }` |
| Invalid payload handling | Hardened | Zod issues returned with 400 `{ "error": "Invalid payload" }` |
| Logging | Hardened | removed placeholder production `console.log`/TODO side effects |
| Regression coverage | Complete | `tests/unit/api/webhooks.test.ts`, `tests/unit/webauth/timing-safe.test.ts` |

Validation evidence:

- `./node_modules/.bin/biome check .` — pass.
- `./node_modules/.bin/biome format .` — pass.
- `./node_modules/.bin/tsc --noEmit` — pass.
- `./node_modules/.bin/vitest run` — 2,352 tests passed, 7 skipped at the Issue #188 hardening baseline.
- `./node_modules/.bin/next build` — pass.
- `node --experimental-strip-types scripts/qa/audit-completeness.ts` — known pre-existing audit gap remains in 4 non-webhook routes.

## 2026-06-19 E2E Validation & Documentation Update

| Area | State | Evidence |
|---|---|---|
| PR #184 | Merged | squash merge `a79759c` |
| PR #177 | Closed | stale/superseded; code already present on main |
| PR #186 | Merged | Predicate Visualization addendum complete |
| Issue #182 | Complete | E2E validation MRD published (`docs/e2e-validation-mrd.md`) |
| Issue #185 | Complete | Predicate Visualization PR #186 merged |
| Issue #164, #163 | Complete | Evidence/Authoring API BFF+UI integration |
| BFF routes | Complete | `/api/ra/traceability/scan`, `graph`, `impact` |
| Browser client/hooks | Complete | `traceabilityClient`, `useScanTraceability`, `useTraceGraph`, `useImpactAnalysis` |
| UI | Complete | `/workflows/traceability` scan, graph, impact tabs |
| RBAC | Complete | `traceability.scan`, `traceability.view`, `traceability.impact` |
| E2E validation | Complete | persona scenarios, Go/No-Go criteria, Smoke Test specs |
| Predicate Visualization | Complete | Bar/Radar/Table modes, Before-After comparison, demo animation |
| Documentation | Complete | E2E validation MRD, README updates, implementation status |

Verification evidence:

- `pnpm lint` — pass.
- `pnpm typecheck` — pass.
- `pnpm exec vitest run` — 222 files passed, 2,307 tests passed, 7 skipped at the PR #186 baseline.
- Issue #188 review validation — 2,352 tests passed, 7 skipped after webhook hardening.
- E2E Smoke Test — 8/8 specs passing (auth, consultation, citation, predicate, traceability, export, project, i18n).
- GitHub PR #186 checks — CI Gates, Lint, Typecheck, Unit tests all success.

## 2026-06-18 PR Cleanup Update

| Area | State | Evidence |
|---|---|---|
| PR #184 | Merged | squash merge `a79759c` |
| PR #177 | Closed | stale/superseded; code already present on main |
| BFF routes | Complete | `/api/ra/traceability/scan`, `graph`, `impact` |
| Browser client/hooks | Complete | `traceabilityClient`, `useScanTraceability`, `useTraceGraph`, `useImpactAnalysis` |
| UI | Complete | `/workflows/traceability` scan, graph, impact tabs |
| RBAC | Complete | `traceability.scan`, `traceability.view`, `traceability.impact` |
| E2E validation | Complete | persona scenarios, Go/No-Go criteria, RA Lead daily workflow docs/tests |
| PR #177 disposition | Complete | GitHub comment added, PR closed per Issue #18 stale-branch rule |

Verification evidence:

- `biome check .` — pass.
- `node scripts/no-hex-colors.mjs` — pass.
- `vitest run` — 222 files passed, 2,307 tests passed, 7 skipped at the 2026-06-18 cleanup baseline.
- GitHub PR #184 checks — CI Gates, LLM Eval Harness, Playwright chromium/firefox/webkit,
  Vercel preview, E2E Smoke, Dependency Vulnerability Scan, and gitleaks all success.

## 2026-06-19 Predicate Visualization Completion — PR #186

Issue #185 addressed the highest-priority E2E validation finding that Predicate
comparison was too text-heavy for investor/customer demos and technical
assessment review. The addendum keeps the existing approval table path intact
and layers an interactive visualization-first view into `/predicate/compare`.

COMPLETED — PR #186 merged to main.

| Area | State | Evidence |
|---|---|---|
| Compare page entry | Complete | `app/(app)/predicate/compare/page.tsx` imports `PredicateVisualization` and exposes `Show Interactive Visualization` |
| Visualization component | Complete | `components/predicate/PredicateVisualization.tsx` |
| View modes | Complete | Bar chart, Radar chart, Table view |
| Before-After mode | Complete | subject vs first predicate dimension comparison |
| Required/Optional distinction | Complete | required rows use brand token; optional rows use ink token in actual bar cells and legend |
| Demo animation | Complete | `animationPhase` drives Bar/Radar animation keys, duration, begin, and radar opacity |
| Accessibility refinement | Complete | table row click replaced with explicit dimension button |
| Lint hardening | Complete | no explicit `any`, no raw hex colors, no accumulator spread |
| Session history | Complete | `.moai/state/session-memo.md` restored previous records and appended PR #186 state |

Validation evidence:

- `pnpm lint` — pass.
- `pnpm typecheck` — pass.
- `pnpm exec vitest run tests/unit/components/predicate/PredicateComparePage.test.tsx tests/unit/predicate-schema.test.ts tests/unit/predicate-rbac.test.ts` — 45 tests pass.
- `git diff --check` — pass.

## Implementation Surface

| Surface | Count | Delta | Notes |
|---|---:|---:|---|
| App pages | 21+ | +2 risk | Added: `/workflows/risk`, `/workflows/risk/[runId]` |
| API route handlers | 44+ | +10 risk | Added: risk runs, identify, items, evaluate, controls, gspr, export, approve |
| Component files | 41+ | +4 risk | Added: RiskMatrix, HazardTable, ControlWizard, RiskApprovalGate |
| Library files | 200+ | +5 risk | Added: `lib/risk/*` domain modules |
| Test/spec files | 230+ | +8 risk | Risk unit/schema/BFF/E2E shape coverage |
| Playwright specs | 10+ | +2 risk | Added risk flow and risk RBAC specs |
| DB migrations | 58+ | +2 risk | 0057~0058 risk tables + enum/audit/permission alignment |

## CI Gate State

Latest reviewed `main` baseline `b2bd5d1` had one blocking CI regression: the
`CI Gates` job failed during `pnpm ci:lint` because three date-render files from
#166 needed Biome formatting. This review fixed the format drift in:

- `app/(app)/updates/digest/[weekId]/page.tsx`
- `app/(app)/workflows/esubmit/_components/ESubmitCard.tsx`
- `app/(app)/workflows/esubmit/_components/ESubmitDetail.tsx`

Local gates after the fix:

- `corepack pnpm exec biome check .` — pass.
- `corepack pnpm qa:gate-0 74` — pass; generated checklist output is ignored under `.moai/specs/_generated/`.
- `corepack pnpm test` — 2,556 tests passed, 7 skipped.
- `SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build` — pass, with existing optional extractor warnings for `mammoth`, `exceljs`, and `pdf-parse`.

Passed in `CI Gates`:

- Type check (0 errors)
- Lint (Biome clean)
- Format check
- Unit tests (2,556 passing locally after review fix)
- RBAC coverage
- Audit completeness
- Token symmetry
- i18n completeness
- Regulatory glossary
- Contrast check
- Module boundaries
- Migration sequence (0029–0032)
- Build

Passed workflow families:

- `CI`
- `E2E Tests`
- `Security Scan`
- `Deploy`

Important caveat:

- Some browser E2E child jobs skip actual browser execution when no staging URL is present. The skip is intentional and the workflow exits successfully.
- Local E2E execution requires Playwright browser installation.

## Wave 3 PREDICATE-001 Feature State

| Component | Path | REQ | Status |
|---|---|---|---|
| openFDA client | `lib/predicate/openfda-client.ts` | REQ-PRED-001~010 | ✅ |
| Cascade search | `lib/predicate/cascade-search.ts` | REQ-PRED-011~015 | ✅ |
| KV cache | `lib/predicate/cache.ts` | REQ-PRED-016~018 | ✅ |
| Comparison builder | `lib/predicate/comparison-builder.ts` | REQ-PRED-019~025 | ✅ |
| PDF export | `lib/predicate/pdf-builder.ts` | REQ-PRED-026~028 | ✅ |
| DOCX export | `lib/predicate/docx-builder.ts` | REQ-PRED-029~030 | ✅ |
| Search API | `app/api/ra/predicate/search/route.ts` | REQ-PRED-005~008 | ✅ |
| Comparison API | `app/api/ra/predicate/comparison/route.ts` | REQ-PRED-019~022 | ✅ |
| Approve API | `app/api/ra/predicate/comparison/[id]/approve/route.ts` | REQ-PRED-033 | ✅ IDOR fixed |
| Export API | `app/api/ra/predicate/export/route.ts` | REQ-PRED-026~030 | ✅ |
| Search page | `app/(app)/predicate/search/page.tsx` | — | ✅ |
| Compare page | `app/(app)/predicate/compare/page.tsx` | — | ✅ |
| History page | `app/(app)/predicate/history/page.tsx` | — | ✅ |
| Visualization addendum | `components/predicate/PredicateVisualization.tsx` | SPEC-PREDICATE-VIS-001 | ✅ PR #186 merged |

## Open Work Classification

| Lane | Count | Issues |
|---|---:|---|
| Governance | 2 | #1, #18 |
| Wave 3 — next | 2 | #23 (CER-001), #24 (PCCP-001) |
| Wave 3 — remaining | 21 | #35~#43, #47, #48, #50, #51, #52, #55, #58~#62 |
| Wave 4 | 11 | #25, #44, #45, #49, #53, #54, #56, #57, #63~#65; #46 complete |
| Wave 5 | 16 | #66~#72, #84~#92 |
| Pending PRs | 0 | all active work completed |

## Current Blockers

1. No active blockers — all feature branches merged.
2. Wave 3 next implementation (#23 CER-001, #24 PCCP-001) awaiting resource allocation.
3. E2E Integration Tests (Level 2) require staging environment deployment.

## Next Priority

| Priority | Work | Reason |
|---|---|---|
| P0 | Deploy staging environment | enable Level 2 Integration Tests |
| P1 | Begin #23 SPEC-REGULA-CER-001 (EU MDR Clinical Evaluation Report) | Wave 3 next SPEC |
| P1 | Begin #24 SPEC-REGULA-PCCP-001 (FDA PCCP builder) | Wave 3 next SPEC |
| P2 | Execute Level 2 Integration Tests | validate RA Lead daily workflow |
| P2 | Monitor Customer Local Runtime rollout (#191) | hybrid-ra-saas deployment dependency |
| P3 | Begin Wave 3 remaining SPECs | #35~#43, #47, #48, #50~#62 |

---

## Codebase Analysis Update (2026-06-19)

### Latest Documentation Updates

**Documentation Completeness**:
- E2E validation MRD: `docs/e2e-validation-mrd.md` — Persona Go/No-Go criteria, Smoke Test specs, validation framework
- README.md updates: Predicate visualization demo, Evidence/Authoring integration, E2E execution methods
- Implementation status: Updated with all completed PRs (#184, #186) and E2E validation framework
- Persona analysis: `docs/persona-deep-dive-analysis.md` — 3-user deep dive with quality addendum

**Project Health Metrics**:
- TypeScript files: 377 (stable)
- API routes: 67 (stable)
- Database tables: 18 (includes new predicate tables)
- Test coverage: 2,556 tests passing, 7 skipped on the current review baseline (239 passed test files, 1 skipped)
- E2E specs: 8 Smoke Test specs complete, 3 Integration Test specs in progress

**Wave 3 Status**:
- PREDICATE-001: Complete (PR #126, PR #186 addendum)
- Traceability Integration: Complete (PR #184)
- E2E Validation Framework: Complete (Issue #182)
- Next: CER-001 (#23), PCCP-001 (#24)

### Latest Architecture Documentation

**Project Scale Analysis**:
- TypeScript files: 377 (updated from baseline)
- API routes: 67 (stable across Wave 3)
- Database tables: 18 (includes new predicate tables)
- lib modules: 27 (comprehensive coverage)
- components categories: 11 (full UI coverage)

**Architecture Documentation Updates**:
- `.moai/project/codemaps/overview.md` - Updated with 2026-06-17 timestamp
- `.moai/project/codemaps/modules.md` - 12 core modules documented
- `.moai/project/codemaps/dependencies.md` - 110+ dependencies analyzed
- `.moai/project/codemaps/entry-points.md` - 67 API routes catalogued
- `.moai/project/codemaps/data-flow.md` - RAG pipeline and data flows documented

**README.md Integration**:
- Added codebase analysis section with project scale metrics
- Integrated architecture overview with latest module structure
- Updated technical stack breakdown with current versions
- Connected documentation references for detailed architecture

**Documentation Status**:
- ✅ README.md - Updated with codebase analysis
- ✅ docs/architecture.md - Enhanced with latest codebase metrics
- ✅ docs/implementation-status.md - This file updated
- ✅ `.moai/project/codemaps/` - All 5 codemap files current |
