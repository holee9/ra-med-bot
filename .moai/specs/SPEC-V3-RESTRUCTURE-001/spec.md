---
id: SPEC-V3-RESTRUCTURE-001
version: 1.0.0
status: planned
phase: restructure
priority: High
created: 2026-07-02
updated: 2026-07-02
author: manager-spec
issue_number: 35
depends_on:
  - SPEC-REGULA-PHI-REMOVAL-001 (PHI 제거 완료 후 아카이브 잔여 도메인 정리)
supersedes: []
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/schema
  - component/structure
  - type/restructure
  - type/archive
  - domain/architecture
---

# SPEC-V3-RESTRUCTURE-001 — v3 구조 정리 (Phase A+B: 아카이브 잔여 14도메인 + lib/kernel/ 추출 + schema.ts 분할)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-02 | manager-spec | 초기 작성. Phase C-2 완료(4도메인 아카이브) 후 잔여 14도메인 + kernel 추출 + schema 분할을 다룸. 마스터 계획 `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula v3 아키텍처 개편의 **Phase A(아카이브 잔여) + Phase B(kernel 추출 + schema 분할)** 를 다룬다. Phase C-2에서 0-의존성 4도메인(clinical-investigation, cyberdevice, labeling, change-control, 106 files)이 이미 `archive/qms-pms/`로 이동 완료되었다. 본 SPEC은 **잔여 14도메인**의 아카이브를 완료하고, 공유 인프라(db/auth/audit)를 `lib/kernel/`로 추출하며, 단일 `schema.ts`(3,232줄, 86 pgTable)를 다중 파일로 분할한다.

마스터 계획은 이를 계층 2.5(kernel/domain/archive 3-tier)로 정의하며, Drizzle 다중 스키마 파일 glob 로드(`schema-docingest.ts` 선례 검증됨)로 전환한다.

### 1.2 Phase A 대상 — 잔여 14 도메인 (직접 검증, 2026-07-02)

**SHRINK 2종** (필요 파일은 KEEP 도메인으로 이동, 나머지 아카이브):

1. **`lib/rlhf/` (17 files)**: `applyRlhfReranking` in `lib/rlhf/retrieval-hook.ts` → `lib/ai/`로 이동. `lib/ai/merge.ts:7`가 이 함수를 import하여 RAG 결과 재랭킹에 사용. 나머지 16 files 아카이브.
2. **`lib/knowledge-gap/` (13 files)**: `markGapResolved`/`replayGapTest` in `lib/knowledge-gap/replay.ts` → `lib/radar/`로 이동. `lib/radar/delta-sync/gap-replay.ts:14`가 이 함수들을 import하여 delta-sync 후 gap 재테스트에 사용. 나머지 12 files 아카이브.

**고의존성 8종** (stub 교체 / import 제거 / KEEP 유지 도메인별 판단):

| 도메인 | lib files | app routes | SPEC | 비고 |
|---|---|---|---|---|
| `lib/risk/` | 11 | 13 | SPEC-REGULA-RISK-001 | cross-import 0종 (독립) — 저의존성과 동일하게 바로 이동 가능 |
| `lib/traceability/` | 17 | 11 | SPEC-REGULA-TRACEABILITY-001 | cross-import 1종 (lib/predicate → lib/traceability 0건, 역방향 traceability→predicate) |
| `lib/corpus-license/` | 10 | 3 | SPEC-REGULA-CORPUS-LICENSE-001 | cross-import 1종 |
| `lib/pccp/` | 14 | 6 | SPEC-REGULA-PCCP-001 | cross-import 1종 |
| `lib/knowledge-promo/` | 5 | 4 | SPEC-REGULA-KNOWLEDGE-PROMO-001 | RETIRE (audit/db/observability만 참조 — 공유 인프라) |
| `lib/model-governance/` | 13 | 6 | SPEC-REGULA-MODEL-GOVERNANCE-001 | cross-import 0종 (독립) |
| `lib/standards/` | 12 | 7 | SPEC-REGULA-STANDARDS-001 | cross-import 1종 |
| `lib/project-memory/` | 4 | 5 | SPEC-REGULA-PROJECT-MEMORY-001 | cross-import 2종 |

