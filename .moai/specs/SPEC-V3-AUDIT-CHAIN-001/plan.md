# Implementation Plan — SPEC-V3-AUDIT-CHAIN-001 (v0.2.0)

audit_log SHA-256 hash chain strengthening (v3 Phase E / D-1).

본 파일은 run-phase 구현 가이드. 우선순위 라벨 (High/Medium/Low) 만 사용하며
시간 추정은 포함하지 않는다 (MoAI HARD 규칙).

> **v0.2.0 (2026-07-06)**: plan-auditor FAIL verdict 반영 — C1 (app-side UUID), C2 (verify recurrence), C3 (advisory lock), H1 (191 callers), H2 (AuditDbHandle widening), M1-M4, m3/m6/m7.

---

## 1. 기술 접근 방식 (Technical Approach)

### 1.1 아키텍처 결정 (run-phase 확정 전까지 권장안)

| 결정 | 권장 | 이유 |
|---|---|---|
| 해시 유틸 위치 | `lib/audit/hash-chain.ts` (신규) | `writeAudit` 과 cycle 없이 분리, 테스트 용이 |
| Canonical 형태 | stable JSON.stringify (sorted keys) | 기존 `lib/signature/hash.ts` 패턴 일관성 |
| Crypto API | `globalThis.crypto.subtle.digest('SHA-256')` + `globalThis.crypto.randomUUID()` | Edge 호환, 신규 의존성 없음 (NFR-AC-004). Node 22 검증 완료. |
| App-side UUID (C1) | `writeAudit` 내부에서 `crypto.randomUUID()` 생성 → INSERT `id` 명시 + canonical `id` 입력 | DB `defaultRandom()` 은 fallback. append-only UPDATE 없이 hash 계산 가능. |
| 직전 행 조회 | `SELECT previous_hash, chain_seq FROM audit_logs ORDER BY chain_seq DESC, created_at DESC, id DESC LIMIT 1` | `idx_audit_logs_created_at` (M4) + `chain_seq` monotonic tie-break (M3) |
| Genesis 처리 (C2) | `chainHash_0 = "<genesis>"` literal sentinel. row_N.previous_hash = chainHash_{N-1}. | 정확한 점화식 (C2). NULL = segment start. |
| 동시성 직렬화 (C3) | `SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))` at tx start, BEFORE prev-row SELECT | READ COMMITTED 에서 chain fork 방지. SERIALIZABLE 비용 회피. |
| `AuditDbHandle` 확장 (H2) | `{ insert: typeof db.insert; select: typeof db.select }` structural type | Drizzle PgTransaction 은 이미 두 capability 보유 — 기존 tx 호출 24곳은 변경 없음. |
| Alert action 값 | 신규 enum `audit_chain.violation_detected` (migration 0111) | 기존 action 재사용보다 명확 |
| Tie-break (M3) | `chain_seq BIGINT NOT NULL` 신규 컬럼 (migration 0111) | UUID tie-break 의 semantic 한계(분산 순서 비보장) 제거 |

### 1.2 핵심 설계 원칙

1. **Additive Only**: `writeAudit` 외부 시그니처 불변. 내부 helper 추가만 허용.
2. **TX-bound Computation**: 해시 계산 + advisory lock + INSERT 는 항상 caller tx (또는 singleton db autocommit) 안에서.
3. **Single SHA-256 Call per INSERT**: 직전 행 1건 SELECT + 1회 해시. Full scan 금지.
4. **Strategy B Backfill**: 기존 행 UPDATE 금지. NULL = genesis marker (segment 시작).
5. **App-side ID (C1)**: UUID 를 app 에서 사전 생성하여 INSERT 와 hash 입력에 동일 값 사용.
6. **Serialize appends (C3)**: advisory_xact_lock 으로 chain append 직렬화.

---

## 2. Milestones (우선순위 순)

> **Run-Phase Status (2026-07-06):** ✅ M0 (commit 9445e96) · ✅ M1 · ✅ M2 · ✅ M3 · ✅ M4 gates green (직검). ⏸️ M5 (Backfill 문서화, Priority Low — 후속). ⚠️ AC-5c/REQ-AC-007 점화식 모순은 spec.md §9.2 참조 (Option A 채택, amendment 대상).

### M0 — Schema Migration 0111 (Priority High — M3/C3/C1 선행) ✅

`chain_seq` 컬럼 + 인덱스 + alert action enum 추가.

