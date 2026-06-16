# Session Memo

## P1: Session Context

session_id: current
cwd: /home/abyz-lab/work/workspace-github/holee9/ra-med-bot
branch: feat/issue-158-persona-85-overhaul
updated: 2026-06-15

## P2: Work Gate

Issue #18 remains the mandatory preflight for every issue, SPEC, branch, PR, or implementation task.

Current verified state:

| Item | State |
|---|---|
| verified implementation commit | `f156124` |
| current implementation review baseline | `f156124` |
| active branch | `main` |
| local dirty files | none |
| existing open PRs | none |
| stale remote branches | none — 6개 정리 완료 (2026-06-02, #124) |

## P3: Wave 3 Pipeline (현재 진행)

| Step | Issue | State | Next action |
|---|---|---|---|
| 1 | #52 notifications | MERGED #123 | 완료 |
| 2 | #84 refine | MERGED #122 | 완료 |
| 3 | #85 confidence | MERGED #121 | 완료 |
| **4** | **#22 PREDICATE-001** | **Gate 0 PASS** | **브랜치 생성 → SPEC 작성 → 구현** |
| 5 | #23 CER-001 | open | #22 이후 |
| 6 | #24 PCCP-001 | open | #22 이후 |
| 7 | #35~#43, #47~#51, #55, #58~#62 | open | Wave 3 나머지 20개 |

## P4: Implementation Review (f156124 기준)

| Item | State |
|---|---|
| review baseline | `f156124` |
| app pages | 20 |
| API route handlers | 35 |
| test/spec files | 185 |
| Playwright specs | 14 |
| latest CI | success; core gates passed |
| Playwright CI | staging URL 없어 skip 유지 |
| local E2E (#80) | Docker stack 가용 (previously unblocked) |

## P5: 2026-06-02 정비 완료 항목

| 항목 | 결과 |
|---|---|
| stale 브랜치 6개 삭제 (#124) | 완료 — origin/main 단독 존재 |
| Gate 0 베이스라인 갱신 | `847e95c` → `f156124`, docs/qa/gate-0-spec-readiness.md |
| #22 QA plan 코멘트 | 등록 완료 → Gate 0 PASS |
| FOUNDATION-001 status | draft → completed |
| STRUCTURED-001 status | draft → completed |
| CLOUDFLARE-001 #9 | 재오픈 (Wave 4) |
| hermes-ra #35 (3계층 E2E) | 신규 등록 |
| hermes-ra #36 (extract_mail_qa) | 신규 등록 |

## P6: 다음 즉시 실행

```bash
cd ~/work/workspace-github/holee9/ra-med-bot
git checkout -b feat/issue-22-predicate
# → /moai run SPEC-REGULA-PREDICATE-001
```

## P7: 2026-06-13 Persona 85% Quality Addendum

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| primary tracking issue | #158 |
| linked quality risks | #149 audit enum/type gate, #150 source RBAC boundary, #151 sync upload redaction |
| knowledge boundary | GitHub `ra-project`, GitHub `MD-process`, Gitea `ra-llm-wiki` are read-only upstream knowledge sources; operational issues must be filed back to owning projects instead of modifying their source here |
| SaaS backend linkage | GitHub `SaaS RA` remains an external backend integration target; this repo should enforce safe UI/API boundaries before integration |

3회 교차검증 결과:

| Pass | Result |
|---|---|
| 1 | `AuditAction` union과 `auditActionEnum` 불일치 확인. `standards_*`, `device_classified` 누락으로 `tsc --noEmit`가 실패하던 blocker를 schema enum과 테스트 동기화로 보완 |
| 2 | Admin sync document upload가 Inngest redaction path를 공유하지 않아 PII가 chunk/embed/persist 경로로 흐를 수 있던 문제를 공용 `redactPiiForIngest()`로 보완 |
| 3 | Source list/detail과 digest share route를 실제 사용자 경계로 재검토. 조직 소유 source cross-tenant 조회를 차단하고, digest는 token 없는 조회를 거부하도록 보완 |
| 4 | 홈/지식/상담/문서관리 UI에 RA 실무자, RA Lead, 지식 관리자, 시스템 관리자 기준의 진입점과 신뢰 경계 표시를 반영 |

검증:

| Command | Result |
|---|---|
| `node scripts/qa/check-rbac.mjs` | pass |
| `tsc --noEmit` | pass |
| `node scripts/no-hex-colors.mjs` | pass |
| related Vitest suite | 14 files / 213 tests pass |
| changed-file Biome check | pass |
| `git diff --check` | pass |
| local dev server | `http://127.0.0.1:3000` ready, unauthenticated home redirects to `/login` |

## P8: 2026-06-15 T3610 Access / Cloudflare 502 Gate

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| #18 work gate | checked; no new implementation branch created for this ops diagnosis |
| tracking issue | #159 |
| follow-up issue | #160 T3610 native Cloudflare connector migration |
| main reference | `243fcda` |
| current Next listener | `0.0.0.0:3000`, `next-server` PID `1913371` |
| Tailscale validation URL | `http://100.119.79.28:3000` |
| Tailscale validation result | `307` redirect to `/login` |
| Cloudflare public URL | `https://regula.abyz-lab.work/` |
| Cloudflare public result | fixed: `307` to `/login`; `/login` returns `200` |
| cloudflared host service | `raspi5p:cloudflared.service` active |
| Cloudflare tunnel origin | `http://100.119.79.28:3000` |
| T3610 `NEXTAUTH_URL` | `https://regula.abyz-lab.work` in `.env.local`; dev server restarted |
| doc update scope | `docs/runbook.md`, `docs/deployment/dns-setup.md`, `docs/setup/ubuntu-onpremise-guide.md` |

Decision: `regula.abyz-lab.work` is served by `raspi5p` Cloudflare Tunnel and forwards to T3610 over Tailscale for validation. The previous 502 was caused by the ingress service pointing at `http://localhost:4000` on `raspi5p`. Later steady-state migration to `Browser -> Cloudflare -> T3610 cloudflared -> http://127.0.0.1:3000` is tracked in #160.

## P9: 2026-06-15 Guest E2E Validation Goal

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| #18 work gate | checked before E2E validation; no new branch/PR created |
| main reference | `243fcda` |
| public validation URL | `https://regula.abyz-lab.work/login` |
| validation account | `guest@regula.local` (`ra-lead`, `active`, `Test Org`) |
| account secret handling | password intentionally not recorded in git/GitHub docs/issues |
| task scope | full app E2E from login, route/function behavior, response timing, improvement report |

Validation result:

| Area | Result |
|---|---|
| runtime fix | Restarted public dev server with `.env.local` loaded and without `SKIP_ENV_VALIDATION`; guest login restored |
| smoke/auth E2E | 8/8 passed against `https://regula.abyz-lab.work` |
| full Playwright E2E | 68/74 passed on first full run; 6 failed |
| project-switch follow-up | guest org initially had 0 projects; after seeding 2 validation projects, `project-switch.spec.ts` passed 4/4 |
| predicate follow-up | 9/12 passed; remaining failures are selection/hydration flake, query mock miss, and strict `role=alert` locator collision |
| route sweep | 26/27 rendered or redirected as expected; `/workflows/digest` returned 500 |
| API/function probe | core auth/chat/source/predicate/project paths worked; Wave 3+ workflow APIs exposed DB migration drift and audit enum drift |
| readiness judgment | current real-user validity is below 85%; estimated 65-70% until migration/RBAC/predicate/onboarding issues are fixed |

Issues filed from this validation:

| Issue | Scope |
|---|---|
| #161 | P0 DB migration drift causing workflow/API 500s |
| #162 | P1 RBAC: `ra-lead` can access audit logs |
| #163 | P1 onboarding/E2E: guest org project seed/empty-state |
| #164 | P1 Predicate selection/history/RBAC alert instability |
| #165 | P1 ops/auth: `SKIP_ENV_VALIDATION` runtime login failure |
| #166 | P2 performance/hydration: public dev latency and hydration mismatch |

## P10: 2026-06-16 Quality Recovery Plan / Work Prep

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| #18 work gate | checked again before planning; stale branch merge remains prohibited |
| main reference | `243fcda` (`origin/main`, fetched 2026-06-16) |
| current branch PR | none open |
| planning issue | #167 `[P0][Quality Recovery Plan] E2E 실증 기반 85%+ 완성도 회복 실행 계획` |
| linked defect issues | #161, #162, #163, #164, #165, #166 |
| issue linkage | #161-#166 each received a comment pointing to #167 as the execution gate |
| secret handling | guest/admin passwords still not recorded in git/GitHub docs/issues |

Execution order:

| Gate | Target | Reason |
|---|---|---|
| 1 | #161 DB migration drift | P0 blocker; workflow/API 500s invalidate downstream E2E results |
| 2 | #162 RBAC/audit-log policy | Compliance/security boundary must match UI/API/tests |
| 3 | #163 guest onboarding/project bootstrap | New users currently fail project-switch without seed data |
| 4 | #164 Predicate deterministic journey | Core RA value flow must be stable under E2E and real interaction |
| 5 | #165 public dev start guard | Prevent login outage from `SKIP_ENV_VALIDATION` runtime use |
| 6 | #166 performance/hydration | Stabilize public validation signal and console hygiene |
| 7 | 3-repeat validation | Full Playwright, API probe, route sweep, RBAC matrix, persona validity >=85% |

Next implementation should start from #161. Before editing, split work by issue/files and preserve existing branch changes; do not overwrite unrelated user edits.

## P11: 2026-06-16 Quality Recovery Batch Implementation

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| #18 work gate | rechecked; main reference still `243fcda`; current branch open PR none |
| planning issue | #167 |
| implemented gates | #161 static drift guard, #162 admin-only audit/admin policy, #163 project bootstrap/empty CTA, #164 Predicate E2E deterministic mock/locator, #165 runtime env guard/public start script, #166 analytics/hydration/runbook cleanup |
| preserved changes | existing dirty branch changes were not reverted |

Implementation notes:

| Gate | Result |
|---|---|
| #161 | Added required Wave 3+ table and audit-action regression checks to enterprise migration tests. Existing schema exports already include the issue table set and audit action set. |
| #162 | Aligned audit-log API/page and admin section route guard to admin-only. RBAC matrix script now rejects accidental `ra-lead` access to admin pages. |
| #163 | Added idempotent Playwright global setup project bootstrap for `Guest Validation Alpha/Beta`. Added sidebar empty-state CTA to create a default validation project. |
| #164 | Predicate E2E now intercepts query-string comparison URLs, waits deterministically for compare navigation, and scopes RBAC alert checks to the app content area. |
| #165 | Runtime `SKIP_ENV_VALIDATION=1` now fails unless explicitly allowed by build. Added `pnpm dev:public` preflight script and docs. |
| #166 | Disabled Vercel Analytics outside production opt-in and made key date rendering use explicit `Asia/Seoul` formatting. Runbook now includes warm-up and latency targets. |

Verification:

| Command | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm ci:rbac` | pass |
| `pnpm ci:migrations` | pass |
| related Vitest suite | 335 tests pass |
| API route focused Vitest suite | 78 tests pass |
| full Vitest with `--testTimeout=10000` | 219 files pass, 1 skipped; 2229 tests pass, 7 skipped |
| changed-file Biome check | pass |
| `pnpm lint` | blocked by pre-existing repository-wide Biome diagnostics in unrelated `__tests__` files; changed-file Biome check passes |
| `pnpm ci:audit` | blocked by 18 existing mutating route audit coverage violations outside this batch's access-policy alignment |
| Playwright install/run | blocked: Playwright does not support bundled Chromium install on `ubuntu26.04-x64`; no system Chrome/Firefox found |

Remaining blockers:

- Full E2E/API/route/RBAC/persona 3-repeat validation could not be completed in this local environment because no supported Playwright browser is available.
- `pnpm ci:audit` still requires broader audit-write coverage work across mutating routes.
- Live DB migration drift must still be verified against the actual public validation DB, not only static schema/migration tests.

## P12: 2026-06-16 Audit Recovery Completion and Repeat Validation

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| main reference | `243fcda70541fda42cd4cb903e5dedfadeb5de67` (`origin/main`) |
| current branch PR | none open at gate check |
| planning issue | #167 |
| linked defect issues | #161, #162, #163, #164, #165, #166 |
| work gate | #18 duplicate-work prevention rechecked before implementation; no stale branch merge performed |

Additional implementation:

| Area | Result |
|---|---|
| Audit static gate | `scripts/qa/audit-completeness.ts` now recognizes approved domain audit wrappers (`auditCer*`, `auditPccp*`, vigilance audit helpers, impact analyzer) instead of requiring duplicate direct `writeAudit()` calls in routes that already delegate to audited orchestrators. |
| Direct route audit writes | Added PII-safe audit writes to predicate cache clear, admin user status change, password change, signup, DHF input/verification creation, eSubmit interactions, notification preference update, predicate comparison approval, SaMD artifact generation, CER literature SSE persistence, and PCCP export. |
| Audit tests | Added audit-wrapper coverage test and extended predicate cache clear route test to assert audit write behavior. |

Verification:

| Command | Result |
|---|---|
| changed-file Biome check | pass |
| `pnpm ci:audit` | pass |
| `pnpm vitest run tests/unit/qa/audit-completeness.test.ts --testTimeout=10000` | 12 tests pass |
| `pnpm typecheck` | pass |
| `pnpm ci:rbac` | pass |
| `pnpm ci:migrations` | pass |
| full Vitest `pnpm vitest run --testTimeout=10000` | 219 files pass, 1 skipped; 2230 tests pass, 7 skipped |
| executable 3-repeat validation | 3/3 pass for `ci:rbac`, `ci:migrations`, `ci:audit`, and API/route/RBAC/persona-adjacent focused Vitest suite (20 files, 298 tests each iteration) |
| `pnpm lint` | still blocked by pre-existing repository-wide Biome diagnostics in unrelated `__tests__` files; changed-file Biome check passes |
| Playwright browser install | blocked: `Playwright does not support chromium on ubuntu26.04-x64`; no system Chrome/Firefox found |

Residual blockers:

- Full browser E2E 3-repeat validation remains blocked by the local OS/browser support gap. It must be rerun on a supported Playwright runner or with a compatible system browser installed.
- Live DB migration drift still needs confirmation against the actual public validation database; local static migration/schema guards pass.

## P13: 2026-06-16 Browser E2E Recovery and Final Gate Pass

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| main reference | `243fcda70541fda42cd4cb903e5dedfadeb5de67` (`origin/main`) |
| current branch PR | none open at gate check |
| planning issue | #167 |
| linked defect issues | #161, #162, #163, #164, #165, #166 |
| work gate | #18 duplicate-work prevention rule already rechecked; no stale branch merge performed |

Additional implementation:

| Area | Result |
|---|---|
| Browser runner | Used system Chromium at `/usr/bin/chromium-browser` because bundled Playwright Chromium is unsupported on this Ubuntu runner. |
| E2E database | Created isolated local PostgreSQL/pgvector container on host port `55433`; did not touch the existing `5433` container. |
| Schema push drift | Fixed Drizzle schema-push drift for array defaults, pgvector custom type rendering, and UUID FK columns surfaced by clean DB push. |
| Playwright global setup | Added absolute API URL construction, admin auth state generation, and seeded admin user support for admin-only audit tests. |
| E2E stabilization | Serialized stateful specs, added deterministic Playwright route fixtures for UI-only refine/notification/status-transition checks, stabilized i18n load assertions, and added predicate history test IDs. |
| Audit E2E | Seeded deterministic `chat.query` audit fixture and verified append/read contracts with direct DB and admin API paths. |

Verification:

| Command | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm ci:rbac` | pass |
| `pnpm ci:migrations` | pass |
| `pnpm ci:audit` | pass |
| full Vitest `pnpm vitest run --testTimeout=10000` | 219 files pass, 1 skipped; 2232 tests pass, 7 skipped |
| full Chromium E2E repeat 1 | 74/74 pass |
| full Chromium E2E repeat 2 | 74/74 pass |
| full Chromium E2E repeat 3 | 74/74 pass |
| latest E2E JUnit | `tests="74" failures="0" skipped="0" errors="0"` |
| changed-file Biome checks | pass |

Residual notes:

- `pnpm lint` was not rerun as a final gate because earlier runs were blocked by pre-existing repository-wide Biome diagnostics in unrelated `__tests__` files; changed-file Biome checks passed.
- The isolated E2E DB is local-only. Production/public validation DB migration drift still needs live-environment confirmation if required by release process.

## P14: 2026-06-16 MoAI Team/Worktree Hook PATH Recovery

| Item | State |
|---|---|
| active branch | `feat/issue-158-persona-85-overhaul` |
| main reference | `243fcda70541fda42cd4cb903e5dedfadeb5de67` (`origin/main`, fetched before patch) |
| current HEAD | `39c994ca42b9d91ebff024479f4eaf59300beafd` |
| current branch PR | none open; no matching `issue-158`/persona PR found |
| related issue context | #158 active branch context checked; #18 duplicate-work prevention rule rechecked |
| stale branch handling | no stale branch merge performed |

Root cause:

- `.claude/settings.json` exported a Windows-style semicolon `PATH` into a Linux shell.
- POSIX shells treat semicolons as command separators, not path separators, so `/usr/bin`, `/bin`, and `/usr/local/bin` were not searchable.
- The visible failure (`/bin/sh: 1: node: not found`) was therefore an environment propagation bug, not a missing Node installation. With a normalized path, local Node is available as `/usr/bin/node` (`v22.22.2`).
- Worktree hook fallback also inherited the broken environment before invoking `moai`, causing WorktreeCreate to return no usable worktree path and triggering single-agent fallback.

Patch:

- Replaced `.claude/settings.json` `PATH` with a Linux/WSL-safe colon-delimited path.
- Added defensive `PATH` normalization to team/worktree hook wrappers:
  - `.claude/hooks/moai/handle-worktree-create.sh`
  - `.claude/hooks/moai/handle-worktree-remove.sh`
  - `.claude/hooks/moai/handle-teammate-idle.sh`
  - `.claude/hooks/moai/handle-agent-hook.sh`
- Fixed `handle-agent-hook.sh` argument parsing from a literal-safe but shell-broken form to `${1:-}`.

Verification:

| Check | Result |
|---|---|
| `.claude/settings.json` JSON parse | pass |
| patched hook shell syntax | pass |
| polluted PATH lookup after hook normalization | `node`, `git`, and `moai` all resolve |
| empty stdin hook smoke | no `node: not found`; command exits non-zero only because the payload is intentionally empty |

Follow-up:

- Restart the Codex/Claude Code session once so the fixed `.claude/settings.json` environment is loaded by the parent process before the next team-mode run.
