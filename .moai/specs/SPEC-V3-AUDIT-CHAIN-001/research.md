# Research — SPEC-V3-AUDIT-CHAIN-001

audit_log SHA-256 hash chain strengthening (v3 Phase E / D-1).

조사 목적: 기존 audit 인프라의 실제 형태를 코드에서 직저 확인하고, hash chain
구현이 자명하도록 모든 제약과 통합 지점을 확정한다. 본 파일은 구현 방식이 아닌
관찰 가능한 사실만 기술한다 (SPEC 범위 규칙: What/Why, not How).

---

## 1. 기존 인프라 직접 관찰 결과

### 1.1 `writeAudit(params, tx?)` — `lib/audit.ts:529-539`

```ts
export async function writeAudit(params: AuditEvent, tx?: AuditDbHandle): Promise<void> {
  const client = tx ?? db;
  await client.insert(auditLogs).values({
    actorId: params.actor_id,
    action: params.action,
    resourceType: params.resource_type,
    resourceId: params.resource_id,
    conversationId: params.conversation_id ?? null,
    metaJson: params.meta_json ?? {},
  });
}
```

관찰 사항:
- 단일 `INSERT`, `previous_hash` 컬럼 미포함 (현재).
- `tx` 매개변수는 선택 — 생략 시 singleton `db` (autocommit). 전달 시 caller tx 안에서 atomic.
- `AuditDbHandle` 구조 타입 (`{ insert: typeof db.insert }`) — tx와 db singleton 모두 만족.
- H2 fix 주석: caller가 mutation + audit을 동일 tx로 묶는 것이 권장 패턴 (Part 11 원자성).

### 1.2 `AuditEvent` 인터페이스 — `lib/audit.ts:492-508`

```ts
export interface AuditEvent {
  actor_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  conversation_id?: string | null;
  meta_json?: Record<string, unknown>;
}
```

`AuditAction` 은 73개 이상의 string-literal union (스키마 enum과 lock-step).

### 1.3 `auditLogs` 테이블 — `lib/db/schema.ts:1265-1289`

확인된 컬럼 (이 순서가 해시 대상 컬럼 후보):
| 컬럼 | 타입 | NOT NULL | 기본값 |
|---|---|---|---|
| `id` | `uuid` | Y (PK, `defaultRandom()`) | — |
| `actorId` | `uuid` | N | — |
| `action` | `audit_action` enum | Y | — |
| `resourceType` | `text` | Y | — |
| `resourceId` | `text` | Y | — |
| `conversationId` | `uuid` | N | — |
| `metaJson` | `jsonb` | Y | `{}` |
| `createdAt` | `timestamptz` | Y | `now()` |
| `previousHash` | `text` | N | — |

이미 존재하는 인덱스: `idx_audit_logs_actor_created`, `idx_audit_logs_action_created`, `idx_audit_logs_resource`.

`@MX:WARN audit_logs is append-only` (schema.ts:1261) — `UPDATE/DELETE/TRUNCATE` 가 DB 트리거로 차단됨 (`migrations/0001_audit_append_only.sql`). 해시 갱신/수정은 불가능하며, 최초 INSERT 시 한 번만 계산되어야 함을 의미.

### 1.4 `previous_hash` 컬럼 — 이미 추가됨

`migrations/0109_impact_wizard_columns.sql:29-34`:
```sql
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS previous_hash TEXT;
COMMENT ON COLUMN audit_logs.previous_hash IS
  'Hex-encoded hash of previous audit entry for chain verification
   (21 CFR Part 11, SHA-256 = 64 hex chars)';
```

컬럼 정의 주석: `lib/db/schema.ts:1278-1280`:
```ts
// SPEC-V3-IMPACT-001 M8: Hash chain for 21 CFR Part 11 verification
// Using text to store hex-encoded hash (SHA-256 = 64 hex chars)
previousHash: text('previous_hash'),
```

**핵심 갭(관찰된 문제)**: 컬럼은 존재하지만:
1. `writeAudit` 가 이 컬럼을 populate 하지 않음 (INSERT 문에서 누락).
2. 검증 함수 (`verifyAuditChain`) 가 존재하지 않음.
3. 주기적 검증 크론이 없음.
4. 기존 행(컬럼 추가 이전 + 0109 이후 NULL 행)이 모두 `previous_hash = NULL`.

이 4개 갭이 본 SPEC의 전체 범위.

### 1.5 최신 migration 번호

`migrations/` 최신: `0110_audit_impact_actions.sql` (+ rollback). 신규 인덱스 추가 시
다음 번호는 `0111` 부터. 단, 본 SPEC은 컬럼 추가 마이그레이션이 **불필요** (0109에 완료).
필요시 `idx_audit_logs_hashchain` 등 조회 성능용 인덱스만 0111로 추가 가능.

### 1.6 기존 해시 유틸리티 — `lib/signature/hash.ts`

```ts
export async function computeAnswerHash(
  contentProse: string,
  blocks: HashableBlock[],
): Promise<string> { /* ... */ }
```

