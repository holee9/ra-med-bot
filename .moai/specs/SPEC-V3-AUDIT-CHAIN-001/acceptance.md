# Acceptance Criteria — SPEC-V3-AUDIT-CHAIN-001 (v0.2.0)

audit_log SHA-256 hash chain strengthening (v3 Phase E / D-1).

본 파일은 Given-When-Then 시나리오와 관측 가능한 증거를 정의한다.
모든 AC 는 테스트 또는 런타임 점점으로 검증되어야 한다 (Agent Core Behavior #6).

> **v0.2.0 (2026-07-06)**: C1/C2/C3/H1/H2 해소. AC-5 재작성 (C2 점화식), AC-5b (M2), AC-5c (M1), AC-9 (H2), AC-10 (C3) 신규. AC-4 카운트 197→191 (H1). EC-1 재작성 (fork tolerated → prevented). typo m4/m5 수정.

---

## AC-1: 신규 행 INSERT 시 previous_hash 자동 populate

**Given** `audit_logs` 테이블이 비어 있거나 직전 행의 `previous_hash` 가 존재하는 상태에서,
**When** `writeAudit({ actor_id: null, action: 'llm.call', resource_type: 'message', resource_id: 'm-1' })` 를 호출하면,
**Then** 새로 INSERT 된 행의 `previous_hash` 컬럼이 64자 소문자 hex 문자열로 채워진다.

**증거 (observable)**:
- `SELECT previous_hash FROM audit_logs WHERE id = <new>` 결과가 `/^[0-9a-f]{64}$/` 매치.
- SHA-256 canonical 입력을 독립적으로 재계산한 결과와 일치.
- `id` 컬럼이 app-side `crypto.randomUUID()` 로 생성한 값과 일치 (C1, REQ-AC-012).

---

## AC-2: 연속 INSERT chain 연속성

**Given** 행 A 가 INSERT 된 후,
**When** 행 B 를 `writeAudit(...)` 로 INSERT 하면,
**Then** 행 B 의 `previous_hash` 계산 입력에 행 A 의 chain hash 값이 포함된다.

**증거**:
- 행 B 의 `previous_hash` 를 계산한 canonical string 안에 행 A 의 chain hash (hex) 가 prefix 로 포함됨을 독립 재계산으로 확인.
- 행 A 의 필드를 바꾸면 행 A 의 chain hash 가 바뀌고 행 B 의 `previous_hash` 재계산 결과도 달라짐 (cascade integrity).

---

## AC-3: Transaction 원자성 (tx 롤백 시 해시도 롤백)

**Given** caller 가 `db.transaction(async (tx) => { await mutation(); await writeAudit(params, tx); throw new Error('rollback'); })` 을 실행할 때,
**When** tx 가 롤백되면,
**Then** audit 행 INSERT 와 해시 계산 결과가 모두 롤백된다. audit_logs 에 행이 남지 않는다.

**증거**:
- `SELECT count(*) FROM audit_logs WHERE id = <would-be>` = 0.
- 동일 caller 의 다음 호출 시 직전 행 조회가 롤백된 행을 보지 않는다 (chain 일관성 유지).
- advisory_xact_lock 도 tx 단위라 롤백 시 자동 해제됨 (C3).

---

## AC-4: 기존 호출 지점 시그니처 호환 (회귀 게이트, H1 fix)

**Given** **191** 개 프로덕션 `writeAudit(...)` 호출 지점 (실 grep 결과; H1 fix) 이 변경되지 않은 상태에서,
**When** `pnpm ci:audit` (또는 lint/typecheck) 를 실행하면,
**Then** 시그니처 관련 에러가 0건이다. 모든 기존 호출이 그대로 컴파일/런타임 통과한다.

**증거**:
- `pnpm typecheck` 0 errors.
- `grep -rn "writeAudit(" --include="*.ts" --include="*.tsx" lib app | grep -v __tests__ | grep -v "export async function writeAudit" | wc -l` = **191** (이전과 동일 — 회귀 게이트). distinct 파일 = 117.
- `pnpm ci:audit` 통과.

> H1 fix 근거: 2026-07-06 실 grep. 구 버전 "197" 은 부정확. research.md §2 참조.

---

## AC-5: verifyAuditChain 변조 탐지 (C2 점화식 — binary-testable)

**Given** 3개의 연속 audit 행 (A → B → C) 이 올바른 chain 으로 INSERT 된 후,
**When** 행 B 의 `meta_json` 을 임의로 변조하고 (테스트 환경에서 append-only 트리거를 일시적 bypass 또는 검증 전용 복제본 사용) `verifyAuditChain({ from: A.created_at, to: C.created_at })` 를 호출하면,
**Then** C2 점화식에 의해 행 B 의 변조가 `chainHash_B` 변화 → `row_C.previous_hash ≠ chainHash_B` 위반으로 탐지된다. 반환된 위반 배열이 `{ rowId: C.id, expected: chainHash_B (재계산), actual: row_C.previous_hash }` 형태로 행 C 를 보고한다.

**C2 점화식 (binary-testable assertion)**:
- `chainHash_0 = "<genesis>"` (literal sentinel).
- `chainHash_N = SHA256( canonical(row_N.fields_without_previous_hash) ‖ chainHash_{N-1} )` (N ≥ 1).
- Assertion: `row_N.previous_hash MUST equal chainHash_{N-1}`.
- 행 B (`row_B`) 필드 변조 → `chainHash_B` 변화 → `row_C.previous_hash` (== 구 `chainHash_B`) ≠ 신 `chainHash_B` → 위반.

**증거**:
- 위반 배열 길이 ≥ 1, `rowId` === 행 C 의 UUID (변조된 행 B 의 다음 행).
- 행 B 자체도 cascade 위반으로 보고될 수 있음 (행 A 의 chain hash 가 안 바뀌었으므로 `row_B.previous_hash` == 구 `chainHash_A` 유지 → 행 B 자체는 위반 아님; 다음 행 C 부터 위반). 이 cascade 동작은 점화식과 일치함을 테스트로 확인.

> 구현 참고: 테스트 환경에서 append-only 트리거를 우회하는 방법은 run phase 에서 설계.
> 예: (a) 테스트 전용 schema 의 복제 테이블 사용, (b) 검증 함수 자체를 직접 호출하여
> 행 데이터를 메모리에서 변조한 입력으로 재계산 (단위 테스트 방식).

> m4 fix: "트리저를" → "트리거를" (typo).

---

## AC-5b (M2): Canonical 필드 순서 민감성

**Given** 동일 값들을 가지지만 canonical 직렬화 순서가 다른 두 행 row_X (정상 순서) 와 row_X' (`actor_id` 와 `action` 필드를 swap 한 변형) 가 있을 때,
**When** 각각의 chain hash 를 독립 계산하면,
**Then** 두 해시가 달라야 한다. 필드 순서가 바뀌면 반드시 해시가 달라짐 (REQ-AC-005).

**증거**:
- `computeAuditRowHash(prev, row_X) !== computeAuditRowHash(prev, row_X_swapped)`.
- 위반 배열에 순서가 바뀐 행이 포함됨.

---

## AC-5c (M1): Genesis populate (빈 테이블 첫 행)

**Given** `audit_logs` 테이블이 완전히 비어 있는 상태에서,
**When** 최초의 `writeAudit(...)` 가 호출되면,
**Then** 신규 행의 `previous_hash` 는 `"<genesis>"` literal sentinel 이며 (Option A — REQ-AC-007 normative 준수: genesis row 의 `previous_hash = chainHash_0 = "<genesis>"`), `chain_seq = 1` 이다.

> **Amendment (2026-07-09, #357)**: 이전 AC-5c 표현 `previous_hash = SHA256(canonical(row)‖"<genesis>")` (= chainHash_1, 64-char hex) 는 **폐기**. REQ-AC-007 의 EARS SHALL (`row_N.previous_hash = chainHash_{N-1}`, genesis 시 `chainHash_0 = "<genesis>"` literal) 이 normative 단일 진실원이며, 구현(lib/audit/hash-chain.ts:24-44 `GENESIS_SENTINEL`) 이 이를 따른다. AC-1 의 genesis 케이스도 동일하게 sentinel exception 적용.

**증거**:
- `SELECT previous_hash, chain_seq FROM audit_logs WHERE id = <first>` → `"<genesis>"` literal (유일한 non-64-char-hex `previous_hash`), `chain_seq = 1`.
- 독립 재계산: `row_1.previous_hash == chainHash_0 == "<genesis>"`. `chainHash_1` (= SHA256(canonical(row_1)‖"<genesis>")) 은 `row_2.previous_hash` 에 저장됨.
- `verifyAuditChain` 은 이 행을 위반으로 보고하지 않음 (segment 시작).

---

## AC-6: NULL segment 경계 (전략 B, false positive 없음)

**Given** `previous_hash = NULL` 인 과거 행 (pre-chain) P 와 그 이후 chain 이 시작된 행 Q 가 있을 때,
**When** `verifyAuditChain({ from: P.created_at, to: <future> })` 를 호출하면,
**Then** P 행 자체는 위반으로 보고되지 않고, Q 부터의 chain 만 검증된다.

**증거**:
- 반환된 위반 배열에 `rowId: P.id` 가 없음.
- Q 의 `previous_hash` 가 P 의 hash 와 무관하게 독립적으로 검증됨.

---

## AC-7: 크론 위반 시 alert audit event 기록

**Given** 일일 크론 `audit-chain-verify-daily` 가 발화하고 지난 24시간 윈도우에 위반이 존재할 때,
**When** 크론 함수가 실행을 완료하면,
**Then** `audit_logs` 에 단일 system-actor audit event 가 기록된다 (예: action `audit_chain.violation_detected`, resource_type `audit_logs`, meta_json 에 위반 row id 배열).

**증거**:
- `SELECT count(*) FROM audit_logs WHERE action = 'audit_chain.violation_detected' AND created_at >= <cron_run_time>` ≥ 1.
- meta_json.violations 배열 길이 ≥ 1.
- 크론 자체는 실패하지 않음 (실패 처리 audit 는 별도).

---

## AC-8: 빈 윈도우 graceful 종료

**Given** 지난 24시간에 audit 행이 0개인 상태에서,
**When** 크론이 발화하면,
**Then** 위반 없이 정상 종료하고, alert audit event 를 기록하지 않는다.

**증거**:
- 크론 exit code 0.
- `SELECT count(*) FROM audit_logs WHERE action = 'audit_chain.violation_detected'` = 0 (해당 크론 run 기준).

> m5 fix: "크른" → "크론" (typo).

---

## AC-9 (H2): AuditDbHandle widening 호환성

**Given** 기존 ~24개 `db.transaction(async (tx) => { ... writeAudit(params, tx) })` 호출 지점이 존재하며,
**When** `AuditDbHandle` 타입이 `{ insert: ...; select: ... }` 로 widen 될 때,
**Then** 모든 기존 tx 전달 호출이 typecheck error 없이 호환된다. Drizzle `PgTransaction` 은 이미 두 capability 를 가지므로 real tx 객체는 변경 불필요.

**증거**:
- `pnpm typecheck` 0 errors.
- narrowed tx wrapper (존재할 경우) 는 감사되어 widening 또는 교체됨.

---

## AC-10 (C3): 동시성 직렬화 — chain fork 방지

**Given** 두 개의 동시 `writeAudit` tx (T1, T2) 가 같은 직전 행을 대상으로 동시에 시작될 때,
**When** 두 tx 가 `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 을 획득하려 하면,
**Then** 한 tx 가 먼저 lock 을 획득해 직전 행을 읽고 INSERT 한 후 커밋할 때까지 다른 tx 는 대기한다. 순차적으로 처리되어 chain fork (DAG) 가 발생하지 않는다.

**증거**:
- 동시 2 tx 실행 후 `SELECT count(*) FROM audit_logs WHERE previous_hash IS NULL AND created_at >= <window>` 결과 = genesis 인 경우만 (segment 시작). 동시 INSERT 로 인한 fork 없음.
- T2 의 `previous_hash` 가 T1 이 INSERT 한 행의 chain hash 를 참조함을 확인.
- P99 5ms 게이트 (NFR-AC-001) 유지 — advisory lock 대기 시간 포함.

---

## Edge Cases

### EC-1 (C3 rewrite): 동시 INSERT — fork PREVENTED (구 version 은 "tolerated" 였음)

두 tx 가 동시에 마지막 행을 읽고 각자의 해시를 계산하려 시도할 수 있음.
**기대 동작 (C3 fix)**: `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 가 tx 시작 시점에 직전 행 SELECT 전에 획득되므로, 두 tx 는 **직렬화** 된다. READ COMMITTED 격리에서도 chain fork (DAG) 는 발생하지 않는다. 본 SPEC 은 더 이상 fork 를 "허용" 하지 않음 — tamper-evidence (단일 linear chain) 가 핵심 가치이므로 fork 는 설정 불가. 영향: audit write 처리량 감소 (sequential) 가능하지만 P99 5ms 게이트 (NFR-AC-001) 가 상한선.

> 구 version (v0.1.0) 은 "fork tolerated" 였으나 이는 tamper-evidence 주장과 모순 (Critical C3). 본 version 0.2.0 부터 fork PREVENTED.

### EC-2: 매우 큰 meta_json

`meta_json` 이 수십 KB 인 경우 canonical 직렬화 비용.
**기대 동작**: SHA-256 은 입력 크기에 선형 비례하지만 실사용 범위 (수 KB) 에서 P99 5ms 이내 유지 (NFR-AC-001, m7 bench).

### EC-3: created_at 동일 타이밍 (M3 — chain_seq tie-break)

두 행이 동일 `created_at` (마이크로초 단위까지 동일) 을 가질 수 있음.
**기대 동작 (M3 fix)**: chain 순서는 `chain_seq BIGINT` monotonic counter 로 tie-break (`ORDER BY chain_seq DESC, created_at DESC, id DESC`). UUID tie-break 의 semantic 한계(분산 생성 순서 비보장) 제거 (REQ-AC-014). 검증 함수도 동일 규칙 적용.

### EC-4: tx handle 없는 호출 (autocommit)

`writeAudit(params)` (tx 생략) — singleton db 사용.
**기대 동작**: advisory lock 획득 + 직전 행 SELECT + 해시 계산 + INSERT 가 autocommit 안에서 실행.
advisory_xact_lock 은 autocommit tx 안에서도 동일하게 직렬화 (C3).

### EC-5: genesis 행의 created_at 순서

chain 의 첫 행이 반드시 테이블의 첫 행일 필요는 없음. NULL marker 가 있는 모든 행이 segment 시작.
**기대 동작**: verifyAuditChain 은 각 segment 를 독립적으로 처리.

---

## Traceability Matrix (M4)

| AC | spec.md REQ | Notes |
|---|---|---|
| AC-1 | REQ-AC-001, REQ-AC-005, REQ-AC-006, REQ-AC-012 | + app-side UUID (C1) |
| AC-2 | REQ-AC-001, REQ-AC-005, REQ-AC-014 | chain_seq tie-break |
| AC-3 | REQ-AC-002 | tx rollback atomicity |
| AC-4 | REQ-AC-004, REQ-AC-013 | 191 callers (H1) |
| AC-5 | REQ-AC-007 (C2 점화식), REQ-AC-005 | tamper at row_B → break at row_C |
| AC-5b | REQ-AC-005 | field-order sensitivity (M2) |
| AC-5c | REQ-AC-003 | genesis sentinel (M1) |
| AC-6 | REQ-AC-008 | NULL = segment start |
| AC-7 | REQ-AC-009, REQ-AC-011 | alert action enum |
| AC-8 | REQ-AC-010 | empty window graceful |
| AC-9 | REQ-AC-013 | AuditDbHandle select (H2) |
| AC-10 | §4 Constraints (advisory lock) | fork prevention (C3) |

---

## Definition of Done

- [ ] spec.md 의 모든 REQ-AC-* 와 NFR-AC-* 가 테스트로 검증됨.
- [ ] 위 12개 AC (AC-1 ~ AC-10 + AC-5b/AC-5c) 의 증거가 테스트 출력 또는 런타임 점검으로 제공됨.
- [ ] `pnpm ci:audit`, `pnpm ci:lint`, `pnpm ci:test` 모두 green.
- [ ] 기존 **191** 개 호출 지점 회귀 없음 (시그니처 호환 AC-4, H1).
- [ ] append-only 트리거와 충돌 없음 (UPDATE/DELETE 미사용 확인).
- [ ] 신규 crypto 의존성 0건 (NFR-AC-004).
- [ ] migration 0111 (`chain_seq` + 인덱스 + alert action) 이 적용되었고 rollback 파일 존재.
- [ ] migration 0109 헤더 주석 오타 정정 (m3).
- [ ] 크론 이벤트 등록 (`lib/inngest/functions.ts`) 반영.
- [ ] advisory_xact_lock 으로 동시성 직렬화 검증 (AC-10, C3).
- [ ] `vitest --bench` P99 ≤ 5ms (NFR-AC-001, m7).
