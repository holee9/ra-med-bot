# writeAudit 트랜잭션 원자성 감사 레지스트리

- **이슈**: [#366](https://github.com/holee9/ra-med-bot/issues/366) — [Mid-check #9] writeAudit tx AST 감사 + RLS 잔여 도메인 점검 (Part 11 §11.10(e))
- **날짜**: 2026-07-08
- **규제 기준**: 21 CFR Part 11 §11.10(e) — 감사 추적 기록은 해당 데이터 변경과 동일한 트랜잭션 경계 내에서 원자적으로 기록되어야 함
- **방법론**: 정밀 직검 (사용자 합의, madge/dependency-cruiser 신규 도입 0). AST 근사(괄호 매칭) 스크립트로 후보 산출 → orchestrator 직돀으로 확정/기각.

## 1. 요약

`writeAudit(params, tx?)` (lib/audit.ts:551)는 **AUDIT-CHAIN M1 (PR #356)** 이후 tx 미전달 시 자체 `db.transaction`으로 래핑. 따라서 **audit INSERT 자체의 원자성 + hash chain 무결성은 보장**됨. 본 감사의 진짜 대상 = **mutation(INSERT/UPDATE/DELETE)이 별도 tx에서 커밋된 후 writeAudit이 자체 tx로 실행**되어 mutation은 남고 audit만 누락되는 시나리오.

| 분류 | 수 | 상태 |
|---|---|---|
| **in-tx 안전** (db.transaction 또는 withTenantScope 블록 내부 + tx 전달) | 8 | ✅ 직돀 안전 확정 |
| **out-of-tx, audit-only** (근처 mutation 없음 — 검색/조회 후 audit) | 123 | ✅ 안전 |
| **out-of-tx, mutation 인근** (위반 후보) | 59 | ⚠️ 직돀 검증 필요 → impact 1곳(#377) + PR-A 6곳(#378) 확정 수정, 잔여 52곳 후속 |
| **총 writeAudit 호출처** | 190 | (테스트 제외) |

## 2. 직돀으로 안전 확정된 영역 (수정 불필요)

### in-tx 안전 (8곳) — mutation과 같은 tx
- `app/api/ask/route.ts:90,114,166` — `db.transaction(async (tx) =>` 내부, `writeAudit({...}, tx as any)` 전달 (SPEC-V3-INBOX-001 / TRIAGE)
- `app/api/consult/sessions/route.ts:57` · `[sessionId]/route.ts:89` · `[sessionId]/turns/route.ts:103` — `db.transaction` 내부 + tx 전달 (SPEC-V3-CONSULT-001). 주석 "INSERT turn + writeAudit (fast, atomic)"
- `app/api/ra/workflows/cer/route.ts:117` — `cer_persisted` audit이 workflow_runs INSERT와 동일 `db.transaction` (SPEC-REGULA-CER-001). 주석 "SAME db.transaction — 21 CFR Part 11 atomicity"
- `lib/domains/inbox/promote.ts:163` — `db.transaction` 내부 + tx (SPEC-V3-INBOX-001 H-3, #321 fix)

### withTenantScope 안전 (이슈 후보에서 제외) — #239 RLS wiring으로 tx 래핑
- `lib/knowledge-promo/promote.ts:93,125,183` — `withTenantScope(orgId, async (tx) =>` 내부 (SPEC-REGULA-KNOWLEDGE-PROMO, #50 C-3 fix). 주석 "wraps mutation + writeAudit in ONE db.transaction"
- `lib/project-memory/manager.ts:119,145,202,225,254,275,334` (7곳) — `withTenantScope` 내부 (SPEC-REGULA-PROJECT-MEMORY, #51 fix). 주석 "writeAudit in ONE withTenantScope tx"

### audit-only (mutation 없음, 자체 tx로 충분)
`lib/export/audit-logger.ts` (export는 mutation 아님, 행위 기록) · `lib/cer/audit.ts` `auditCerCreated` (의도적 two-row provenance — REQ-CER-036, autocommit INITIATED + cer_persisted in tx, #255 확정 설계) 외 123곳.

## 3. 본 PR 확정 수정 (이슈 명시 impact 도메인)

### `lib/domains/impact/analyzer.ts` — 위반 확정 → 수정 ✅
- **위반**: `analyzeImpact(req, db: Database)`에서 `db.insert(regulatoryImpactAssessments)`가 autocommit, `auditAssessmentCreated`/`auditCriticalDetected`가 자체 tx → mutation 커밋 후 audit 실패 시 추적 누락
- **수정**: assessment INSERT + `auditAssessmentCreated` + `auditCriticalDetected`를 per-iteration `db.transaction(async (tx) => { ... })`로 래핑, tx 전달. 21 CFR Part 11 §11.10(e) 원자성 확보.

### `lib/domains/impact/audit-wiring.ts` — tx forward 지원 추가 ✅
- 3함수(`auditAssessmentCreated`/`auditCriticalDetected`/`auditActionItemCreated`)에 `tx?: AuditDbHandle` 매개변수 추가, `writeAudit({...}, tx)` forward. 기존 호출자(자체 tx) 호환(선택적).

### 구조적 한계 (별도 후속)
- `enqueueActionItems(input, db: Database)`가 tx를 받지 않음 (Drizzle `PgTransaction`이 `Database` 타입 `$client` 요구 미충족). 따라서 action item INSERT + `auditActionItemCreated`는 별도 경계. **action item audit 원자성**은 후속 패스에서 `enqueueActionItems` 시그니처 확장 후 해결 예정.

## 4. 미검증 위반 후보 (후속 이슈로 분할)

직검 토큰 한계로 본 PR에서 전부 직돀하지 못한 후보. grep/AST 근사로 산출되었으나 **직돀 확정 전까지는 위반으로 단정 금지** (false-positive 가능 — `tx as any`, wrapper forward, withTenantScope 등 스크립트가 놓치는 패턴 존재).

### Priority High — 라우트 핸들러 mutation + audit (도메인별 그룹)
- **app/api/ra/** (잔여 19곳): classification, consult, conversations, deadlines(3), digest, expert-review(2), knowledge-sources(2), messages/blocks, projects(2), updates/feedback, workflows/submission-drafter, admin/documents/upload(2)
  - **[PR-A #378 완료 — 6곳 직독 위반 확정 + tx 래핑]** notifications(preferences) · profile · personal/bookmarks(POST + DELETE) · predicate/comparison(POST + [id]/approve). 모두 autocommit mutation + 자체 tx audit 패턴 → `db.transaction(async (tx) => { mutation + writeAudit({...}, tx) })` 래핑. analyzer.ts:67 패턴 준용.
- **app/api/ra/workflows/cer/route.ts:117** — 직돀 안전 확정(제외)이나 스크립트 후보에 잔류 (false-positive)
- **app/api/{auth/change-password, auth/signup, classify/run(2), rlhf/feedback(2), admin/users, knowledge-gap/classify}** (8곳)

### Priority Medium — lib 도메인
- `lib/radar/delta-sync/orchestrator.ts` (5곳: 143,182,267,308) · `ingest.ts:134` — corpusSyncRuns 상태 업데이트 + audit
- `lib/knowledge-gap/{detector:117, owning-issue:209/233, replay:303}` (4곳)
- `lib/knowledge-sources/sync.ts:96,121` (2곳)
- `lib/ai/consult.ts:658` · `lib/model-governance/rlhf-gate.ts:52` · `lib/rlhf/calibration-proposal.ts:95` · `lib/standards/alert-pipeline.ts:72` · `lib/inngest/knowledge-sources/orphan-cleanup.ts:114`

## 5. 수정 방법론 (후속 패스 표준)

```typescript
// 위반 패턴 (autocommit mutation + 자체 tx audit)
await db.insert(table).values({...});           // autocommit
await writeAudit({...});                         // 자체 tx → orphan 위험

// 수정 (동일 tx 래핑)
await db.transaction(async (tx) => {
  await tx.insert(table).values({...});
  await writeAudit({...}, tx);                   // 같은 tx → atomic
});
```

**예외 (수정 불필요)**:
- audit-only (mutation 없음) — 검색/조회/읽기 후 audit
- 의도적 two-row provenance (cer_created autocommit + cer_persisted in tx) — 설계적

## 6. RLS 잔여 도메인 (이슈 항목, 이미 완료)

이슈가 "RLS 잔여 도메인 점검: cyberdevice/model-governance/traceability"를 명시했으나, **#239에서 전부 wiring 완료** 확인:
- `tests/unit/db/with-tenant-scope-coverage.test.ts`: `PENDING_DOMAINS = []`, 주석 "All 7 org-scoped domains are wired"
- 진짜 RLS 잔여 = **#317** (sources/source_sections RLS)만 OPEN — 본 이슈 범위에서 제외 (별도 이슈).

## 7. 방법론 한계 (AST 도구 도입 검토)

본 감사는 grep + 괄호 매칭 AST 근사 + orchestrator 직돀으로 수행. 한계:
- **wrapper 함수 호출자 추적**: `auditX(params, tx?)` wrapper가 tx를 forward하므로, wrapper 정의만 보면 A 패턴(자체 tx)으로 오탐. 호출자까지 추적해야 진실.
- **멀티라인 tx 인자**: `tx as any`, `tx satisfies X`, trailing 콤마, 주석이 섞인 호출 블록에서 마지막 인자 추출 정확도 저하.
- **withTenantScope 인식**: #239 RLS 래퍼가 `db.transaction`과 동등하나 별개 식별자 → 스크립트 보정 필요.

후속 패스에서 **madge/dependency-cruiser 신규 도입**이 정규 감사 자동화에 유효할 수 있음 (본 PR은 사용자 합의로 직검 선택, 도입은 별도 인프라 이슈 권장).

---

**본 PR 완료 범위**: 이슈 명시 impact 도메인(analyzer.ts + audit-wiring.ts) 직돀 위반 확정 + 수정. 잔여 후보는 본 레지스트리에 등록 후 도메인별 후속 PR로 분할 진행.

---

## 8. PR-A (#378) — 회귀 최소 도메인 6곳 직돀 확정 + tx 래핑

58곳 잔여 후보 중 회귀가 가장 낮고 독립적인 도메인 그룹을 선정해 직돀 → 위반 확정 → 수정.

### 직독 결과 (6곳 전부 위반 확정 — autocommit mutation + 자체 tx audit)

| 파일:라인 | mutation(autocommit) | 비고 |
|---|---|---|
| `app/api/ra/notifications/preferences/route.ts:88` | `db.update(users)` | PATCH |
| `app/api/ra/profile/route.ts:85` | `db.update(users)` | UPDATE 브랜치만; SELECT(else)는 audit-only 안전 |
| `app/api/ra/personal/bookmarks/route.ts:81` | `db.insert(personalBookmarks)` | POST |
| `app/api/ra/personal/bookmarks/[id]/route.ts:65` | `db.delete(personalBookmarks)` | DELETE — not_found는 throw 아닌 returning 기반 404 처리 |
| `app/api/ra/predicate/comparison/route.ts:105` | `db.insert(workflowRuns)` | POST |
| `app/api/ra/predicate/comparison/[id]/approve/route.ts:106` | `db.update(workflowRuns)` | PUT |

### 수정 방식
각 mutation + `writeAudit`을 단일 `db.transaction(async (tx) => { tx.MUTATION; writeAudit({...}, tx); })`로 래핑. analyzer.ts:67-103 패턴 준용.

### 검증
- typecheck 0 error · lint 0 error(lint:hex OK)
- full vitest 4786 passed (comparison.test.ts mock에 `transaction` 추가 — db.transaction 인터페이스 반영)
- ci:rbac · ci:audit · ci:module-boundaries · ci:format 포함 9개 ci:* 전 PASS

### 잔여 후보 (후속 PR-B/C/D 대상)
- **app/api/ra 잔여 19곳**: classification, consult(2), conversations, deadlines(3), digest, expert-review(2), knowledge-sources(2), messages/blocks, projects(2), updates/feedback, workflows/submission-drafter, admin/documents/upload(2)
- **app/api non-ra 8곳**: auth/change-password, auth/signup, classify/run(2), rlhf/feedback(2), admin/users, knowledge-gap/classify
- **lib Priority Medium ~15곳**: radar/delta-sync(orchestrator 4 + ingest), knowledge-gap(detector/owning-issue 2/replay), knowledge-sources/sync(2), ai/consult, model-governance/rlhf-gate, rlhf/calibration-proposal, standards/alert-pipeline, inngest/knowledge-sources/orphan-cleanup
- **구조적 한계**: `enqueueActionItems(db)` tx 시그니처 확장(action item audit 원자성) — 별도 패스