- SHA-256 hex digest (64 chars lowercase).
- `globalThis.crypto.subtle.digest('SHA-256', data)` — Edge/Node 겸용 (WebCrypto).
- JSON canonical 형태 사용 (`JSON.stringify` of 정렬된 객체).
- §11.70 서명/레코드 연결용 — audit chain 은 **별도 함수** 필요 (canonical 스키마가 다름).

재사용 결론: `lib/signature/hash.ts` 의 WebCrypto 패턴만 차용. audit chain 전용
canonicalization 이 필요하므로 `lib/audit/hash-chain.ts` (신규) 또는 `lib/audit.ts` 내
private helper 로 분리 구현. 외부 crypto 의존성 추가 금지 (HARD 제약 준수).

### 1.7 Inngest 크론 패턴 — `lib/inngest/`

표준 패턴 (모든 기존 크론이 동일):
1. `lib/inngest/{domain}/{name}.ts` — `inngest.createFunction(...)` with `triggers: [{ cron: '...' }]`.
2. `lib/inngest/client.ts` — `INNGEST_EVENTS` 사전에 이벤트명 등록 (선택).
3. `lib/inngest/functions.ts` — 배열에 신규 함수 추가 (단일 진실 원천).

기존 크론 스케줄 참고:
- `standards-revision-daily`: `0 9 * * *` (daily 09:00 UTC).
- `knowledge-gap-daily-digest`: daily.
- `weekly-digest`: weekly.

Lazy import 패턴 사용 (`lib/inngest/standards/standards-revision-daily.ts` 참조):
크론 모듈이 등록 시점에 `lib/audit → lib/db/client → lib/env` 를 로드하지 않도록
`await import('@/lib/audit')` inside step. 환경변수 누락 상태에서도 함수 등록이 가능.

### 1.8 기존 cold-storage (`lib/audit/cold-storage.ts`)

- audit_logs 를 R2 Iceberg 포맷으로 아카이브.
- `AuditLogRow` 인터페이스가 존재하나 `previousHash` 필드는 아직 없음 → 아카이브
  시 chain 정보 보존이 필요하면 `AuditLogRow` 확장 포인트로 인지 (out-of-scope warning).

---

## 2. writeAudit fan-in 카운트 (검증 가능한 수치)

| 범주 | 파일 수 (distinct) | writeAudit 호출 수 |
|---|---|---|
| 프로덕션 코드 (non-archive, non-test) | 117 | **191** |
| 아카이브 코드 (`archive/qms-pms/`) | (집계 제외) | 50 |
| **프로덕션 총 (회귀 게이트 대상)** | **117** | **191** |

**재검증 (2026-07-06, v0.2.0 — audit H1 fix)**:
실명령 재카운트: `grep -rn "writeAudit(" --include="*.ts" --include="*.tsx" lib app | grep -v __tests__ | grep -v "export async function writeAudit" | wc -l` = **191**.
distinct 파일 수 = **117**. archive (`archive/qms-pms/`) = **50**.
이전 수치 (197 / 100 files / 60+ archive / 총 257)는 부정확 — 모두 정정.

**HARD 제약 영향**: 191개 프로덕션 호출 지점의 **어떤 것도** 시그니처 변경 없이
그대로 동작해야 함. 본 SPEC은 additive 한 내부 계산만 허용:
- `writeAudit(params, tx?)` 시그니처 유지 (params shape, return type).
- 해시 계산은 `writeAudit` 내부에서 tx 안에 수행되어야 함 (Part 11 원자성).
- 해시 계산 비용: 단일 SELECT prev row + SHA-256 1회 = 수 ms 이내 (full scan 금지).

호출 패턴 (샘플링):
- `lib/auth.ts:85` — `writeAudit(buildLoginAuditEvent(user.id, account?.provider))` (autocommit).
- `app/api/ra/dhf/route.ts:76` — `writeAudit({...}, tx)` (inside `db.transaction`).
- `lib/standards/alert-pipeline.ts:72` — `writeAudit({...})` (autocommit inside cron step).

3가지 패턴 모두 `writeAudit(params, tx?)` 로 동일하게 호출됨을 확인.

---

## 3. 관련 이슈 / 인접 SPEC (본 SPEC 범위 외, follow-up 명시용)

- **Issue #321**: `lib/signature` 기반 HMAC §11.70 binding. 본 SPEC은 chain (§11.10(e))
  이지 서명/HMAC (§11.70) 이 아님 → 흡수 금지, follow-up SPEC 으로 분리.
- **`lib/kernel/audit/` 이동**: v3 마스터 플랜이 대상 디렉토리를 `lib/kernel/audit/` 로
  표기하나, **디렉토리 이동 자체는 별도 리팩터 SPEC**. 본 SPEC은 `lib/audit.ts` 현위치에서
  chain 로직만 추가. 이동 시 `writeAudit` import 경로만 바뀌고 chain 로직은 동일.
- **Cold storage 연동**: R2 아카이브 시 `previousHash` 보존 여부는 cold-storage SPEC
  (SPEC-REGULA-CLOUDFLARE-001) 의 후속 과제. 본 SPEC은 row-level chain 에만 집중.

---

## 4. Backfill 전략 트레이드오프 분석