산출물:
- `migrations/0111_audit_chain.sql`:
  - `ALTER TABLE audit_logs ADD COLUMN chain_seq BIGINT NOT NULL DEFAULT 0;`
  - `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at, id);`
  - `CREATE INDEX IF NOT EXISTS idx_audit_logs_chain_seq ON audit_logs (chain_seq);`
  - `ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'audit_chain.violation_detected';`
- `migrations/0111_audit_chain_rollback.sql` (인덱스/컬럼 삭제; enum 값은 PG 롤백 불가 → 코멘트 명시).
- `migrations/0109_impact_wizard_columns.sql` 헤더 주석 수정 (m3): `previousHash (bytea)` → `previous_hash TEXT (64-char hex)`.
- `lib/db/schema.ts`: `auditLogs` 에 `chainSeq: bigint('chain_seq', { mode: 'number' }).notNull().default(0)` 추가; `AuditAction` union 에 `'audit_chain.violation_detected'` 추가 (lock-step).
- 실DB 적용 테스트 (L-010): `pnpm db:migrate` + `\d audit_logs` + `pg_enum` 확인.

게이트:
- 실DB 마이그레이션 성공 (L-010).
- AC-7 의 action 값 활용 가능.

리스크 완화:
- enum 값 추가는 PG 12+ 에서 transaction-safe (`ADD VALUE IF NOT EXISTS`).
- rollback 불가 → downtime 이 필요한 경우 대안 명시 (run phase).

### M1 — Hash Chain Population (Priority High — C1/C3/H2)

`writeAudit` 이 app-side UUID + advisory lock + `previous_hash` + `chain_seq` 를 자동으로 채우도록 수정.

산출물:
- `lib/audit/hash-chain.ts` (신규):
  - `computeAuditRowHash(prevChainHash, row)` 순수 함수 (REQ-AC-005 canonical order, REQ-AC-006 SHA-256).
  - `GENESIS_SENTINEL = "<genesis>"` 상수 (C2).
  - `fetchPreviousChainLink(client)` 헬퍼: `SELECT previous_hash, chain_seq FROM audit_logs ORDER BY chain_seq DESC, created_at DESC, id DESC LIMIT 1`.
- `lib/audit.ts` `writeAudit` 수정:
  - `AuditDbHandle` widening (H2): `{ insert: typeof db.insert; select: typeof db.select }`.
  - tx 시작(또는 autocommit inline) 후 즉시 `SELECT pg_advisory_xact_lock(hashtext('audit_logs_chain'))` (C3).
  - `crypto.randomUUID()` 사전 생성 (C1) → `id` PK 명시 + canonical 입력.
  - `fetchPreviousChainLink` → `chainHash_prev` (= row.previous_hash or `GENESIS_SENTINEL`) 산출.
  - `chainHash_N = SHA256(canonical(row.fields_without_previous_hash) ‖ chainHash_{N-1})` 계산 (C2 점화식).
  - INSERT `id`, `previous_hash = chainHash_prev`, `chain_seq = prev_seq + 1`.
- `lib/audit/__tests__/hash-chain.test.ts` (신규): canonical 안정성, 결정론성, 필드 순서 민감성 (M2), GENESIS sentinel 처리.
- **H2 호환성 감사 (신규 task)**: ~24개 `db.transaction` 호출 지점 (`grep -rn "db.transaction" --include="*.ts" lib app`) 의 tx 객체가 widened `AuditDbHandle` 을 만족하는지 typecheck 로 검증. Drizzle `PgTransaction` 은 이미 `insert` + `select` 를 모두 지원하므로 real tx 는 변경 없이 호환될 것으로 예상. narrowed tx (예: custom wrapper) 가 발견되면 run phase 에서 widening 또는 cast 로 해결.

게이트:
- AC-1, AC-2, AC-3, AC-5c (M1 genesis), AC-9 (H2), AC-10 (C3) 충족.
- `pnpm ci:test` green + `pnpm typecheck` green.

리스크 완화:
- 191개 호출 지점 회귀 → 시그니처 변경 없음 (AC-4).
- advisory lock 경합 → P99 5ms 게이트 (NFR-AC-001, m7 bench) 로 상한선 부여.

### M2 — Verification Utility (Priority High — C2)

`verifyAuditChain(window)` 순수 함수 구현.

산출물:
- `lib/audit/verify-chain.ts` (신규): `verifyAuditChain({ from, to } | { offset, limit }) → Violation[]`.
  - segment-aware (NULL previous_hash = 새 segment 시작).
  - **정확한 점화식 (C2)**: forward 로 `chainHash_N` 재계산, `row_{N+1}.previous_hash === chainHash_N` 체크.