**저의존성 4종** (0-의존성과 동일하게 바로 이동):

| 도메인 | lib files | app routes | SPEC | 비고 |
|---|---|---|---|---|
| `lib/dhf/` | 1 | 11 | (SPEC 없음) | QMS 핵심 |
| `lib/pms/` | 1 | 0 | SPEC-REGULA-PMS-001 | 라우트는 workflows 사용 |
| `lib/samd/` | 1 | 7 | (SPEC 없음) | QMS 보조 |
| `lib/esubmit/` | 1 | 9 | (SPEC 없음) | stub, UI 0 |

**잔여 14도메인 총계 (직접 검증)**: lib 120 files + app 90 files = **210 files**. SPEC 11개 (dhf/samd/esubmit은 SPEC 없음).

### 1.3 Phase B 대상 — kernel 추출 + schema 분할

**lib/kernel/ 추출** (공유 인프라 경계 확립):

| 현재 위치 | 이동 위치 | 참조 파일 수 | 역할 |
|---|---|---|---|
| `lib/db/` | `lib/kernel/db/` | 173 | DB 클라이언트, schema-kernel |
| `lib/auth/` | `lib/kernel/auth/` | 178 | Auth.js v5, RBAC |
| `lib/audit/` | `lib/kernel/audit/` | 116 | writeAudit, append-only |
| `lib/ratelimit/` | `lib/kernel/ratelimit/` | — | KV ratelimiter |
| `lib/storage/` | `lib/kernel/storage/` | — | Object storage |
| `lib/schemas/` | `lib/kernel/schemas/` | — | Zod 공유 스키마 |

**schema.ts 분할** (Drizzle 다중 스키마 파일 — `schema-docingest.ts` 선례):

| 파일 | 내용 | 테이블 수 (예상) |
|---|---|---|
| `lib/kernel/db/schema-kernel.ts` | users, audit_log, audit_verify_history, sessions | ~5 |
| `lib/db/schema.ts` (레거시) | KEEP 도메인 + 아카이브 도메인 테이블 (감소 상태 유지, `@deprecated` 주석) | ~81 |

> **주의**: 본 SPEC에서는 kernel 테이블 분할(Phase B-1)만 수행. per-domain schema 분할(ai/ks/inbox/impact/registry)은 Phase C 신규 도메인 구현 시 개별 SPEC에서 처리. `drizzle.config.ts`의 glob 로드 확장만 본 SPEC 범위.

### 1.4 규제·정책 근거 (Policy Anchor)

- **Charter [지양-3] QMS 대체 금지**: 14도메인 중 다수가 QMS 운영 기능(risk, traceability, pccp, dhf, pms, samd, esubmit, standards). Regula는 RA 문서 분석 AI지 QMS 운영 시스템이 아니므로 아카이브가 정책 정합.
- **Charter [지양-5] SaaS 외판 금지**: corpus-license, knowledge-promo는 SaaS 경계 도메인. 내부 6-8명 팀 범위 밖.
- **데이터 안전성**: 아카이브는 코드/라우트 이동만. DB 테이블, RLS 정책, audit enum은 migration 제자리 유지로 보존.

### 1.5 본 SPEC의 범위 (In Scope)

- 잔여 14도메인 lib 120 files + app 90 files → `archive/qms-pms/` 이동
- SHRINK: rlhf `retrieval-hook.ts`의 `applyRlhfReranking` → `lib/ai/`로, knowledge-gap `replay.ts`의 `markGapResolved`/`replayGapTest` → `lib/radar/`로 이동
- 크로스 임포트 처리: stub 교체 / import 제거 / KEEP 유지 도메인별 판단
- lib/kernel/ 디렉토리 생성, db/auth/audit/ratelimit/storage/schemas 이동
- lib/kernel/index.ts 공개 API (re-export 레이어, 새 추상층 금지)
- schema.ts에서 kernel 테이블(users, audit_log 등 ~5개) 발췌 → schema-kernel.ts
- drizzle.config.ts glob 로드 확장 (schema.ts + schema-kernel.ts)
- 아카이브 도메인 테이블에 `@deprecated` 주석 (Phase C-2 누락 보완)
- codemod 스크립트로 import 경로 일괄 변경 (`@/lib/db` → `@/lib/kernel/db` 등)
- .archive-manifest.json 갱신 (Phase C-2 4도메인 + 본 SPEC 14도메인 = 총 18도메인)

