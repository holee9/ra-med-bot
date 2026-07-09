# Audit Hash Chain — Ops Runbook

> SPEC-V3-AUDIT-CHAIN-001 (Phase E, #356 / #357). 21 CFR Part 11 §11.10(c) 감사 추적 무결성.

## 개요

`audit_logs` 테이블은 SHA-256 **forward hash chain**으로 무결성을 보장한다. 각 행의 `previous_hash` 컬럼은 직전 행의 chain hash를 저장하여, 임의 행 변조 시 다음 행의 `previous_hash` 불일치로 탐지된다 (Bitcoin 패턴, Option A).

## 점화식 (REQ-AC-007 normative)

- `chainHash_0 = "<genesis>"` (literal sentinel)
- `chainHash_N = SHA256( canonical(row_N.fields_without_previous_hash) ‖ chainHash_{N-1} )`
- `row_N.previous_hash = chainHash_{N-1}` — genesis row만 예외: `previous_hash = "<genesis>"` literal (유일한 non-64-char-hex 값).
- canonical 순서(REQ-AC-005): `previous_hash ‖ id ‖ actor_id ‖ action ‖ resource_type ‖ resource_id ‖ conversation_id ‖ meta_json(canonicalized) ‖ created_at`.
- 구현: `lib/audit/hash-chain.ts` (`GENESIS_SENTINEL`, `computeAuditRowHash`, `verifyAuditChain`).

> **AC-5c amendment (2026-07-09, #357)**: genesis row의 `previous_hash`는 `SHA256(...‖"<genesis>")` (= chainHash_1)가 **아니라** `"<genesis>"` literal (chainHash_0)이다. REQ-AC-007 EARS SHALL이 normative 단일 진실원.

## Backfill 정책 (Strategy B — 본 문서 핵심)

기존(pre-chain) audit 행들은 `previous_hash = NULL`이다. 이들을 chain에 편입하려 UPDATE하면 append-only(REQ-FND-044 immutability trigger) 위반 → **불가**.

대신 **Strategy B**: NULL `previous_hash` 행은 새 chain **segment의 시작**으로 처리한다. `verifyAuditChain`은 NULL 행에서 segment를 reset하고, 그 행 자체는 위반으로 보고하지 않는다. 즉, forward chain은 NULL 이후부터 재계산된다.

- **영향**: pre-chain legacy 행(도입 시 약 743개)은 첫 chain segment 구성원이며, 이후 행들은 연속 chain. 변조 탐지는 각 segment 내에서 유효하다.
- **운영 판정**: NULL segment는 **정상 상태**(legacy)이며 위반이 아니다. `verifyAuditChain`이 NULL 행을 "위반 아님"으로 처리하는 것이 올바른 동작이다.

## 검증 절차

1. **Daily cron** (`lib/inngest/audit/audit-chain-verify-daily.ts`, 09:00 UTC): 직전 24시간 audit 행에 대해 `verifyAuditChain` 실행. 위반 시 `audit_chain.violation_detected` action을 system actor로 audit event 기록.
2. **수동 검증**: `verifyAuditChain({ from, to })` (시간 구간) 또는 `verifyAuditChain({ offset, limit })` (row 범위) 호출. 위반 위치(행 id, expected vs actual `previous_hash`) 배열 반환.

## 위반 대응

1. 위반 행 id + expected/actual `previous_hash` 확인.
2. 해당 행의 canonical 필드 변조 여부 조사 (`id` / `actor_id` / `action` / `resource_type` / `resource_id` / `meta_json` / `created_at`).
3. 가능 원인: append-only 위반(UPDATE/DELETE 시도 — `audit_logs_no_mutation` trigger가 차단해야), app-side hash 버그, 또는 동시 INSERT fork(advisory lock이 직렬화하므로 발생 불가해야 함).
4. 21 CFR Part 11 §11.10(c): 감사 추적 무결성 위반은 **규제 이벤트**. 즉시 문서화 + 근본 원인 조사 + (필요 시) 규제 부서 보고.

## Advisory Lock 경합

`writeAudit`은 `pg_advisory_xact_lock(hashtext('audit_logs_chain'))`으로 chain INSERT를 직렬화한다 (REQ-AC-006, EC-1 fork PREVENTED). 동시 트랜잭션은 순차 처리된다. 경합 시 대기 → P99 지연.

- **모니터링**: writeAudit P99 지연 상승 시 lock 경합 의심. 동시 audit INSERT 빈도 확인.
- **완화**: audit는 append-only라 경합이 낮다. 경합이 지속하면 batch audit 또는 비동기 큐 검토 (현재는 불필요).
- **NFR-AC-001**: P99 ≤ 5ms는 lock 대기 + INSERT round-trip + app-side hash를 모두 포함한 full writeAudit path 기준.

## 벤치 (M4 / m7)

`pnpm bench:audit` — app-side hash cost (`canonicalizeMetaJson` + `computeAuditRowHash`) 측정. CI daily (`.github/workflows/audit-bench.yml`). full path P99(advisory lock + INSERT 포함)는 본 bench가 아닌 ops 모니터링으로 관측한다.

## 참조

- SPEC: `.moai/specs/SPEC-V3-AUDIT-CHAIN-001/` (spec.md §9.2 Option A 근거, acceptance.md AC-5c amendment)
- 구현: `lib/audit/hash-chain.ts`, `lib/audit.ts` (writeAudit), `lib/inngest/audit/audit-chain-verify-daily.ts`
- 이슈: #356 (M0-M3 구현), #357 (AC-5c amendment + M4 bench + M5 본 문서)