- `lib/audit/__tests__/verify-chain.test.ts` 단위 테스트:
  - 정상 chain 위반 0건 (AC-6).
  - 1행 변조 (`row_N.fields` 변경) → `row_{N+1}` 위치 위반 보고 (AC-5).
  - canonical 필드 순서 변경 → 해시 불일치 (AC-5b, M2).
  - GENESIS sentinel 처리 (AC-5c).
  - NULL segment 경계 정상 처리.

게이트:
- AC-5, AC-5b, AC-5c, AC-6 충족.
- `pnpm ci:test` green.

### M3 — Periodic Verification Cron (Priority Medium)

Inngest `audit-chain-verify-daily` 등록.

산출물:
- `lib/inngest/audit/audit-chain-verify-daily.ts` (신규):
  - `STANDARDS_REVISION_CRON` 패턴 차용, lazy import `lib/audit` + `lib/audit/verify-chain`.
  - 24h 윈도우 verify → 위반 시 `writeAudit({ action: 'audit_chain.violation_detected', ... })`.
- `lib/inngest/client.ts`: `AUDIT_CHAIN_VERIFY_TRIGGER` 이벤트 추가 (선택).
- `lib/inngest/functions.ts`: 신규 함수 배열 추가.
- 크론 테스트 (`lib/inngest/__tests__/`): 빈 윈도우, 위반 존재, 정상 종료 3 케이스.

게이트:
- AC-7, AC-8, EC-2 (큰 meta_json) 충족.
- `pnpm ci:test` green.

### M4 — Gates & 회귀 검증 + Bench (Priority High — m7)

모든 게이트 통과 및 기존 호출 지점 회귀 없음 최종 확인.

산출물:
- `pnpm ci:lint` (lint:hex full, L-008).
- `pnpm ci:test` (full run, L-009).
- `pnpm ci:audit` 통과 (writeAudit literal gate).
- `pnpm typecheck` green (H2 widening 포함).
- 실DB audit_logs `\d` 로 컬럼/인덱스 확인 (`chain_seq`, 인덱스 포함).
- staged 범위 직접 `git diff --staged` 검증 (L-009).
- `lib/audit/__tests__/writeAudit.bench.ts` (신규, m7): `vitest --bench` 1000회 연속 호출 P99 측정. 게이트: P99 ≤ 5ms (NFR-AC-001). CI daily regression suite 로 분리.

게이트:
- 모든 AC green.
- **191** 개 호출 지점 grep 카운트 불변 (H1 fix).
- L-013 (3중 맹점 방지): 정적 테스트 + CI mock + self-report 너머 실DB 실행 확인.

### M5 — Backfill 정책 문서화 (Priority Low)

전략 B 결정을 코드 주석과 ops 문서에 명시.

산출물:
- `lib/audit.ts` 주석: NULL previous_hash = genesis, append-only 위반 없이 forward chain 만 적용.
- `docs/ops/audit-chain.md` (신규, ops runbook): 검증 절차, 위반 대응, segment 의미, advisory lock 경합 영향.
- 본 SPEC `research.md` 와 교차 참조.

게이트:
- 문서 리뷰.
- EC-6 (과거 행 위반 false positive) 방지 확인.

---

## 3. 의존성 및 순서 (m6 fix — M4 중복 제거)

```
M0 (schema 0111) ──→ M1 (chain populate, C1/C3/H2) ──→ M3 (cron)
                                    │
                                    └──→ M2 (verify util, C2) ──┐
                                                                ↓
                                                          M4 (gates + bench)
                                                                │
                                          M5 (docs) ────────────┘
```

- M0 선행 (schema 없이 M1 불가).
- M1, M2 는 M0 완료 후 병렬 가능 (서로 다른 파일).
- M3 는 M1 + M2 완료 후.
- M5 는 M4 와 병렬 가능.
- M4 (gates) 는 모든 구현 마일스톤 (M1, M2, M3) 완료 후. (m6: M4 가 의존성 그래프에 두 번 표시되던 버그 수정 — 단일 종착점.)

---

## 4. 리스크 완화 (writeAudit fan-in 회귀 방지)

`writeAudit` 은 **191개** 프로덕션 호출 지점 (117 distinct files, H1 fix) 을 가진 고 fan-in 함수. 본 SPEC의 최우선
리스크는 시그니처 또는 semantics 변경이 연쇄 회귀를 일으키는 것.

