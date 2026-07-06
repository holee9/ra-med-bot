---
id: SPEC-V3-AUDIT-CHAIN-001
title: audit_log SHA-256 Hash Chain Strengthening
version: 0.3.0
status: implemented
phase: E
priority: High
created_at: 2026-07-06
updated_at: 2026-07-06
author: manager-spec
depends_on: []
parent_spec: none
issue_number: TBD
lifecycle: spec-anchored
run_phase: M0-M3 implemented (commits 9445e96 M0, <M1-M3-sha> M1-M3); M4 gates green; pre-merge review pending
labels: [audit, hash-chain, 21cfr-part11, tamper-evidence, postgresql, phase-E]
---

# SPEC-V3-AUDIT-CHAIN-001 — audit_log SHA-256 Hash Chain Strengthening

v3 Phase E / D-1. 21 CFR Part 11 §11.10(e) 전자기록 무결성 강화를 위해
`audit_logs` 테이블에 SHA-256 hash chain 을 적용한다.

## HISTORY

- 2026-07-06 (v0.1.0): 초기 초안. Phase E D-1. `writeAudit` chain populate + `verifyAuditChain` + 크론. 기존 `previous_hash` 컬럼(0109) 활용, 전략 B backfill.
- 2026-07-06 (v0.2.0): plan-auditor FAIL verdict 반영 — Critical 3건 + High 2건 해소:
  - **C1 (UUID/hash paradox)**: app-side `crypto.randomUUID()` 사전 생성 후 INSERT 에 명시 전달. REQ-AC-005 의 `id` 입력이 INSERT 시점에 알려지도록 보장. 신규 REQ-AC-012.
  - **C2 (verify algorithm ambiguity)**: REQ-AC-007 을 정확한 점화식 (`chainHash_N = SHA256(canonical(row_N) ‖ chainHash_{N-1})`) 으로 재작성. AC-5 binary-testable.
  - **C3 (concurrency undermines tamper-evidence)**: §4 Constraints 에 `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 직렬화 명시. EC-1 재작성 (fork tolerated → fork prevented).
  - **H1 (non-reproducible caller count)**: 실 grep 결과 191 / 117 files 로 정정 (구 197).
  - **H2 (AuditDbHandle cannot SELECT)**: REQ-AC-013 신규 — `AuditDbHandle` 를 `select` capability 포함 structural type 으로 확장.
  - Major: M1 (AC for REQ-AC-003 genesis), M2 (AC for REQ-AC-005 field-order sensitivity), M3 (`chain_seq BIGINT` 신규 컬럼으로 monotonic tie-break), M4 (traceability matrix), m2/m3/m7.
  - YAML: `labels` 추가, `created`→`created_at`, `updated`→`updated_at` rename.

---

## 1. 배경 및 목적

### 1.1 배경

- `audit_logs.previous_hash TEXT` 컬럼이 `migrations/0109_impact_wizard_columns.sql` 로 추가되었으나, **현재 populate 되지 않음** (writeAudit INSERT 에서 누락).
  - **문서 버그 (m3, run-phase 수정 예정)**: 0109 헤더 주석 라인 6 은 `previousHash (bytea)` 라 기술하지만 실제 컬럼은 TEXT (64-char hex). run phase 에서 헤더 수정.
- 검증 함수, 주기적 검증 크론이 부재.
- 21 CFR Part 11 §11.10(e) (record integrity) 요구사항에 대해 chain-based tamper-evidence 미충족.

### 1.2 목적

- 모든 신규 audit 행에 대해 직전 행의 해시와 자기 자신의 canonical 필드로 SHA-256 chain 을 형성.
- 임의 행 변조(또는 누락) 시 chain 재계산 결과가 달라져 위반을 탐지 가능 (tamper-evidence).
- 주기적 크론이 chain 위반을 audit event 로 기록하고, 운영자가 즉시 인지.

### 1.3 비목표 (Out of Scope)

- `lib/kernel/audit/` 디렉토리 이동 (별도 리팩터 SPEC).
- 기존 행의 `previous_hash` backfill UPDATE (append-only 위반, 기각).
- §11.70 HMAC 서명 binding (Issue #321, 별도 SPEC).
- R2 cold archive chain 보존 (SPEC-REGULA-CLOUDFLARE-001 후속).

---

## 2. Environment / Assumptions

- 런타임: Node.js 22.x (Next.js 서버 런타임, 확인: `node --version` = v22.23.1).
  - `globalThis.crypto.randomUUID()` 사용 가능 (WebCrypto, Node 19+). 코드베이스 기존 사용처 존재 (`lib/workflows/common/review-queue.ts:26`, `lib/workflows/audit-response/executor.ts:80`, `lib/workflows/common/human-handoff.ts:41`).
- DB: PostgreSQL (Neon). `audit_logs` 테이블 append-only 트리거 활성 (`0001_audit_append_only.sql` — UPDATE/DELETE/TRUNCATE 를 P0001 에러로 차단).
- 기존 인프라: `lib/audit.ts#writeAudit(params, tx?)` 가 **191개 프로덕션 호출 지점 (117 distinct files)** 에서 사용 (H1 fix — 실 grep 결과).
- `lib/signature/hash.ts` 의 WebCrypto SHA-256 패턴을 재사용 가능 (신규 의존성 없음).
- 기존 `previous_hash` 컬럼 (TEXT, 64-char hex) 이 이미 스키마에 존재.
- Drizzle `db.transaction` tx 객체는 이미 `insert` + `select` 모두 지원 (H2 — 실제 PgTransaction 타입은 두 capability 를 가짐; `AuditDbHandle` 만 narrowing 된 것).

