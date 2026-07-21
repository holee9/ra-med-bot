---
id: SPEC-V3-RESTRUCTURE-001
version: 1.1.0
status: in-progress
phase: restructure
priority: High
created: 2026-07-02
updated: 2026-07-21
author: manager-spec
issue_number: 531
depends_on:
  - SPEC-REGULA-PHI-REMOVAL-001 (PHI 제거 완료 후 아카이브 잔여 도메인 정리)
supersedes: []
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/schema
  - component/structure
  - type/restructure
  - type/kernel
  - domain/architecture
---

# SPEC-V3-RESTRUCTURE-001 — v3 구조 정리 (Phase B: lib/kernel/ 추출 + schema.ts 분할 — kernel-only 재스코프, Phase A 8도메인 아카이브 완료)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-02 | manager-spec | 초기 작성. Phase C-2 완료(4도메인 아카이브) 후 잔여 14도메인 + kernel 추출 + schema 분할을 다룸. 마스터 계획 `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` 기반. |
| 1.1.0 | 2026-07-21 | manager-spec (rescope, #531) | kernel-only 재스코프. Phase A(#530) 8도메인 아카이브 완료로 잔여 아카이브 태스크 제거. 수치 직검 정정(baseline 4815→5450, codemod 178→289, FK 261→274, migration 106→125, pgTable 86→94, schema 3232→3531). drizzle 선례 거짓 정정(신규 배선). |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula v3 아키텍처 개편 중 **Phase B(kernel 추출 + schema 분할)** 만을 다룬다. **Phase A(아카이브)는 #530/PR #534로 종료**되었다: 8도메인(change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows)이 `archive/qms-pms/`로 이동 완료되었고 `.archive-manifest.json`(domain_count=8, total_files=148)이 생성되었으며 회귀 테스트는 green(5450 passed, 0 failed, 68 skipped)이다.

본 SPEC은 공유 인프라(db/auth/audit)를 `lib/kernel/`로 추출하고, 단일 `schema.ts`(3,531줄, 94 pgTable)를 다중 파일로 분할한다. 마스터 계획은 이를 계층 2.5(kernel/domain/archive 3-tier)로 정의한다.

**Drizzle 다중 스키마 파일 glob 로드(신규 배선 — 현재 `drizzle.config.ts`는 단일 `'./lib/db/schema.ts'` 참조, `schema-docingest.ts` 미배선, 선례 아님).** Phase B에서 이를 array 형태로 신규 전환한다.

### 1.2 Phase A 상태 — 완료 (#530/PR #534, 8도메인)

**Phase A 완료(#530/PR #534)**: 8도메인 아카이브 — change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows. `.archive-manifest.json` 갱신(domain_count=8, total_files=148). 회귀 baseline 5450 passed, 0 failed, 68 skipped (live run 2026-07-21).

**잔여 QMS 인접 도메인은 #519 오케스트레이터 판정상 KEEP 재분류**되어 본 SPEC 범위에서 제외된다. `ls lib/` 직검(2026-07-21)으로 라이브 보존 확인:
- `lib/rlhf/`, `lib/knowledge-gap/`, `lib/risk/`, `lib/pccp/`, `lib/traceability/`, `lib/knowledge-promo/`, `lib/model-governance/`, `lib/standards/`, `lib/project-memory/`, `lib/corpus-license/` — 전부 LIVE (KEEP)
- `lib/classification/`, `lib/classify/`, `lib/domains/`, `lib/ai/`, `lib/radar/`, `lib/ingest/` 등 — v3 활성 도메인 (KEEP)

**pccp는 #521에 따라 규제 제출물(QMS 아님)로 라이브 보존**된다(아카이브 등재 삭제). 잔여 도메인 처분은 별도 거버넌스 결정이며, 본 kernel-only 재스코프에서는 다루지 않는다.

> **주의**: 본 SPEC v1.0.0의 "잔여 14도메인 아카이브 + SHRINK(rlhf/knowledge-gap)" 계획은 Phase A의 8도메인 완료와 잔여 도메인 KEEP 재판정으로 무효화되었다. 본 v1.1.0에서는 kernel 추출(Phase B)만 다룬다.

### 1.3 Phase B 대상 — kernel 추출 + schema 분할

**lib/kernel/ 추출** (공유 인프라 경계 확립):

| 현재 위치 | 이동 위치 | 참조 파일 수 (직검 2026-07-21) | 역할 |
|---|---|---|---|
| `lib/db/` | `lib/kernel/db/` | 174 | DB 클라이언트, schema-kernel |
| `lib/auth/` | `lib/kernel/auth/` | 181 | Auth.js v5, RBAC |
| `lib/audit/` | `lib/kernel/audit/` | 119 | writeAudit, append-only |
| `lib/ratelimit/` | `lib/kernel/ratelimit/` | 0 | KV ratelimiter (kernel re-export만 유지, codemod 비대상) |
| `lib/storage/` | `lib/kernel/storage/` | 0 | Object storage (kernel re-export만 유지, codemod 비대상) |
| `lib/schemas/` | `lib/kernel/schemas/` | 4 | Zod 공유 스키마 (codemod 대상 포함) |

**schema.ts 분할** (Drizzle 다중 스키마 파일 — 신규 전환, 선례 아님):

| 파일 | 내용 | 테이블 수 (직검) |
|---|---|---|
| `lib/kernel/db/schema-kernel.ts` | kernel 테이블 — 직검 식별된 export: `users`(L668), `auditLogs`(L1285, table `audit_logs`), `sessions`(L1537). `verificationTokens`(L1567)은 kernel 후보(run phase에서 확정). 명목 ~3-4 테이블. | 3-4 |
| `lib/db/schema.ts` (레거시) | KEEP 도메인 + 아카이브 도메인 테이블 (감소 상태 유지, `@deprecated` 주석 — Phase A 미적용 상태) | ~90 |

> **주의**: 본 SPEC v1.0.0의 "kernel 테이블 ~5개(users, audit_log, audit_verify_history, sessions)" 추정치는 직검 결과 정정된다. `audit_verify_history` 테이블은 존재하지 않으며, 가장 가까운 것은 `verificationTokens`(L1567)이다. kernel 테이블 확정 집합과 수는 run phase B2에서 사전 grep으로 최종 확정한다. 본 SPEC에서는 kernel 테이블 분할(Phase B-2)만 수행한다. per-domain schema 분할(ai/ks/inbox/impact/registry)은 Phase C 신규 도메인 구현 시 개별 SPEC에서 처리. `drizzle.config.ts`의 glob 로드 확장만 본 SPEC 범위.

### 1.4 규제·정책 근거 (Policy Anchor)

- **Charter [지양-3] QMS 대체 금지**: Phase A에서 8개 QMS/PLM 도메인 아카이브 완료. 잔여 도메인(risk, traceability, pccp, rlhf, knowledge-gap 등)은 #519 KEEP 재판정으로 라이브 보존.
- **Charter [지양-5] SaaS 외판 금지**: kernel 추출은 내부 인프라 경계 확립이며 SaaS 경계 확장 아님.
- **데이터 안전성**: migration은 제자리 유지. DB 테이블, RLS 정책, audit enum은 migration 제자리 유지로 보존.

### 1.5 본 SPEC의 범위 (In Scope)

- lib/kernel/ 디렉토리 생성, db/auth/audit/ratelimit/storage/schemas 이동 (git mv)
- lib/kernel/index.ts 공개 API (re-export 레이어, 새 추상층 금지 — REQ-V3R-004)
- schema.ts에서 kernel 테이블(`users`, `auditLogs`, `sessions`, + `verificationTokens` 후보) 발췌 → schema-kernel.ts
- drizzle.config.ts glob 로드 확장 (단일 `'./lib/db/schema.ts'` → array: schema-kernel + schema + schema-docingest). **신규 전환(선례 아님)**
- codemod 스크립트로 import 경로 일괄 변경: `@/lib/db`(174) → `@/lib/kernel/db`, `@/lib/auth`(181) → `@/lib/kernel/auth`, `@/lib/audit`(119) → `@/lib/kernel/audit`, `@/lib/schemas`(4) → `@/lib/kernel/schemas`. **union 289 파일(동적 import 55건 포함, 배럴 re-export 포함 — L-014)**
- `.archive-manifest.json` 유지 (Phase A #530 완료 상태: 8도메인, total_files=148)

### 1.6 Out of Scope

- v3 신규 도메인 구현 (inbox/triage/consult/registry) — Phase C 개별 SPEC
- UI 재작성 (components/) — Phase D, SPEC-V3-UI-001
- audit_log hash chain 강화 — Phase D, SPEC-V3-AUDIT-CHAIN-001
- BFF 통합 (lib/api → lib/bff) — Phase E, SPEC-V3-BFF-001
- per-domain schema 분할 (schema-ai.ts, schema-ks.ts 등) — Phase C에서 도메인별 처리
- migration 테이블 DROP — **영구 금지** (274 FK 보존)
- 운영 DB 데이터 삭제 (TRUNCATE 포함) — 별도 purge 작업 시 사용자 승인 필수
- **Phase A 아카이브 재이동 금지** (#530 완료, 잔여 도메인은 #519 KEEP 재분류 — 본 SPEC은 kernel 추출만)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3R-001 | **WHEN** kernel 추출 및 schema 분할 완료 후, **THEN** the system **SHALL** `pnpm typecheck && pnpm lint && pnpm test` 명령이 exit 0으로 통과하고 기준 회귀 테스트(5450 passed, 0 failed, 68 skipped — live run 2026-07-21) 대비 신규 failure 0건을 유지하여야 한다 | High |
| REQ-V3R-002 | **N/A (Phase A 완료로 무효화)**: 원 v1.0.0의 SHRINK 대상(rlhf, knowledge-gap)은 #519 KEEP 재판정으로 라이브 보존됨. `lib/rlhf/`, `lib/knowledge-gap/`은 archive 미이동. 본 SPEC 범위에서 제외. | N/A |
| REQ-V3R-003 | **N/A (Phase A 완료로 무효화)**: 원 v1.0.0의 크로스 임포트 처리(KEEP→archive)는 잔여 도메인 KEEP 재분류로 대상 없음. Phase A 8도메인은 0-의존성/독립 이동 완료. | N/A |
| REQ-V3R-004 | **WHILE** lib/kernel/ 추출 진행 중, the system **SHALL** kernel↔domain 순환 의존성이 0건이 되도록 보존하여야 한다 (kernel은 re-export 레이어, 새 추상층/의존성 역전 인터페이스 도입 금지 — TRUST 5 Readable) | High |
| REQ-V3R-005 | **WHEN** schema.ts 분할 시, **THEN** the system **SHALL** Drizzle FK 관계 274개를 100% 보존하고 `drizzle-kit check`가 통과하여야 한다 (kernel 테이블 분리 시 references는 schema-kernel.ts의 export를 import하여 사용) | High |
| REQ-V3R-006 | **THE SYSTEM SHALL** migration 디렉토리(125 files)를 제자리에 유지하고 아카이브 도메인 테이블의 DROP migration을 작성하지 않아야 한다 (선형 체인 보존, 274 FK 참조 붕괴 방지) | High |
| REQ-V3R-007 | **THE SYSTEM SHALL** 아카이브 대상 도메인 테이블(change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows — 8도메인 분)을 schema.ts에서 삭제하지 않고 `@deprecated` 주석으로 표시하여야 한다 (Phase A #530에서 미적용 상태 — 본 SPEC Phase B에서 보완) | Medium |
| REQ-V3R-008 | **WHEN** Phase A(아카이브)가 완료되면(선행 #530 완료), **THEN** the system **SHALL** archive/qms-pms/ 디렉토리에 8도메인(Phase A #530)이 존재하고 .archive-manifest.json(domain_count=8, total_files=148)이 유지되어야 한다 | High |
| REQ-V3R-009 | **WHEN** Phase B(kernel 추출)의 codemod가 실행되면, **THEN** the system **SHALL** 289 파일(union, 동적 import 55건 포함)의 `@/lib/db`, `@/lib/auth`, `@/lib/audit`, `@/lib/schemas` import 경로를 `@/lib/kernel/db`, `@/lib/kernel/auth`, `@/lib/kernel/audit`, `@/lib/kernel/schemas`로 일괄 변경하고 변경 누락 0건을 검증하여야 한다 (L-014: 정적 + 동적 + 배럴 re-export grep) | High |
| REQ-V3R-010 | **IF** kernel 추출 중 RLS 정책 또는 audit enum 참조가 붕괴되면, **THEN** the system **SHALL** 즉시 중단하고 사용자에게 보고하여야 한다 (완화: migration 제자리 유지로 RLS/enum은 DB에 보존) | Medium |
| REQ-V3R-011 | **THE SYSTEM SHALL** kernel 추출을 안전 순서(B1 디렉토리 생성 → B2 schema-kernel 발췌 → B3 drizzle config 전환 → B4 kernel/index.ts → B5 codemod)로 수행하고 각 단계마다 회귀 테스트 게이트(5450+ passed)를 통과하여야 한다 | High |
| REQ-V3R-012 | **WHEN** lib/kernel/index.ts 공개 API 작성 시, **THEN** the system **SHALL** 다음을 re-export 하여야 한다: `db`, `withTenantScope` (db/client), `getSession`, `requireRole`, `withPermission` (auth), `writeAudit`, `verifyHashChain` (audit), `rateLimit` (ratelimit), `uploadAsset` (storage) | Medium |
| REQ-V3R-013 | **THE SYSTEM SHALL** .archive-manifest.json에 원본 경로, 체크섬, 복원 경로 매핑을 포함하여야 한다 (Phase A #530에서 생성 완료 — 본 SPEC은 유지만) | Medium |
| REQ-V3R-014 | **WHEN** `next dev` 구동 중 페이지 로드 시, **THEN** the system **SHALL** 500 에러가 0건이어야 한다 (L-012: next dev 구동 중 pnpm build 금지 — `.next` chunk 충돌) | Medium |
| REQ-V3R-015 | **IF** migration 체인 꼬임이 감지되면, **THEN** the system **SHALL** 즉시 중단하고 테이블 DROP 전면 금지, TRUNCATE만 허용 원칙을 적용하여야 한다 (L-013: 실DB 직검으로 검증) | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|--------------|
| AC-01 | kernel 추출 후 KEEP 코드 `pnpm typecheck && pnpm lint && pnpm test` green (회귀 5450+ 유지, 신규 failure 0) | test runner output |
| AC-02 | **N/A (Phase A 완료)**: 원 v1.0.0의 크로스 임포트 grep 게이트는 잔여 도메인 KEEP 재분류로 대상 없음 | N/A |
| AC-03 | lib/kernel/ 경계 확립: kernel↔domain 순환 의존성 0건 (`@/lib/kernel`이 `@/lib/domains`를 import 0건) | grep 게이트 |
| AC-04 | schema.ts 분할 후 `pnpm drizzle-kit check` 통과, Drizzle FK 274개 보존 (분할 전후 FK 수 동일) | drizzle-kit check output + FK count 비교 |
| AC-05 | migration/ 디렉토리 125 files 제자리 유지, 아카이브 도메인 테이블 DROP migration 0건 추가 | `ls migrations/*.sql \| wc -l` = 125 (불변) |
| AC-06 | archive/qms-pms/ 8도메인(Phase A #530 완료) 유지, .archive-manifest.json(domain_count=8, total_files=148) 존재 | `ls archive/qms-pms/lib/ \| wc -l` = 8 |
| AC-07 | lib/db/schema.ts 아카이브 도메인 테이블(8도메인 분: change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows)에 `@deprecated` 주석 추가 — **Phase A #530에서 미적용(grep `@deprecated` = 0), 본 SPEC Phase B에서 보완 필요** | grep `@deprecated` 주석 (현재 0 → 보완 후 8도메인 분) |
| AC-08 | **N/A (Phase A 완료, KEEP 재분류)**: 원 v1.0.0의 SHRINK 검증(rlhf→lib/ai, knowledge-gap→lib/radar)은 #519 KEEP 판정으로 수행 안 함. rlhf/knowledge-gap은 라이브 유지. | N/A |
| AC-09 | codemod 후 `@/lib/db`, `@/lib/auth`, `@/lib/audit`, `@/lib/schemas` import 경로가 `@/lib/kernel/*`로 일괄 변경됨 (289 파일 union, 동적 import 55건 포함), 변경 누락 0건 (정적+동적+배럴 grep) | grep `@/lib/db\|@/lib/auth\|@/lib/audit\|@/lib/schemas` 결과에서 kernel 경로 미사용 파일 0건 |
| AC-10 | `next dev` 구동 후 주요 페이지(/, /admin, /ra) 로드 시 500 에러 0건 (L-012 준수) | E2E / 수동 확인 |
| AC-11 | lib/kernel/index.ts가 REQ-V3R-012의 re-export 항목을 모두 포함 | grep kernel/index.ts export 키워드 |

---

## §4 Technical Approach

### 4.1 Phase A — 완료 (#530/PR #534)

**Phase A 완료(#530/PR #534)**: 8도메인 아카이브 + `.archive-manifest.json`(domain_count=8, total_files=148) 생성 + 회귀 green(5450 passed, 0 failed, 68 skipped). 본 SPEC v1.1.0에서 Phase A 재이동 태스크는 없다.

> **잔여 보완**: AC-07(`@deprecated` 주석)은 Phase A에서 미적용 상태(grep `@deprecated` in schema.ts = 0). 본 Phase B 진행 중 schema.ts 분할 시 8도메인 테이블에 `@deprecated` 주석을 보완 추가한다(REQ-V3R-007).

### 4.2 Phase B — Kernel 추출 + schema 분할

| Sub-Phase | 작업 | Regression Risk | 검증 |
|-------|------|-----------------|------|
| **B1: lib/kernel/ 생성** | 디렉토리 생성, db/auth/audit/ratelimit/storage/schemas 이동 (git mv) | 높음 (289 파일 import 경로) | codemod 후 typecheck |
| **B2: schema-kernel.ts 발췌** | schema.ts에서 kernel 테이블(`users` L668, `auditLogs` L1285, `sessions` L1537, + `verificationTokens` L1567 후보) 발췌 → schema-kernel.ts. references는 cross-file import 사용 | 높음 (FK 274개) | `drizzle-kit check` 즉시 검증 |
| **B3: drizzle.config glob 확장** | `schema: './lib/db/schema.ts'`(단일) → `schema: ['./lib/kernel/db/schema-kernel.ts', './lib/db/schema.ts', './lib/db/schema-docingest.ts']`(array). **신규 전환(선례 아님 — 현재 schema-docingest.ts 미배선)** | 중간 | drizzle-kit generate --dry 무의도 diff 0 확인 |
| **B4: kernel/index.ts 작성** | REQ-V3R-012 re-export 항목 작성 (thin wrapper, 새 추상층 금지) | 낮음 | typecheck + grep export |
| **B5: codemod import 경로** | `@/lib/db` → `@/lib/kernel/db`, `@/lib/auth` → `@/lib/kernel/auth`, `@/lib/audit` → `@/lib/kernel/audit`, `@/lib/schemas` → `@/lib/kernel/schemas` (289 파일 union, 동적 import 55건 + 배럴 re-export 포함) 일괄 변경 | 높음 | 정적+동적+배럴 grep 누락 0건 + test green |

### 4.3 도메인별 처리 전략 — N/A (Phase A 완료)

본 v1.0.0의 Phase A 도메인 처리 매트릉스(dhf/pms/samd/esubmit DIRECT ARCHIVE, rlhf/knowledge-gap SHRINK, knowledge-promo RETIRE, traceability/corpus-license/pccp/standards/project-memory STUB 등)는 Phase A #530 8도메인 완료 + 잔여 도메인 #519 KEEP 재판정으로 대부분 N/A. 잔여 KEEP 도메인은 별도 거버넌스 결정이 필요하며 본 kernel-only 재스코프 범위 밖이다.

### 4.4 의존성 (Dependencies)

- **선행**: SPEC-REGULA-PHI-REMOVAL-001 (PHI 제거 완료, Issue #319) — vigilance/capa 정리 후 아카이브 잔여 도메인 정리
- **Phase A 선행 완료**: #530/PR #534 (8도메인 아카이브 + manifest 생성 + 회귀 green)
- **독립**: 본 SPEC Phase B는 구조 정리이므로 다른 진행 중 SPEC에 의존하지 않음
- **후속 영향**: Phase C(v3 신규 도메인)가 lib/kernel/ 경계에 의존. Phase D(UI)가 kernel 추출 완료 전제. Phase E(BFF)는 kernel auth/audit 사용(#531 §4.1)

### 4.5 Regression-Risk Matrix

| 영역 | Risk | 완화 방안 |
|------|------|-----------|
| **schema.ts 분할 (FK 274개)** | HIGH — kernel 테이블 분리 시 Drizzle 타입 에러 | `drizzle-kit check` 즉시 검증, 점진적 분리 (kernel 테이블만 먼저, per-domain은 Phase C) |
| **289 파일 import 경로 변경 (동적 import 55건 + 배럴 포함)** | HIGH — codemod 누락 시 typecheck 에러 | 정적+동적+배럴 grep으로 누락 0건 검증 (L-014), 자동화 스크립트, 단계적 검증 |
| **drizzle config 신규 배선** | MEDIUM — schema-docingest.ts 편입이 신규 migration diff를 유발할 수 있음 | `drizzle-kit generate --dry`로 무의도 diff 0 확인, 필요시 편입 범위 조정 |
| **RLS 정책 / audit enum 참조** | MEDIUM — kernel 이동 후 코드 부재 | migration 제자리 유지, schema.ts `@deprecated` 주석만 |
| **migration 체인 꼬임** | HIGH — 테이블 DROP 시 CASCADE 필요 | 테이블 DROP 전면 금지, TRUNCATE만 (사용자 승인 시) |
| **next dev 500 에러** | MEDIUM — import 경로 변경 후 chunk 충돌 | L-012: next dev 구동 중 build 금지, 페이지별 로드 테스트 |

---

## §5 Implementation Notes

> 본 섹션은 구현 진행 중 갱신된다. 현재는 placeholder.

- (구현 시작 후 갱신)

---

## §6 Rollback Plan

### 6.1 코드 Rollback (Phase A — #530 완료, 본 SPEC에서 재이동 없음)

- Phase A는 #530/PR #534에서 완료됨. 본 SPEC v1.1.0은 Phase A 태스크를 포함하지 않는다.
- Phase A rollback이 필요한 경우: `git revert` #530 병합 커밋 (별도 거버넌스 결정 필요).

### 6.2 Kernel 추출 Rollback (Phase B)

- 각 sub-phase(B1~B5)를 개별 commit으로 분리 → 부분 rollback 가능
- import 경로 rollback: `@/lib/kernel/db` → `@/lib/db` 역codemod
- schema-kernel.ts → schema.ts로 병합 (drizzle-kit check 검증)
- lib/kernel/ 디렉토리 삭제 후 원본 위치로 git mv 역순

### 6.3 전체 Rollback 시나리오

1. 이전 main 브랜치로 `git revert` (feature branch 경유)
2. 회귀 테스트 전체 실행 (5450+ passed 확인)
3. `drizzle-kit check` + 실DB 스키마 일관성 검증 (L-013)

---

## §7 Exclusions (What NOT to Build)

본 SPEC v1.1.0은 kernel 추출(Phase B)만 다룬다. 다음은 명시적으로 제외:

- **v3 신규 도메인 구현 금지**: inbox/triage/consult/registry는 Phase C 개별 SPEC에서 구현
- **UI 재작성 금지**: components/ 재작성은 Phase D, SPEC-V3-UI-001
- **audit hash chain 강화 금지**: Phase D, SPEC-V3-AUDIT-CHAIN-001 (본 SPEC은 kernel 이동만)
- **per-domain schema 분할 금지**: schema-ai.ts, schema-ks.ts 등은 Phase C에서 도메인별 처리 (본 SPEC은 kernel 테이블 분할만)
- **테이블 DROP migration 금지**: 274 FK 보존, 아카이브 도메인 테이블은 schema.ts에 `@deprecated` 주석만
- **Phase A 아카이브 재이동 금지**: #530/PR #534에서 8도메인 아카이브 완료. 잔여 도메인(rlhf, knowledge-gap, risk, traceability, pccp, knowledge-promo, model-governance, standards, project-memory, corpus-license)은 #519 KEEP 재분류 — 본 SPEC에서 이동/SHRINK/RETIRE 금지
- **새 추상층 도입 금지**: kernel은 re-export 레이어 (thin wrapper). 의존성 역전 인터페이스, Interface segregation 도입 안 함 (TRUST 5 Readable)
- **의존성 역전 컨테이너 금지**: DI 프레임워크, 데코레이터 기반 주입 등 과잉 추상화 전면 금지

### Out of Scope — Phase A 잔여 도메인 처분

- 잔여 KEEP 도메인(risk, traceability, pccp, rlhf, knowledge-gap, knowledge-promo, model-governance, standards, project-memory, corpus-license)의 아카이브/SHRINK/RETIRE는 본 kernel-only 재스코프 범위 밖. 별도 거버넌스 결정 + 개별 SPEC 필요.

---

## §8 Follow-up Issues

- (구현 중 발견 시 등록)
- 아카이브 8도메인 테이블의 향후 DROP 여부 — 별도 이슈 (사용자 승인 필요, 데이터 보존 정책 확정 후)
- lib/classify vs lib/classification 중복 도메인 병합 — 본 SPEC 범위 밖, 별도 조사 권장
- per-domain schema 분할 (schema-ai.ts 등) — Phase C에서 도메인별 SPEC 등록
- kernel 테이블 확정 집합(`verificationTokens` L1567 포함 여부) — run phase B2 사전 grep으로 최종 확정

---

## §9 References

- **마스터 계획**: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)
- **재개 계획**: `docs/proposals/v3-abe-resumption-plan-2026-07-19.md` §3 (Phase B kernel 추출 상세)
- **프로젝트 구조**: `.moai/project/structure.md` (v3 3-Tier 정의)
- **Phase A 완료**: #530/PR #534 — archive/qms-pms/ (8도메인), `.archive-manifest.json` (domain_count=8, total_files=148)
- **Charter**: `.moai/specs/CHARTER.md` v2.0.0
- **선례 SPEC**: `.moai/specs/SPEC-REGULA-PHI-REMOVAL-001/spec.md` (대규모 도메인 제거 구조 참조)
- **schema 분할 상태**: `lib/db/schema.ts` (3,531줄, 94 pgTable). `schema-docingest.ts`는 `drizzle.config.ts`에 **미배선** — 선례 아님, B3에서 array config로 신규 전환
- **drizzle.config.ts**: `schema: './lib/db/schema.ts'` (단일 파일, L20 — 직검 2026-07-21)
- **Lessons**: L-007(직검), L-010(migration 실DB), L-012(next dev build 금지), L-013(실DB 직검 3중 맹점), L-014(동적 import·배럴 grep)
- **관련 이슈**: #35 (본 SPEC 진행 이슈), #319 (PHI 제거 선행), #530 (Phase A 종료 게이트), #531 (Phase B 재개), #519 (잔여 도메인 KEEP 재판정), #521 (pccp 규제 제출물 보존)