### 1.6 Out of Scope

- v3 신규 도메인 구현 (inbox/triage/consult/registry) — Phase C 개별 SPEC
- UI 재작성 (components/) — Phase D, SPEC-V3-UI-001
- audit_log hash chain 강화 — Phase D, SPEC-V3-AUDIT-CHAIN-001
- BFF 통합 (lib/api → lib/bff) — Phase E, SPEC-V3-BFF-001
- per-domain schema 분할 (schema-ai.ts, schema-ks.ts 등) — Phase C에서 도메인별 처리
- migration 테이블 DROP — **영구 금지** (261 FK 보존)
- 운영 DB 데이터 삭제 (TRUNCATE 포함) — 별도 purge 작업 시 사용자 승인 필수

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|----------------|----------|
| REQ-V3R-001 | **WHEN** 잔여 14도메인 아카이브 이동이 완료되면, **THEN** the system **SHALL** `pnpm typecheck && pnpm lint && pnpm test` 명령이 exit 0으로 통과하고 기준 회귀 테스트(4815 passed) 대비 신규 failure 0건을 유지하여야 한다 | High |
| REQ-V3R-002 | **WHEN** SHRINK 대상 도메인(rlhf, knowledge-gap) 아카이브 시, **THEN** the system **SHALL** 필요 함수(`applyRlhfReranking`, `markGapResolved`, `replayGapTest`)를 KEEP 도메인(`lib/ai/`, `lib/radar/`)으로 먼저 이동시킨 후 나머지 파일들을 아카이브하여야 한다 (역참조 2건: `lib/ai/merge.ts`, `lib/radar/delta-sync/gap-replay.ts`) | High |
| REQ-V3R-003 | **WHERE** KEEP 코드가 아카이브 도메인을 import 하는 경우, the system **SHALL** SHRINK(stub 교체 또는 함수 이동) / import 제거 / KEEP 유지 도메인별 판단 전략 중 하나로 100% 처리하여야 한다 (크로스 임포트 잔존 0건) | High |
| REQ-V3R-004 | **WHILE** lib/kernel/ 추출 진행 중, the system **SHALL** kernel↔domain 순환 의존성이 0건이 되도록 보존하여야 한다 (kernel은 re-export 레이어, 새 추상층/의존성 역전 인터페이스 도입 금지 — TRUST 5 Readable) | High |
| REQ-V3R-005 | **WHEN** schema.ts 분할 시, **THEN** the system **SHALL** Drizzle FK 관계 261개를 100% 보존하고 `drizzle-kit check`가 통과하여야 한다 (kernel 테이블 분리 시 references는 schema-kernel.ts의 export를 import하여 사용) | High |
| REQ-V3R-006 | **THE SYSTEM SHALL** migration 디렉토리(106 files)를 제자리에 유지하고 아카이브 도메인 테이블의 DROP migration을 작성하지 않아야 한다 (선형 체인 보존, 261 FK 참조 붕괴 방지) | High |
| REQ-V3R-007 | **THE SYSTEM SHALL** 아카이브 대상 도메인 테이블(clinical_investigation, risk, traceability, pccp, rlhf, knowledge_gap 등)을 schema.ts에서 삭제하지 않고 `@deprecated` 주석으로 표시하여야 한다 (Phase C-2 4도메인 분 포함 보완) | Medium |
| REQ-V3R-008 | **WHEN** Phase A(아카이브)가 완료되면, **THEN** the system **SHALL** archive/qms-pms/ 디렉토리에 총 18도메인(Phase C-2 4 + 본 SPEC 14)이 존재하고 .archive-manifest.json이 갱신되어야 한다 | High |
| REQ-V3R-009 | **WHEN** Phase B(kernel 추출)의 codemod가 실행되면, **THEN** the system **SHALL** 178+ 파일의 `@/lib/db`, `@/lib/auth`, `@/lib/audit` import 경로를 `@/lib/kernel/db`, `@/lib/kernel/auth`, `@/lib/kernel/audit`로 일괄 변경하고 변경 누락 0건을 검증하여야 한다 | High |
| REQ-V3R-010 | **IF** 아카이브 이동 중 RLS 정책 또는 audit enum 참조가 붕괴되면, **THEN** the system **SHALL** 즉시 중단하고 사용자에게 보고하여야 한다 (완화: migration 제자리 유지로 RLS/enum은 DB에 보존, schema.ts는 `@deprecated` 주석만) | Medium |
| REQ-V3R-011 | **THE SYSTEM SHALL** 아카이브 순서를 안전 순서(저의존성 4종 → SHRINK 2종 → 고의존성 8종)로 수행하고 각 단계마다 회귀 테스트 게이트(4815+ passed)를 통과하여야 한다 | High |
| REQ-V3R-012 | **WHEN** lib/kernel/index.ts 공개 API 작성 시, **THEN** the system **SHALL** 다음을 re-export 하여야 한다: `db`, `withTenantScope` (db/client), `getSession`, `requireRole`, `withPermission` (auth), `writeAudit`, `verifyHashChain` (audit), `rateLimit` (ratelimit), `uploadAsset` (storage) | Medium |
| REQ-V3R-013 | **THE SYSTEM SHALL** .archive-manifest.json에 원본 경로, 체크섬, 복원 경로 매핑을 포함하여야 한다 (git mv 기반이므로 복원 용이) | Medium |
| REQ-V3R-014 | **WHEN** `next dev` 구동 중 페이지 로드 시, **THEN** the system **SHALL** 500 에러가 0건이어야 한다 (L-012: next dev 구동 중 pnpm build 금지 — `.next` chunk 충돌) | Medium |
| REQ-V3R-015 | **IF** migration 체인 꼬임이 감지되면, **THEN** the system **SHALL** 즉시 중단하고 테이블 DROP 전면 금지, TRUNCATE만 허용 원칙을 적용하여야 한다 (L-013: 실DB 직검으로 검증) | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|--------------|
| AC-01 | 잔여 14도메인 아카이브 후 KEEP 코드 `pnpm typecheck && pnpm lint && pnpm test` green (회귀 4815+ 유지, 신규 failure 0) | test runner output |
| AC-02 | 크로스 임포트 100% 처리: `grep -rn "from.*@/lib/rlhf\|from.*@/lib/knowledge-gap\|from.*@/lib/risk\|from.*@/lib/traceability\|from.*@/lib/corpus-license\|from.*@/lib/pccp\|from.*@/lib/knowledge-promo\|from.*@/lib/model-governance\|from.*@/lib/standards\|from.*@/lib/project-memory\|from.*@/lib/dhf\|from.*@/lib/pms\|from.*@/lib/samd\|from.*@/lib/esubmit" lib/ app/ components/` 결과에서 KEEP 코드 잔존 0건 (archive/ 내부 제외) | grep 게이트 |
| AC-03 | lib/kernel/ 경계 확립: kernel↔domain 순환 의존성 0건 (`@/lib/kernel`이 `@/lib/domains`를 import 0건) | grep 게이트 |
| AC-04 | schema.ts 분할 후 `pnpm drizzle-kit check` 통과, Drizzle FK 261개 보존 (분할 전후 FK 수 동일) | drizzle-kit check output + FK count 비교 |
| AC-05 | migration/ 디렉토리 106 files 제자리 유지, 아카이브 도메인 테이블 DROP migration 0건 추가 | `ls migrations/*.sql \| wc -l` = 106 (불변) |
| AC-06 | archive/qms-pms/ 총 18도메인 완료 (Phase C-2 4 + 본 SPEC 14), .archive-manifest.json 갱신 | `ls archive/qms-pms/lib/ \| wc -l` = 18 |
| AC-07 | lib/db/schema.ts 아카이브 도메인 테이블에 `@deprecated` 주석 추가 (Phase C-2 4도메인 + 본 SPEC 14도메인 = 18도메인 분) | grep `@deprecated` 주석 |
| AC-08 | SHRINK 검증: `applyRlhfReranking`이 `lib/ai/` 내부에 존재, `markGapResolved`/`replayGapTest`가 `lib/radar/` 내부에 존재, 원본 lib/rlhf/lib/knowledge-gap은 archive/로 이동 | grep + find |
| AC-09 | codemod 후 `@/lib/db`, `@/lib/auth`, `@/lib/audit` import 경로가 `@/lib/kernel/*`로 일괄 변경됨 (178+ 파일), 변경 누락 0건 | grep `@/lib/db\|@/lib/auth\|@/lib/audit` 결과에서 kernel 경로 미사용 파일 0건 |
| AC-10 | `next dev` 구동 후 주요 페이지(/, /admin, /ra) 로드 시 500 에러 0건 (L-012 준수) | E2E / 수동 확인 |
| AC-11 | lib/kernel/index.ts가 REQ-V3R-012의 re-export 항목을 모두 포함 | grep kernel/index.ts export 키워드 |