기존 행들의 `previous_hash` 가 NULL 임. 두 전략 비교:

### 전략 A: 일괄 backfill 마이그레이션

- **방법**: 단일 트랜잭션으로 모든 행을 시간순 순회하며 chain 재계산.
- **장점**: 전체 테이블이 단일 연속 chain 을 형성 (검증 시 명확).
- **단점**:
  - `audit_logs` 는 append-only 트리거로 UPDATE 차단 → 트리거 예외 또는 일시적 비활성화 필요 (Part 11 위반 소지).
  - 수백만 행일 경우 트랜잭션 크기 폭발, 잠금 경합.
  - 원본 `created_at` 순서와 증분 사이의 race 가 chain 불일치 유발 가능.
- **Part 11 관점**: 과거 행을 수정하는 것은 전자기록 무결성 원칙과 충돌.

### 전략 B: NULL = "chain starts here" (genesis, 권장)

- **방법**: `previous_hash IS NULL` 인 행을 chain 의 시작점(들)으로 취급.
  이후 행부터 forward chain 만 적용.
- **장점**:
  - append-only 위반 없음 (UPDATE 금지, INSERT 만).
  - 기존 행을 한 번도 수정하지 않음 → Part 11 무결성 유지.
  - 비용 영점 (계산/잠금 없음).
- **단점**:
  - chain 이 다수의 "segment" 로 분할 (pre-chain segment + post-chain segment).
  - 검증 유틸리티가 segment 경계를 인지해야 함 (NULL hash = 새 세그먼트 시작).
- **완화**: segment 분할은 검증 함수가 자연스럽게 처리 (`previous_hash IS NULL`
  또는 `previous_hash = genesis_marker` 인 지점에서 새 윈도우 시작).

**권장**: 전략 B. Part 11 원칙(과거 행 불변) 과 비용/위험 균형이 가장 양호.
검증 유틸리티는 segment-aware 하게 설계. 최초 chain 행은 자체 id 의 해시
(또는 고정 seed) 를 사용하여 genesis 로 명시.

---

## 5. 해시 canonicalization 후보 (검증 단계에서 확정 필요)

chain 무결성은 canonical 형태의 결정론성에 좌우됨. 관찰된 컬럼 기준:

| 순서 | 필드 | 인코딩 |
|---|---|---|
| 0 | `previous_hash` (이전 행의 output, hex) | string, NULL=genesis marker |
| 1 | `id` | UUID string |
| 2 | `actor_id` | UUID string or "null" |
| 3 | `action` | enum string |
| 4 | `resource_type` | string |
| 5 | `resource_id` | string |
| 6 | `conversation_id` | UUID string or "null" |
| 7 | `meta_json` | `JSON.stringify` with stable key ordering |
| 8 | `created_at` | ISO-8601 UTC string |

- 알고리즘: SHA-256 (WebCrypto `crypto.subtle.digest`).
- 출력: 64-char lowercase hex (기존 `previous_hash` 컬럼 comment 와 일치).
- Canonical 형태: run-phase 에서 최종 확정 (JSON.stringify vs delimiter-join).
  키 순서가 보장되어야 함 (`Object.keys` 순서는 엔진 의존적이므로 명시적 정렬 필요).

해시 계산은 `id` 가 결정된 이후에 가능 → `defaultRandom()` UUID 가 INSERT 시점에
생성되므로, 계산 순서는:
1. UUID 생성 (또는 DB 가 defaultRandom 으로 자동 생성).
2. 모든 입력 컬럼 + 이전 해시로 canonical string 생성.
3. SHA-256 계산 → `previous_hash` 컬럼에 INSERT.

단일 tx 안에서 이전 행 SELECT + 해시 계산 + INSERT 가 Part 11 원자성 요구사항.

---

## 6. ci:audit 게이트 현황

`scripts/qa/audit-completeness.ts` 가 `writeAudit` 호출 지점의 메타 문자열 리터럴 길이를
검사 (PII 누출 방지). 본 SPEC은 `writeAudit` 시그니처를 변경하지 않으므로 게이트 통과 유지.
해시 계산 로직이 `writeAudit` 내부로 들어가면 추가 리터럴 검사 대상이 발생하지 않음을 확인.

---

## 7. 결론: SPEC 범위 확정

IN SCOPE (본 SPEC이交付):
1. `writeAudit` 내부에서 `previous_hash` 자동 계산 (tx 안에서, additive).
2. `verifyAuditChain(window)` 순수 함수 + 결과 reporting.
3. Inngest 크론 (주기 검증 + 위반 시 alert audit event).
4. 전략 B backfill 정책 (NULL = genesis) 문서화 및 검증 반영.
5. 신규 인덱스 (필요시 `idx_audit_logs_created_at` for window scan) — 마이그레이션 0111.

OUT OF SCOPE (별도 SPEC):
- `lib/kernel/audit/` 디렉토리 이동 (리팩터 SPEC).
- Issue #321 HMAC §11.70 서명 binding.
- R2 cold storage chain 보존 (SPEC-REGULA-CLOUDFLARE-001 후속).
- 기존 행 backfill UPDATE (전략 A, Part 11 위반 소지로 기각).
