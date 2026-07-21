# Progress — SPEC-V3-RESTRUCTURE-001 (v1.1.0 kernel-only 재스코프)

> Run-phase tracking. SSOT for execution: tasks.md (B1~B7 + T8~T16).
> Branch: `feat/v3-restructure-001` (commits accumulate on branch; PR by orchestrator via manager-git post-sync).

---

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready (PASS 0.862, Tier L 임계 0.85) — 2026-07-21
- plan_complete_at: 2026-07-21
- plan_auditor_verdict: PASS (13개 수치 독립 재검 zero divergence)
- implementation_kickoff_approval: granted (이전 세션)
- artifacts: spec.md (22952B, v1.1.0), tasks.md (12419B, SSOT). plan.md/acceptance.md/design.md/research.md: absent (Tier L normally 5 artifacts; plan-phase passed with spec+tasks only per orchestrator judgment).

---

## §E.2 Run-phase Evidence

### Live baseline (오케스트레이터 직검 2026-07-21 — 본 run-phase 게이트 판정 기준)

| Metric | Value | Source |
|---|---|---|
| 회귀 테스트 | 5450 passed / 68 skipped / 0 failed (5518 total, 59.93s) | `pnpm test` live |
| FK references | **274** | `grep -h REFERENCES migrations/*.sql \| wc -l` (project-root `migrations/`) |
| migration files | **125** | `ls migrations/*.sql \| wc -l` (project-root `migrations/`) |
| archive domains | **8** (change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows) | `ls archive/qms-pms/lib/` |
| archive manifest | domain_count=8, total_files=148 | `.archive-manifest.json` |
| typecheck baseline | exit 0 (0 errors) | `pnpm typecheck` live 2026-07-21 (manager-develop 직검) |

### 듀얼 migration 디렉토리 발견 (B1 ANALYZE)

- **project-root `migrations/`**: 125 .sql files, 274 FK — **canonical migration chain** (T0.2 baseline). B1~B7 전단계에서 미접촉 (보존).
- **`lib/kernel/db/migrations/`** (B1 이동 전 `lib/db/migrations/`): 2 .sql files, 64 FK — drizzle-kit `out:` target (작업 디렉토리). schema.ts(94 pgTable)와는 별도의 chain.
- AC-04 "FK 274 보존"은 project-root `migrations/` 기준 — B1~B7에서 미접촉하므로 자명하게 보존.

### AC PASS/FAIL matrix (run-phase 진행에 따라 갱신)

| AC | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| AC-01 | kernel 추출 후 typecheck/lint/test green (5450+ 유지) | PENDING | B5 게이트 |
| AC-02 | N/A (Phase A 완료) | N/A | — |
| AC-03 | kernel↔domain 순환 의존성 0건 | PENDING | B6 게이트 |
| AC-04 | drizzle-kit check 통과 + FK 274 보존 | PENDING | B2/B3 게이트 (FK 274는 project-root migrations/ 미접촉으로 자명 보존) |
| AC-05 | migration 125 files 불변 | PASS (B1) | project-root migrations/ pristine 확인 (125/274, git changes 없음) |
| AC-06 | archive 8도메인 + manifest 유지 | PASS (B1) | archive/qms-pms/lib/ 8도메인, manifest domain_count=8 유지 |
| AC-07 | schema.ts 아카이브 8도메인 @deprecated 주석 | PENDING | B7 보완 |
| AC-08 | N/A (KEEP 재분류) | N/A | — |
| AC-09 | codemod 289 파일 누락 0 (정적+동적+배럴) | PENDING | B5 게이트 |
| AC-10 | next dev 페이지 로드 500 에러 0 | PENDING | B6 게이트 |
| AC-11 | kernel/index.ts REQ-V3R-012 re-export 포함 | BLOCKED (B4) | ANALYZE 발견: spec T11.1 export 이름 다수 부재 (B4 재검증 예정) |

### Sub-phase 진행

| Sub | 게이트 | 결과 | 비고 |
|---|---|---|---|
| B1 (T8.1-T8.8) | git mv 성공 + typecheck(codemod 후 B5 해결) | PASS (git mv) | 6모듈 이동, rename detection 정상, project-root migrations/ pristine |
| B2 (T9.x) | drizzle-kit check FK 274 | PENDING | 최고 risk — schema-kernel.ts 발췌 |
| B3 (T10.x) | generate --dry 무의도 diff 0 + check FK 274 | PENDING | config array 전환 (신규 배선) |
| B4 (T11.x) | kernel/index.ts re-export + typecheck | **BLOCKED** | REQ-V3R-012 export 이름 다수 부재 (getSession/requireRole/writeAudit/verifyHashChain/rateLimit/uploadAsset) — B4 진입 시 재검증 후 blocker report 예정 |
| B5 (T12.x) | codemod 누락 0 + typecheck/lint/test green | PENDING | 289 파일 (동적 import 55건 포함) |
| B6 (T13.x) | 순환 0 + next dev 500 없음 | PENDING | — |
| B7 (T14.x) | @deprecated 8도메인 분 | PENDING | Phase A #530 누락 보완 |

---

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: pending
run_commit_sha: pending
run_status: in-progress
ac_pass_count: 2       # AC-05, AC-06 (B1 완료 기준)
ac_fail_count: 0
preserve_list_post_run_count: pending
m1_to_mN_commit_strategy: per-subphase-individual-commits
```

---

## §E.4 Sync-phase Audit-Ready Signal

(left for manager-docs — single sync commit carries implemented → completed)

---

## §F Phase 4 Mode Selection

- tier: L
- cycle_type: ddd (per quality.yaml development_mode + orchestrator delegation)
- mode: sub-agent (Mode 5 — sequential, coding-heavy per Anthropic coding-task parallelism caveat)
- rationale: kernel 추출은 coding-heavy + 다중 파일 의존성 + 순차적 게이트 검증이 필요. Mode 4 (parallel)은 연구/리뷰에 적합하나 본 SPEC은 구현 작업이므로 Mode 5. Mode 6 (workflow) 제외 — 다중 규칙 변환 + inter-file 의존성 (schema FK web).

---

## §H Run-phase Notes

### ANALYZE 발견사항 (B4 관련 — 추후 blocker 보고 예정)

spec T11.1 / REQ-V3R-012가 명시한 kernel/index.ts re-export 항목 중 다수가 codebase에 부재:
- `getSession` — lib/auth/에 export 부재 (getSessionAdapter는 있으나 다른 개념)
- `requireRole` — lib/auth/ 전수 부재
- `writeAudit` — lib/audit/에 export 부재 (주석 참조는 있으나 실체 부재)
- `verifyHashChain` — lib/audit/ 부재 (verify-chain.ts + verifyAuditChain는 존재)
- `rateLimit` — lib/ratelimit/cloudflare-kv.ts 부재
- `uploadAsset` — lib/storage/r2.ts 부재 (R2Client class만 존재)

REQ-V3R-004 (kernel은 re-export thin wrapper, 새 추상층 금지)와 충돌: 존재하지 않는 export를 re-export할 수 없음. B4 진입 시 최종 grep 후 blocker report 예정.