---

## §4 Technical Approach

### 4.1 Phase A — 아카이브 안전 순서 (최소 regression risk)

**원칙**: 저의존성 → SHRINK → 고의존성. 각 단계 독립 commit + regression test 게이트.

| Sub-Phase | 작업 | Regression Risk | 검증 |
|-------|------|-----------------|------|
| **A1: 저의존성 4종** | dhf, pms, samd, esubmit (lib 4 files, app 27 files) → archive/ | 낮음 (cross-import 0건) | typecheck + test green |
| **A2: 독립 2종** | risk (cross-import 0), model-governance (cross-import 0) → archive/ | 낮음 | typecheck + test green |
| **A3: SHRINK 2종** | rlhf: `retrieval-hook.ts`의 `applyRlhfReranking` → `lib/ai/rlhf-adapter.ts`로 이동, 나머지 16 files 아카이브. knowledge-gap: `replay.ts`의 `markGapResolved`/`replayGapTest` → `lib/radar/gap-replay-adapter.ts`로 이동, 나머지 12 files 아카이브 | 중간 (SHRINK 이동 후 import 경로 갱신) | `lib/ai/merge.ts`, `lib/radar/delta-sync/gap-replay.ts` 컴파일 확인 |
| **A4: 고의존성 6종** | knowledge-promo (RETIRE), traceability, corpus-license, pccp, standards, project-memory → archive/ (각 도메인별 stub/import 제거 판단) | 중간~높음 | 각 도메인별 typecheck 게이트 |
| **A5: schema @deprecated** | schema.ts의 아카이브 18도메인 테이블에 `@deprecated` 주석 (Phase C-2 4도메인 포함 보완) | 낮음 (주석만) | grep 주석 확인 |
| **A6: .archive-manifest 갱신** | Phase C-2 4도메인 + 본 SPEC 14도메인 = 18도메인 매니페스트 통합 | 낮음 | manifest 검증 |