---

## 3. Requirements (EARS)

### 3.1 Hash Chain 자동 계산 (Population)

**REQ-AC-001** (Event-Driven)
**When** `writeAudit(params, tx?)` 가 호출되어 `audit_logs` 에 INSERT 를 수행할 때,
the system **shall** 동일한 transaction 안에서 (a) `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 획득, (b) 직전 audit 행의 `previous_hash` 와 `chain_seq` 조회, (c) app-side 생성 UUID 를 PK 로 명시, (d) 현재 행의 canonical 필드와 이전 해시를 결합하여 SHA-256 해시를 계산, (e) 신규 행의 `previous_hash` 컬럼에 저장한다.

**REQ-AC-002** (Unwanted Behavior / Atomicity)
**If** `writeAudit` 가 caller-supplied `tx` transaction handle 과 함께 호출된 경우,
the system **shall not** 해시 계산과 INSERT 를 분리된 transaction 으로 수행한다.
두 연산은 caller 의 tx 안에서 원자적으로 실행되어야 한다 (21 CFR Part 11 §11.10(c)).

**REQ-AC-003** (State-Driven / Genesis)
**While** `audit_logs` 테이블에 직전 행이 존재하지 않거나 직전 행의 `previous_hash` 가
NULL 인 경우, the system **shall** 현재 행을 chain 의 genesis (시작점) 으로 처리하고,
`chainHash_0 = "<genesis>"` sentinel 을 이전 링크로 사용하여 자기 자신의 필드만으로 해시를 계산하여 `previous_hash` 에 저장한다 (전략 B). `chain_seq` 는 이 경우 1 로 시작.

**REQ-AC-004** (Backward Compatibility / Non-Functional)
**Where** 기존 **191개 프로덕션 호출 지점** (실 grep 결과 — H1 fix; 구 197 은 부정확) 이 `writeAudit(params)` 또는
`writeAudit(params, tx)` 형태로 호출하는 경우,
the system **shall** 모든 기존 호출의 시그니처와 semantics 를 보존한다.
`writeAudit(params: AuditEvent, tx?: AuditDbHandle)` 시그니처는 변경되지 않는다.
> m2 fix: 본 REQ 본문의 "197" 표기를 "all existing production call sites (실측 191)" 로 범용화.

### 3.2 Canonicalization

**REQ-AC-005** (Ubiquitous)
The system **shall** 각 audit 행의 해시를 계산하기 위해 다음 필드들을 결정론적
순서로 canonical 문자열로 직렬화한다: `previous_hash || id || actor_id || action ||
resource_type || resource_id || conversation_id || meta_json (stable key order) ||
created_at (ISO-8601 UTC)`. 필드 누락 또는 순서 변경은 금지된다.
> **M2**: canonical 순서 민감성 — 동일 값이라도 필드 순서가 다르면 해시가 달라야 한다 (acceptance.md AC-5b 참조).

**REQ-AC-006** (Ubiquitous)
The system **shall** SHA-256 알고리즘 (`globalThis.crypto.subtle.digest`) 만을 사용하여
64자 소문자 hex 문자열을 출력한다. 다른 알고리즘이나 인코딩은 허용되지 않는다.

### 3.3 App-Side ID Generation (C1 fix)

**REQ-AC-012** (Ubiquitous — C1 resolution)
The system **shall** `writeAudit` 가 INSERT 전에 `crypto.randomUUID()` 로 UUID 를 사전 생성하고, 이를 (a) `audit_logs.id` PK 컬럼에 명시적으로 전달하며, (b) REQ-AC-005 canonical hash input 의 `id` 필드로 사용한다. DB 의 `defaultRandom()` 은 defensive fallback 으로 남으나 정상 경로에서는 항상 app-side UUID 가 사용된다. 이로 인해 `id` 는 INSERT 시점에 이미 알려져 있으므로 hash 계산이 가능하다 (append-only UPDATE 금지와 양립).

### 3.4 Verification Utility (C2 fix — exact recurrence)

**REQ-AC-007** (Event-Driven — C2 resolution, unambiguous recurrence)
**When** `verifyAuditChain(window)` 함수가 시간 구간 (start, end) 또는 row 범위
(offset, limit) 매개변수로 호출될 때, the system **shall** 아래의 정확한 점화식으로 chain 을 재계산하여 저장된 `previous_hash` 와 비교한다:

- `chainHash_0 = "<genesis>"` (literal sentinel).
- For N ≥ 1: `chainHash_N = SHA256( canonical(row_N.fields_without_previous_hash) ‖ chainHash_{N-1} )`.
- Assertion: `row_N.previous_hash` MUST equal `chainHash_{N-1}`.

즉 각 행은 **이전 chain link 의 해시** 를 `previous_hash` 에 저장한다. 검증 함수는 forward 로 `chainHash_N` 을 재계산하고, **다음 행** (`row_{N+1}`) 의 저장된 `previous_hash` 가 `chainHash_N` 과 일치하는지 확인한다. `row_N.fields` 변조는 `chainHash_N` 변화 → `row_{N+1}.previous_hash ≠ chainHash_N` 위반으로 탐지된다. 위반 위치(행 id, expected vs actual) 배열을 반환한다.

**REQ-AC-008** (State-Driven / Segment Awareness)
**While** 검증 윈도우 안에 `previous_hash IS NULL` 인 행이 존재할 때,
the system **shall** 해당 행을 새 chain segment 의 시작점으로 인식하고,
이전 segment 의 끝과 비교하지 않으며, NULL 행 자체는 위반으로 보고하지 않는다 (전략 B 준수).

### 3.5 Periodic Verification Cron

**REQ-AC-009** (Event-Driven)
**When** Inngest `audit-chain-verify-daily` 크론이 발화할 때,
the system **shall** 직전 24시간 윈도우의 audit 행에 대해 `verifyAuditChain` 을 실행하고,
위반 발생 시 단일 alert audit event (`audit_chain.violation_detected` action 또는
기존 audit action 중 적절한 값) 를 system actor 로 기록한다.

**REQ-AC-010** (Optional / Graceful Degradation)
**Where** 검증 윈도우 안에 0개의 행이 존재하는 경우,
the system **shall** 위반 없이 정상 종료하며, alert audit event 를 발행하지 않는다.

### 3.6 Index / Migration

**REQ-AC-011** (Optional / Performance)
**Where** `verifyAuditChain` 의 `created_at` 기반 윈도우 스캔 성능이 임계치를 초과할 경우,
the system **shall** `idx_audit_logs_created_at` 인덱스를 추가하는 마이그레이션
(`0111_audit_chain.sql`) 을 제공한다. 인덱스가 이미 충분하면 생략 가능하다.

### 3.7 AuditDbHandle Capability (H2 fix)

**REQ-AC-013** (Ubiquitous — H2 resolution)
The system **shall** `AuditDbHandle` (`lib/audit.ts:514`) 타입을 `insert` 와 `select` capability 를 모두 가진 structural type 으로 확장한다. 근거: Drizzle `PgTransaction` 은 이미 두 capability 를 제공하므로, real tx 객체는 변경 없이 그대로 호환된다. 단, 기존 ~24개 `db.transaction` 호출 지점에서 narrowed tx 객체를 전달하는 경우의 호환성 검증을 M1 마일스톤에 추가한다 (plan.md §2 M1 참조).

### 3.8 Chain Sequence Counter (M3 fix — monotonic tie-break)

**REQ-AC-014** (Ubiquitous — M3 resolution)
The system **shall** migration 0111 에 `audit_logs.chain_seq BIGINT NOT NULL DEFAULT 0` 컬럼을 추가하고, `writeAudit` 가 이 값을 monotonic 하게 채운다 (`previous_hash` 와 동일 tx 안에서 직전 행의 `chain_seq + 1`). 동일 `created_at` (마이크로초 충돌) 시 `chain_seq` 로 tie-break 한다 (EC-3 참조). UUID tie-break 의 semantic 한계(분산 생성 순서 비보장)를 제거한다.

### 3.9 Non-Functional Constraints (NFR)

**NFR-AC-001** (Performance — m7: measurement methodology + gate)
`writeAudit` 의 단일 호출은 (a) advisory lock 획득, (b) 직전 행 1건 SELECT (`chain_seq, previous_hash`), (c) SHA-256 1회, (d) INSERT 로 구성되며,
기존 대비 추가 지연은 **P99 기준 5ms 이내** 여야 한다. Full table scan 은 금지된다.
> **m7 fix — measurement methodology**: 벤치마크는 `lib/audit/__tests__/writeAudit.bench.ts` (신규) 에서 `vitest --bench` 로 1000회 연속 `writeAudit` 호출 후 P99 를 측정. 게이트: P99 ≤ 5ms (NFR-AC-001). 측정 환경: 로컬 Postgres (Neon dev branch), warm cache. CI 에서는 bench 를 regressions 전용 suite 로 분리 (일일 실행).

**NFR-AC-002** (Append-only Compliance)
해시 계산/저장 과정에서 `audit_logs` 에 대한 UPDATE/DELETE/TRUNCATE 는 발생하지
않는다. `0001_audit_append_only.sql` 트리거와 충돌하지 않는다.

**NFR-AC-003** (Determinism)
동일 입력 행에 대해 재계산된 해시는 항상 동일하다. 런타임, 타임존, JSON 키 순서에
무관하게 결정론적 이어야 한다.

**NFR-AC-004** (No New Crypto Dependency)
신규 외부 crypto 라이브러리 의존성을 추가하지 않는다. `globalThis.crypto.subtle`
(WebCrypto), `globalThis.crypto.randomUUID()` (WebCrypto), 또는 `node:crypto` 만 사용한다.

---

## 4. Constraints (HARD)

- `writeAudit(params: AuditEvent, tx?: AuditDbHandle)` 시그니처 불변 (params shape, return type).
- **C3 fix — concurrency serialization**: `writeAudit` 트랜잭션은 시작 시 `SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 를 획득한 후 직전 행을 읽는다. 이는 chain append 를 직렬화하여 READ COMMITTED 에서의 fork (DAG) 를 **방지** 한다. 영향: audit write 간 경합(sequential) 으로 처리량 감소 가능 — 단일 audit write P99 5ms 게이트(NFR-AC-001)는 유지되어야 함.
- `audit_logs.previous_hash` 컬럼은 이미 존재 (TEXT). 신규 컬럼은 `chain_seq BIGINT` (migration 0111) 만 허용. 그 외 스키마 migration 금지.
- `lib/audit.ts` 현위치 유지 (`lib/kernel/audit/` 이동 금지 — 별도 SPEC).
- `node:crypto` 또는 `globalThis.crypto.subtle` / `globalThis.crypto.randomUUID()` 만 사용. 외부 hashing 의존성 금지.
- `ci:audit` 게이트 (`scripts/qa/audit-completeness.ts`) 통과 유지.
- **C1 fix — app-side UUID**: `id` 컬럼의 DB `defaultRandom()` 은 defensive fallback 으로 유지하되, `writeAudit` 는 항상 app-side `crypto.randomUUID()` 를 명시적으로 INSERT 한다.