| 리스크 | 확률 | 영향 | 완화 |
|---|---|---|---|
| 시그니처 변경 | 낮음 (HARD 제약) | 높음 (191 파일) | params shape, return type 불변, 선택 tx 유지. typecheck 게이트 |
| tx 누락으로 atomicity 위반 | 중간 | 높음 (Part 11) | 해시 계산 + advisory lock + INSERT 를 동일 tx 에서만 수행. 단위 테스트로 롤백 검증 (AC-3) |
| 직전 행 SELECT 성능 | 중간 | 중간 | `idx_audit_logs_created_at` + `chain_seq` index (M0). LIMIT 1 보장. NFR-AC-001 (m7 bench) |
| 동시 INSERT chain 경쟁 (C3) | 중간 → 낮음 | 높음 → 낮음 | `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` 으로 직렬화. fork 방지. |
| `AuditDbHandle` widening 호환 (H2) | 낮음 | 중간 | Drizzle PgTransaction 은 이미 select+insert 지원. ~24 `db.transaction` 호출 typecheck 감사 (M1 task). |
| append-only 트리거 충돌 | 낮음 | 높음 (runtime fail) | UPDATE/DELETE 미사용. INSERT 만. 단위 테스트로 확인 (AC-4) |
| ci:audit literal gate 위반 | 낮음 | 낮음 | writeAudit 내부 로직은 literal gate 대상 아님. scripts/qa/audit-completeness.ts 통과 |
| enum 값 rollback 불가 (PG) | 중간 | 중간 | 0111 rollback 파일에 명시적 코멘트. prod 적용 전 dev 스테이지 검증 |

---

## 5. 테스트 전략

- **단위 테스트** (vitest): hash-chain 순수 함수, verify-chain 위반 탐지, segment 처리, GENESIS sentinel, canonical 필드 순서 민감성 (M2).
- **통합 테스트** (실DB, L-010): writeAudit 이 tx 안에서 동작, append-only 트리거와 충돌 없음, migration 0111 적용 후 `chain_seq`/인덱스 확인.
- **동시성 테스트 (C3)**: 2개 동시 `writeAudit` tx → advisory lock 으로 직렬화, chain fork 없음 검증 (AC-10).
- **크론 테스트**: Inngest 발화 시뮬레이션, 빈 윈도우/위반/정상 케이스.
- **회귀 게이트** (L-009): 191개 호출 지점 grep 카운트 불변, typecheck 전체 green.
- **벤치마크 (m7)**: `vitest --bench` 1000회 P99 ≤ 5ms (NFR-AC-001).
- **맹점 방지** (L-013): mock DB 만이 아닌 실DB `\d audit_logs`, `pg_enum` 확인으로 schema/enum/migration 3중 검증.

---

## 6. Open Decisions (run-phase 확인 사항)

1. **Canonical 직렬화 최종 형태**: stable JSON.stringify (sorted keys) vs delimiter-join (`||`). 성능/가독성 비교 후 run 첫 PR 에서 확정.
2. **Genesis sentinel literal**: 본 SPEC 은 `"<genesis>"` 채택 (C2). run phase 에서 `GENESIS_SENTINEL` 상수로 고정.
3. **Alert action enum**: `audit_chain.violation_detected` 신규 (migration 0111) — 확정.
4. **advisory lock 키**: `hashtext('audit_logs_chain')` — 단일 키로 전체 chain 직렬화. 세분화 필요 시 run phase 에서 재검토.
5. **크론 주기**: daily 24h 기본. weekly 옵션 필요 시 Inngest trigger 만 추가.

---

## 7. 산출물 위치 (예상)

- `lib/audit/hash-chain.ts` (신규, M1)
- `lib/audit/verify-chain.ts` (신규, M2)
- `lib/inngest/audit/audit-chain-verify-daily.ts` (신규, M3)
- `lib/inngest/functions.ts` (수정, M3)
- `lib/inngest/client.ts` (수정, M3)
- `lib/audit.ts` (수정, M1 — app-side UUID, advisory lock, widened AuditDbHandle)
- `lib/db/schema.ts` (수정 — auditLogs.chainSeq, AuditAction union, M0)
- `migrations/0111_audit_chain.sql` + rollback (신규, M0)
- `migrations/0109_impact_wizard_columns.sql` (헤더 주석 수정, m3)
- `docs/ops/audit-chain.md` (신규, M5)
- `lib/audit/__tests__/hash-chain.test.ts` (신규, M1)
- `lib/audit/__tests__/verify-chain.test.ts` (신규, M2)
- `lib/audit/__tests__/writeAudit.bench.ts` (신규, M4/m7)
- `lib/inngest/__tests__/audit-chain-verify-daily.test.ts` (신규, M3)

> 본 plan.md 의 산출물 위치는 run phase 에서 조정 가능. SPEC (spec.md) 의
> WHAT/WHY 는 불변.