### 4.2 Phase B — Kernel 추출 + schema 분할

| Sub-Phase | 작업 | Regression Risk | 검증 |
|-------|------|-----------------|------|
| **B1: lib/kernel/ 생성** | 디렉토리 생성, db/auth/audit/ratelimit/storage/schemas 이동 (git mv) | 높음 (178+ 파일 import 경로) | codemod 후 typecheck |
| **B2: schema-kernel.ts 발췌** | schema.ts에서 users, audit_log, audit_verify_history, sessions (~5 테이블) 발췌 → schema-kernel.ts. references는 cross-file import 사용 | 높음 (FK 261개) | `drizzle-kit check` 즉시 검증 |
| **B3: drizzle.config glob 확장** | `schema: './lib/db/schema.ts'` → `schema: ['./lib/kernel/db/schema-kernel.ts', './lib/db/schema.ts', './lib/db/schema-docingest.ts']` | 낮음 | drizzle-kit generate 확인 |
| **B4: kernel/index.ts 작성** | REQ-V3R-012 re-export 항목 작성 (thin wrapper, 새 추상층 금지) | 낮음 | typecheck |
| **B5: codemod import 경로** | `@/lib/db` → `@/lib/kernel/db`, `@/lib/auth` → `@/lib/kernel/auth` 등 178+ 파일 일괄 변경 | 높음 | grep 누락 0건 + test green |