---

## 5. Exclusions (What NOT to Build)

- **EX-001**: `lib/kernel/audit/` 디렉토리로의 `lib/audit.ts` 이동/분할. 본 SPEC은 chain 로직만 추가하며 파일 위치 변경은 별도 리팩터 SPEC.
- **EX-002**: 기존 audit 행(컬럼 0109 추가 이전 행 및 그 이후 NULL 행)의 `previous_hash` UPDATE backfill. append-only 위반.
- **EX-003**: §11.70 HMAC 서명 binding (Issue #321) — 본 SPEC은 §11.10(e) chain 에 한정.
- **EX-004**: R2 cold archive (`lib/audit/cold-storage.ts`) 의 `previousHash` 필드 확장 및 아카이브 시 chain 보존 로직.
- **EX-005**: 실시간 위반 알림 (Slack/Email 발송). 본 SPEC은 audit event 기록까지만 담당.
- **EX-006**: Genesis seed 로의 secret/salt 사용. chain 보안은 append-only + SHA-256 결정론성에 기반하며, 비밀 키는 사용하지 않는다 (HMAC 이 아님).

---

## 6. Acceptance Criteria (요약)

상세 시나리오는 `acceptance.md` 참조. 아래 요약 + §7 Traceability Matrix.

- AC-1: 신규 행 INSERT 시 `previous_hash` 가 64-char hex 로 populate 됨.
- AC-2: 연속 INSERT 시 chain 이 끊김 없이 이전 해시 참조.
- AC-3: `writeAudit(params, tx)` tx 롤백 시 해시도 함께 롤백.
- AC-4: 기존 **191** 개 호출 지점 (실측) 변경 없이 통과 (시그니처 호환).
- AC-5: `verifyAuditChain` 이 `row_N` 변조 시 `row_{N+1}.previous_hash ≠ chainHash_N` 로 정확히 탐지 (C2 점화식).
- AC-5b (M2): canonical 필드 순서 변경 시 해시 달라짐.
- AC-5c (M1): genesis (빈 테이블) populate 시 `chainHash_0 = "<genesis>"` sentinel 사용.
- AC-6: NULL segment 경계에서 false positive 없음.
- AC-7: 크론이 위반 시 alert audit event 를 system actor 로 기록.
- AC-8: 빈 윈도우 graceful 종료.
- AC-9 (H2): `AuditDbHandle` widening 이 기존 ~24개 `db.transaction` 호출 지점과 호환됨 (typecheck green).
- AC-10 (C3): 동시 2개 `writeAudit` tx 가 직렬화되어 chain fork 가 발생하지 않음 (advisory lock).

---

## 7. Traceability Matrix (M4)

| Acceptance Criterion | Spec Requirement | Edge Case / Note |
|---|---|---|
| AC-1 | REQ-AC-001, REQ-AC-005, REQ-AC-006, REQ-AC-012 | Genesis path: REQ-AC-003 |
| AC-2 | REQ-AC-001, REQ-AC-005, REQ-AC-014 | chain_seq tie-break |
| AC-3 | REQ-AC-002 | tx rollback atomicity |
| AC-4 | REQ-AC-004, REQ-AC-013 | 191 callers (H1) |
| AC-5 | REQ-AC-007 (C2 recurrence), REQ-AC-005 | tamper at row_N → break at row_{N+1} |
| AC-5b (M2) | REQ-AC-005 | field-order sensitivity |
| AC-5c (M1) | REQ-AC-003 | genesis sentinel |
| AC-6 | REQ-AC-008 | NULL = segment start |
| AC-7 | REQ-AC-009, REQ-AC-011 | alert action enum |
| AC-8 | REQ-AC-010 | empty window graceful |
| AC-9 (H2) | REQ-AC-013 | AuditDbHandle select capability |
| AC-10 (C3) | §4 Constraints (advisory lock) | fork prevention |
| NFR-AC-001 (m7) | NFR-AC-001 | P99 ≤ 5ms bench |

---

## 8. Open Questions (run-phase 해결)

1. Canonical 직렬화: `JSON.stringify` (sorted keys) vs delimiter-join — run phase에서 성능/가독성 비교 후 확정.
2. Alert audit action 값: `audit_chain.violation_detected` 신규 enum 추가 vs 기존 action 재사용 — migration 0111에서 enum 추가 여부.
3. 크론 주기: daily 24h 윈도우 권장. weekly 옵션 검토.
4. Genesis sentinel literal: 본 SPEC 은 `"<genesis>"` 채택. run phase 에서 상수로 고정.
5. **m3 (run-phase 문서 수정)**: `migrations/0109_impact_wizard_columns.sql` 헤더 주석 라인 6 의 `previousHash (bytea)` → `previous_hash TEXT (64-char hex)` 로 정정 (header bug fix, schema 변경 없음).

---

## 9. Run-Phase Decisions (M0-M3, 2026-07-06)

### 9.1 Open Questions 해결

1. **Canonical 직렬화**: `JSON.stringify` (REQ-AC-005 고정 필드 순서 삽입 + meta_json deep sorted keys) 채택. `lib/signature/hash.ts` 패턴 일관. Field-order sensitivity (AC-5b) 만족.
2. **Alert action**: `audit_chain.violation_detected` 신규 enum (migration 0111) 채택.
3. **크론 주기**: daily 09:00 UTC (`AUDIT_CHAIN_VERIFY_CRON = '0 9 * * *'`). 단 **풀체인 verify**로 실행 (24h window는 boundary row의 expected previous_hash를 알 수 없어 tamper-evidence 약화).
4. **Genesis sentinel**: `GENESIS_SENTINEL = '<genesis>'` 상수 고정.
5. **m3**: 0109 헤더 수정 완료.

### 9.2 ⚠️ SPEC 점화식 모순 — Option A 채택 (amendment 대상)

REQ-AC-007 (normative EARS SHALL)은 `row_N.previous_hash MUST equal chainHash_{N-1}` (전방향 체인, Option A)로 명시. 반면 AC-5c 문장은 genesis row의 `previous_hash = SHA256(canonical(row)‖'<genesis>')` (= chainHash_1, hex)로 기술. 이 두 명세는 **genesis row의 previous_hash 값에 대해 양립 불가**:

- **Option A (REQ-AC-007 + AC-5 + M1 plan INSERT)**: genesis `previous_hash = "<genesis>"` literal. AC-5 변조 탐지 메커니즘이 row_{N+1}에서 동작. 컬럼명 `previous_hash` 의미 일치. Bitcoin 블록체인 패턴.
- AC-5c 직독 (Option A'): genesis `previous_hash = chainHash_1` (hex). AC-5 탐지 불가 (row_{N-1} 자체 검사로 전락).

**본 run-phase는 Option A로 구현** (REQ-AC-007 normative 준수 + 암호학적 무결성 + 업계 표준). **AC-5c/AC-1은 sync 단계에서 "non-genesis rows" / "genesis sentinel exception"으로 amendment 필요** (plan-auditor 검토 권장).

### 9.3 게이트 결과 (직검)

- typecheck 0 에러 / lint 0 에러 (lint:hex full) / ci:audit PASS
- 단위 15/15 (hash-chain 9 + verify-chain 6) + 실DB 통합 4/4 (AC-1/2/3/9/10)
- migration 0111 실DB 적용 후 런타임 chain 증빙 (seq 1-N hex 연쇄)
- 풀 스위트 4703 passed (잔여 2 실패는 M0 기준선 동일 — 사전 존재: CER evidence-synthesis LLM stub, frontend-shell metadata flaky)
- writeAudit 호출 지점 193 = 기존 192 + cron 신규 1; 시그니처 호환 typecheck green으로 증뱅