### 4.3 도메인별 처리 전략 매트릭스 (run phase #35용)

| 도메인 | 전략 | 크로스 임포트 처리 | 비고 |
|---|---|---|---|
| dhf, pms, samd, esubmit | DIRECT ARCHIVE | 없음 (0종) | 저의존성 |
| risk, model-governance | DIRECT ARCHIVE | 없음 (0종) | 독립 |
| rlhf | SHRINK | `lib/ai/merge.ts` import → `lib/ai/rlhf-adapter.ts`로 함수 이동 | `applyRlhfReranking` 보존 |
| knowledge-gap | SHRINK | `lib/radar/delta-sync/gap-replay.ts` import → `lib/radar/gap-replay-adapter.ts`로 함수 이동 | `markGapResolved`/`replayGapTest` 보존 |
| knowledge-promo | RETIRE | 공유 인프라(audit/db/observability)만 참조 → 바로 아카이브 | 기능 축소 |
| traceability | STUB/IMPORT 제거 | lib/predicate ↔ lib/traceability (역방향 1종) — stub 또는 import 제거 | 도메인별 판단 |
| corpus-license | STUB/IMPORT 제거 | lib/pccp ↔ lib/corpus-license 상호참조 — 한쪽 stub | 도메인별 판단 |
| pccp | STUB/IMPORT 제거 | lib/corpus-license ↔ lib/pccp — corpus-license과 함께 처리 | 도메인별 판단 |
| standards | STUB/IMPORT 제거 | lib/standards → 다른 도메인 1종 | 도메인별 판단 |
| project-memory | STUB/IMPORT 제거 | lib/project-memory → 다른 도메인 2종 | 도메인별 판단 |

### 4.4 의존성 (Dependencies)

- **선행**: SPEC-REGULA-PHI-REMOVAL-001 (PHI 제거 완료, Issue #319) — vigilance/capa 정리 후 아카이브 잔여 도메인 정리
- **독립**: 본 SPEC은 구조 정리이므로 다른 진행 중 SPEC에 의존하지 않음
- **후속 영향**: Phase C(v3 신규 도메인)가 lib/kernel/ 경계에 의존. Phase D(UI)가 kernel 추출 완료 전제. Phase E(BFF)는 독립적

### 4.5 Regression-Risk Matrix

| 영역 | Risk | 완화 방안 |
|------|------|-----------|
| **schema.ts 분할 (FK 261개)** | HIGH — kernel 테이블 분리 시 Drizzle 타입 에러 | `drizzle-kit check` 즉시 검증, 점진적 분리 (kernel 테이블만 먼저, per-domain은 Phase C) |
| **178+ 파일 import 경로 변경** | HIGH — codemod 누락 시 typecheck 에러 | grep으로 누락 0건 검증, 자동화 스크립트, 단계적 검증 |
| **SHRINK 함수 이동** | MEDIUM — import 경로 갱신 누락 | `lib/ai/merge.ts`, `lib/radar/delta-sync/gap-replay.ts` 직검 |
| **RLS 정책 / audit enum 참조** | MEDIUM — 아카이브 후 코드 부재 | migration 제자리 유지, schema.ts `@deprecated` 주석만 |
| **migration 체인 꼬임** | HIGH — 테이블 DROP 시 CASCADE 필요 | 테이블 DROP 전면 금지, TRUNCATE만 (사용자 승인 시) |
| **next dev 500 에러** | MEDIUM — 라우트 이동 후 chunk 충돌 | L-012: next dev 구동 중 build 금지, 페이지별 로드 테스트 |

---

## §5 Implementation Notes

> 본 섹션은 구현 진행 중 갱신된다. 현재는 placeholder.

- (구현 시작 후 갱신)

---

## §6 Rollback Plan

### 6.1 코드 Rollback (Phase A — git mv 기반)

- 각 sub-phase(A1~A6)를 개별 commit으로 분리 → 부분 rollback 가능
- `git revert <commit>`로 파일 복구 (git mv이므로 역순 이동 용이)
- SHRINK 이동 함수 rollback: `lib/ai/rlhf-adapter.ts`, `lib/radar/gap-replay-adapter.ts` 삭제 후 원본 위치로 복원

### 6.2 Kernel 추출 Rollback (Phase B)

- import 경로 rollback: `@/lib/kernel/db` → `@/lib/db` 역codemod
- schema-kernel.ts → schema.ts로 병합 (drizzle-kit check 검증)
- lib/kernel/ 디렉토리 삭제 후 원본 위치로 git mv 역순

### 6.3 전체 Rollback 시나리오

1. 이전 main 브랜치로 `git revert` (feature branch 경유)
2. 회귀 테스트 전체 실행 (4815+ passed 확인)
3. `drizzle-kit check` + 실DB 스키마 일관성 검증 (L-013)

---

## §7 Exclusions (What NOT to Build)

본 SPEC은 구조 정리만 다룬다. 다음은 명시적으로 제외:

- **v3 신규 도메인 구현 금지**: inbox/triage/consult/registry는 Phase C 개별 SPEC에서 구현
- **UI 재작성 금지**: components/ 재작성은 Phase D, SPEC-V3-UI-001
- **audit hash chain 강화 금지**: Phase D, SPEC-V3-AUDIT-CHAIN-001 (본 SPEC은 kernel 이동만)
- **per-domain schema 분할 금지**: schema-ai.ts, schema-ks.ts 등은 Phase C에서 도메인별 처리 (본 SPEC은 kernel 테이블 분할만)
- **테이블 DROP migration 금지**: 261 FK 보존, 아카이브 도메인 테이블은 schema.ts에 `@deprecated` 주석만
- **새 추상층 도입 금지**: kernel은 re-export 레이어 (thin wrapper). 의존성 역전 인터페이스, Interface segregation 도입 안 함 (6-8명 팀에 불필요, TRUST 5 Readable)
- **의존성 역전 컨테이너 금지**: DI 프레임워크, 데코레이터 기반 주입 등 과잉 추상화 전면 금지

---

## §8 Follow-up Issues

- (구현 중 발견 시 등록)
- 아카이브 18도메인 테이블의 향후 DROP 여부 — 별도 이슈 (사용자 승인 필요, 데이터 보존 정책 확정 후)
- lib/classify vs lib/classification 중복 도메인 병합 — 본 SPEC 범위 밖, 별도 조사 권장
- per-domain schema 분할 (schema-ai.ts 등) — Phase C에서 도메인별 SPEC 등록

---

## §9 References

- **마스터 계획**: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)
- **프로젝트 구조**: `.moai/project/structure.md` (v3 3-Tier 정의)
- **Phase C-2 완료**: `archive/qms-pms/` (4도메인, 106 files)
- **Charter**: `~/.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/product-charter.md`
- **선례 SPEC**: `.moai/specs/SPEC-REGULA-PHI-REMOVAL-001/spec.md` (대규모 도메인 제거 구조 참조)
- **schema 분할 선례**: `lib/db/schema-docingest.ts` (Drizzle 다중 파일 검증됨)
- **Lessons**: L-007(직검), L-010(migration 실DB), L-012(next dev build 금지), L-013(실DB 직검 3중 맹점)
- **관련 이슈**: #35 (본 SPEC 진행 이슈), #319 (PHI 제거 선행)
