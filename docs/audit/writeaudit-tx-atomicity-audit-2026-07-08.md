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
| **out-of-tx, mutation 인근** (위반 후보) | 59 | ⚠️ 직돀 검증 필요 → impact 1곳(#377) + PR-A 6곳 + PR-B 7곳 + PR-B-lib 2곳(signature) + PR-C 10곳 + PR-D-1 5곳 (#378) 확정 수정, 잔여 24곳 후속(digest:42 + PR-D-1 rlhf/feedback 2 + knowledge-gap/classify 직돀 안전 분류 — 후보 4곳 제외) |
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
- **app/api/ra/** (잔여 12곳): consult · digest/generate:42(lib 경유) · expert-review(2) · knowledge-sources(2) · messages/signature(2: lib 경유) · projects(2) · updates/feedback · workflows/submission-drafter · admin/documents/upload(2)
  - **[PR-A #378 완료 — 6곳 직독 위반 확정 + tx 래핑]** notifications(preferences) · profile · personal/bookmarks(POST + DELETE) · predicate/comparison(POST + [id]/approve). 모두 autocommit mutation + 자체 tx audit 패턴 → `db.transaction(async (tx) => { mutation + writeAudit({...}, tx) })` 래핑. analyzer.ts:67 패턴 준용.
  - **[PR-B #378 완료 — A군 7곳 route 직접 mutation]** classification · conversations(DELETE) · deadlines(3: POST/PATCH/DELETE) · digest/generate:62(이메일 발송 후 update) · messages/blocks(checklist toggle). tx 래핑. evaluator APPROVE 96/100, fix 불필요.
  - **[PR-B #378 B군 — lib 경유 3곳, 후속 서브 PR]** digest/generate:42(generateWeeklyDigest, withTenantScope 기반) · messages/signature:101(insertSignature) · messages/signature/revoke:43(revokeSignature). lib가 tx 파라미터 미지원 → lib tx 옵션 확장 필요(analyzer.ts audit-wiring 패턴).
  - **[PR-B-lib #378 완료 — B군 signature 2곳]** messages/signature:101(insertSignature) · revoke:43(revokeSignature). lib에 `tx?: DbClient` 옵션 추가(analyzer.ts audit-wiring 패턴, `tx ?? db`) + route `db.transaction` 래핑 + `tx as DbClient` 전달. evaluator APPROVE(Func 95/Sec 100).
  - **[PR-B-lib #378 직돀 안전 분류 — digest:42]** generateWeeklyDigest는 내부 `withTenantScope`(RLS tx)로 weeklyDigests INSERT 수행 → mutation 자체 원자적 보장. route audit은 audit-only(부수 기록). withTenantScope GUC 기반 통합은 구조적 설계 변경(별도 이슈).
- **app/api/ra/workflows/cer/route.ts:117** — 직돀 안전 확정(제외)이나 스크립트 후보에 잔류 (false-positive)
- **app/api/{auth/change-password, auth/signup, classify/run(2), rlhf/feedback(2), admin/users, knowledge-gap/classify}** (8곳) — **[PR-D-1 #378 완료 — 위반 5곳 tx 래핑(change-password, signup, classify/run 2, admin/users) + 안전 3곳 분류(rlhf/feedback 2, knowledge-gap/classify — 이미 withTenantScope tx, L-013 false-positive)]**

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

---

## 9. PR-B (#378) — app/api/ra A군 7곳 route 직접 mutation tx 래핑

PR-A에 이어 회귀 최소 A군 7곳 직돀 → 위반 확정 → tx 래핑. lib 경유 B군 3곳은 별도 서브 PR.

### 직독 결과 (7곳 전부 위반 확정 — route에서 autocommit mutation 직접 호출)
| 파일:라인 | mutation(autocommit) | 비고 |
|---|---|---|
| classification/route.ts:78 | db.insert(deviceClassifications) | POST, SSE 스트리밍 내부 |
| conversations/[id]/route.ts:41 | db.delete(conversations) | DELETE |
| messages/.../blocks/[blockId]/route.ts:85 | db.update(messageBlocks) | PATCH, REQ-ENTERPRISE-035 fail-closed |
| deadlines/[id]/route.ts:82 | db.update(regulatoryDeadlines) | PATCH |
| deadlines/[id]/route.ts:110 | db.delete(regulatoryDeadlines) | DELETE |
| deadlines/route.ts:82 | db.insert(regulatoryDeadlines) | POST |
| digest/generate/route.ts:58 | db.update(weeklyDigests emailSentAt) | sendDigestEmail은 tx 밖(외부 부작용) |

### 수정 방식
각 mutation + writeAudit을 단일 `db.transaction(async (tx) => { tx.MUTATION; writeAudit({...}, tx); })`로 래핑. PR-A 패턴(return null + caller 500/404) 준용 — throw 회귀 없음.

### B군 — lib 경유 3곳 (후속 서브 PR)
- digest/generate/route.ts:42 → generateWeeklyDigest (lib/digest/digest-generator.ts, withTenantScope 기반)
- messages/.../signature/route.ts:101 → insertSignature (lib/signature/queries.ts, db만 받음)
- messages/.../signature/revoke/route.ts:43 → revokeSignature (동일)
- lib가 tx 파라미터 미지원 → analyzer.ts audit-wiring 패턴으로 lib tx 옵션 확장 후 route에서 tx 전달.

### 검증
- typecheck 0 · lint 0(lint:hex OK) · ci:* 9종 PASS(rbac/audit/module-boundaries/...)
- full vitest 4786 passed(회귀 0, frontend-shell 플래키 1건 무관)
- evaluator-active APPROVE 96/100(Functionality 95 / Security 100 / Craft 90 / Consistency 100), fix 불필요

### 잔여 후보 (후속 PR-C/D/E 대상)
- **app/api/ra 잔여 12곳**: consult(2) · expert-review(2) · knowledge-sources(2) · projects(2) · updates/feedback · workflows/submission-drafter · admin/documents/upload(2)
- **lib 경유 B군 3곳**: digest:42 · signature:101 · signature/revoke:43
- **app/api non-ra 8곳 + lib Priority Medium ~15곳**
- **구조적**: enqueueActionItems tx 시그니처 확장

---

## 10. PR-B-lib (#378) — B군 signature 2곳 lib tx 옵션 확장

B군 lib 경유 3곳 중 signature 2곳 처리 + digest:42 직돀 안전 분류.

### signature 2곳 — lib tx 옵션 확장 (analyzer.ts audit-wiring 패턴)
| 파일 | lib 함수 | 수정 |
|---|---|---|
| lib/signature/queries.ts | insertSignature / revokeSignature | `tx?: DbClient` 옵션 추가, `const q = tx ?? db; q.insert/update`. DbClient export. 기존 호출자 호환(tx optional). |
| messages/.../signature/route.ts | POST | db.transaction 래핑, tx as DbClient 전달, writeAudit tx |
| messages/.../signature/revoke/route.ts | POST | 동일 |

호출처: route 2곳(수정본) 유일 → lib 시그니처 변경 영향 0.

### digest:42 — 직돀 안전 분류 (수정 없음)
generateWeeklyDigest(lib/digest/digest-generator.ts)는 내부 `withTenantScope`(orgId, RLS tx)로 weeklyDigests INSERT 수행. mutation 자체 원자적(RLS 보장). route writeAudit(digest_generated)은 audit-only 부수 기록. withTenantScope GUC 기반 → route tx 통합은 구조적 설계 변경(별도 이슈).

### 검증
- typecheck 0 · lint 0(lint:hex OK) · ci:* 9종 PASS
- full vitest 4786 passed(회귀 0, frontend-shell 플래키 1건 무관)
- evaluator APPROVE(Func 95/Sec 100/Craft 85/Cons 95). §11.10(e) 원자성 100.
- [MEDIUM nice-to-have] `tx as DbClient` 타입 단언 → AuditDbHandle duck-typing 전사 전환은 별도 리팩터(PR-E 구조적).

### 잔여 후보
- **app/api/ra 잔여 12곳**: consult(2) · expert-review(2) · knowledge-sources(2) · projects(2) · updates/feedback · workflows/submission-drafter · admin/documents/upload(2)
- **app/api non-ra 8곳 + lib Priority Medium ~15곳**
- **구조적**: enqueueActionItems tx 시그니처 + digest:42 withTenantScope 통합 + AuditDbHandle 전사 전환

---

## 11. PR-C (#378) — app/api/ra 복합 9 route / writeAudit 10곳 tx 래핑

PR-A/B/B-lib 연속. app/api/ra 잔여 복합 라우트 직돀 + tx 래핑.

### tx 래핑 (analyzer.ts:67-103 패턴, 9 route)
| route | mutation | audit action |
|---|---|---|
| expert-review POST | INSERT expertReviews | expert_review.flag |
| expert-review/[id] PATCH | UPDATE expertReviews | expert_review.assign / resolve |
| knowledge-sources POST | INSERT knowledgeSources | knowledge_source.created |
| knowledge-sources/[id] DELETE | DELETE knowledgeSources | knowledge_source.deleted |
| projects POST | INSERT projects | project.create |
| projects/[id] PATCH | UPDATE projects | project.update |
| workflows/submission-drafter POST | INSERT workflowRuns | workflow.start |
| updates/[id]/feedback POST | UPSERT orgUpdateRelevance | message.feedback |
| admin/documents/upload POST | sourceSections INSERT + document.upload/chunk audit → 동일 tx 통합 | document.upload, document.chunk |

각 라우트 `db.transaction(async (tx) => { tx.MUTATION; writeAudit({...}, tx); })` 래핑. 동작 보존(return null + caller 500/404, throw 회귀 없음). admin upload는 setPendingReviewOnIngest(별도 best-effort 경계, 에러 swallow)를 atomic persist+audit 이후로 정리.

### 안전 분류 (수정 없음)
- **consult/route.ts** (writeAudit:206,227): `audit-check-ignore` 주석 + E2E_TEST_MODE 전용. lib/ai/consult.ts(llm.call:274 / source.access:371 / expert_review.flag auto:604 / consult.expert_review_auto_flag:658)의 audit 원자성은 PR-D/E(lib 도메인)로 이월.
- **admin upload :86** (corpus.ingestion_blocked): audit-only 거부 audit (mutation 없음).

### 이슈 전제 정정 (L-013)
- "admin/documents/upload(2)" → 실제 경로 `app/api/ra/admin/documents/upload/route.ts` (app/api/admin 아님)
- workflows 나머지(audit-response / cer / indication-impact / pccp)는 PR-C 범위 밖 — cer는 이미 tx 패턴 직검 확인, 나머지 3종은 별도 직돀 필요(후속)

### 검증
- typecheck 0 · lint 0(lint:hex OK) · full vitest **4786 passed**(회귀 0, frontend-shell 플래키 1건 무관)
- ci:* 9종 PASS(audit / rbac / format / migrations / tokens / i18n / glossary / contrast / module-boundaries)
- 테스트 4종 db.transaction mock + writeAudit 2인자 단언 보정(expert-review 2종 / submission-drafter / docingest)

### 잔여 후보 (후속 PR-D/E 대상)
- **app/api/ra**: consult route 안전 분류 완료 → **잔여 0곳**(lib/ai/consult.ts audit 원자성은 lib 도메인)
- **app/api non-ra 8곳**: auth/change-password, auth/signup, classify/run(2), rlhf/feedback(2), admin/users, knowledge-gap/classify
- **lib Priority Medium ~15곳**: radar/delta-sync(orchestrator 4 + ingest), knowledge-gap(detector / owning-issue 2 / replay), knowledge-sources/sync(2), ai/consult(4곳), model-governance/rlhf-gate, rlhf/calibration-proposal, standards/alert-pipeline, inngest/knowledge-sources/orphan-cleanup
- **구조적(PR-E)**: enqueueActionItems tx 시그니처 + AuditDbHandle duck-typing 전사 전환

## 12. PR-D-1 (#378) — app/api non-ra 8곳 직돀 + tx 래핑(위반 5) / 안전 분류(3)

PR-A/B/B-lib/C 연속. app/api non-ra 8곳 직돀 → 위반 5곳 tx 래핑 + 이미 안전 3곳 분류(L-013 false-positive 포착).

### tx 래핑 (analyzer.ts:67-103 패턴, 4 route / writeAudit 5곳)
| route | mutation | audit action |
|---|---|---|
| auth/change-password PATCH | UPDATE users(password_hash, mustChangePassword=false) | profile.update |
| auth/signup POST | INSERT users(status=pending) | profile.update |
| classify/run POST 성공 | INSERT deviceClassifications + UPDATE workflowRuns(approved) | device_classified |
| classify/run POST 실패(catch) | UPDATE workflowRuns(failed) | device_classified (meta.error) |
| admin/users/[id] PATCH | UPDATE users(status) | profile.update |

각 라우트 `db.transaction(async (tx) => { tx.MUTATION; writeAudit({...}, tx); })` 래핑. 동작 보존:
- **signup**: INSERT returning 누락 시 tx 내 `return null` → caller 500 유지. 공개 가입 경로(actor_id=null) 의미론 보존.
- **classify/run**: 초기 `workflow_runs(running)` INSERT는 LLM 호출 전 lifecycle 마커 → tx 외부 유지(장기 tx · fallible 엔진 호출 회피). 결과 persist(deviceClassifications INSERT + workflowRuns UPDATE) + audit만 동일 tx. catch 경로도 failed-UPDATE + failure-audit 동일 tx. 구조 테스트(route.test.ts)가 소스 텍스트 매칭이라 토큰 보존(try/catch · status:'failed' · device_classified · 502 · resource_type 'deviceClassification' ×2) → 테스트 수정 불필요, 7/7 green 확인.
- **change-password / admin/users**: UPDATE + audit 단일 tx. 404 경로 audit 스킵 의미론(change-password는 사전 SELECT 404, admin/users는 eq(id) WHERE) 보존.

### 안전 분류 (수정 없음 — L-013 직돀 false-positive 포착)
- **rlhf/feedback/route.ts** (writeAudit:217,252): 이미 `withTenantScope(orgId, async (tx) => {...})` 블록 내부 + `writeAudit({...}, tx)` 2인자 전달. C-3 주석("insert/update + writeAudit in db.transaction")대로 upsert 경로(INSERT/UPDATE 양쪽) 구현 완료.
- **knowledge-gap/classify/route.ts** (writeAudit:78): 이미 `withTenantScope(orgId, async (tx) => {...})` 내부 + tx 전달. SELECT + UPDATE + writeAudit 동일 tx 주석 확인.
- (참고) knowledge-gap/replay/[queueId] — route-level writeAudit 없음(lib 경유, 주석 명시 "route-level writeAudit would duplicate").

### 이슈 전제 정정 (L-013)
- grep/AST 근사 후보 8곳 중 **3곳이 이미 tx 래핑된 false-positive** → 직돀로 포착(rlhf/feedback 2, knowledge-gap/classify 1). 스크립트는 `withTenantScope` 블록 + 2인자 `writeAudit({...}, tx)` 패턴을 놓침 → 직돀 필수(레지스트리 §5 방법론, 인수 기준 반복 확인).

### 검증
- typecheck 0 · lint 0(lint:hex OK, 변경 4파일 biome clean — 12 기존 warning 무관) · full vitest **4786 passed**(frontend-shell 플래키 1건 단독 재실행 19/19 green 확인, 무관)
- ci:* 종 PASS — ci:audit "Audit completeness check: PASS" / rbac / module-boundaries / tokens / i18n / glossary / contrast / migrations 전 exit 0

### 잔여 후보 (후속 PR-D-2/E 대상)
- **app/api non-ra**: PR-D-1 완료 → **잔여 0곳**
- **lib Priority Medium ~15곳(PR-D-2)**: radar/delta-sync(orchestrator 4 + ingest), knowledge-gap(detector / owning-issue 2 / replay), knowledge-sources/sync(2), ai/consult(4곳), model-governance/rlhf-gate, rlhf/calibration-proposal, standards/alert-pipeline, inngest/knowledge-sources/orphan-cleanup — B군 lib tx 옵션 확장 패턴(PR-B-lib 준용)
- **구조적(PR-E)**: enqueueActionItems tx 시그니처 + AuditDbHandle duck-typing 전사 전환 + digest:42 withTenantScope 통합
- workflows 잔여 3종(audit-response / indication-impact / pccp) 별도 직돀 — cer는 이미 tx 패턴

## 13. PR-D-2 (#378) — lib Priority Medium 직돀 + tx 래핑(위반 10) / 안전 분류(8)

PR-A/B/B-lib/C/D-1 연속. registry §4 Priority Medium lib 앵커 ~15곳 직돀 → 위반 10곳 tx 래핑 + 이미 안전 8곳 분류(L-013 false-positive 대량 포착 — grep/AST가 withTenantScope+2인자 / audit-only 놓침).

### tx 래핑 (analyzer.ts:67-108 + audit-wiring.ts tx forward 패턴, 6 파일 / writeAudit 10곳)
| 파일:앵커 | mutation | audit action |
|---|---|---|
| lib/knowledge-gap/detector.ts:117 captureKnowledgeGap | INSERT unanswered_queue | knowledge_gap_created |
| lib/knowledge-gap/owning-issue.ts:209 createOwningIssue(성공) | UPDATE unanswered_queue(owningIssueUrl/Target) | owning_issue_created |
| lib/knowledge-gap/replay.ts:303 markGapResolved | UPDATE unanswered_queue(status=resolved) | knowledge_gap_resolved |
| lib/knowledge-sources/sync.ts:96 syncKnowledgeSource(성공) | UPDATE knowledge_sources(synced/lastSyncedAt) | knowledge_source.synced |
| lib/knowledge-sources/sync.ts:121 syncKnowledgeSource(실패 catch) | UPDATE knowledge_sources(failed) | knowledge_source.synced (meta.status=failed) |
| lib/radar/delta-sync/orchestrator.ts:143 runDeltaSync(INSERT run) | INSERT corpus_sync_runs(pending) | corpus.sync_started |
| lib/radar/delta-sync/orchestrator.ts:182 runDeltaSync(unchanged) | UPDATE corpus_sync_runs(unchanged) | corpus.sync_completed |
| lib/radar/delta-sync/orchestrator.ts:267 runDeltaSync(synced) | UPDATE corpus_sync_runs(synced/counts) | corpus.sync_completed |
| lib/radar/delta-sync/orchestrator.ts:308 runDeltaSync(failed catch) | UPDATE corpus_sync_runs(failed/error) | corpus.sync_failed |
| lib/ai/consult.ts:658 auto-expert-review flag | UPDATE messages(expertReviewRequired=true) | consult.expert_review_auto_flag |

각 `db.transaction(async (tx) => { tx.MUTATION; writeAudit({...}, tx); })` 래핑. 동작 보존:
- **runDeltaSync**: delta-sync 파이프라인. INSERT run+sync_started / unchanged-UPDATE+audit / synced-UPDATE+audit / failed-UPDATE+audit 4개 tx 경계. **embed/detect/chunk/ingestDocuments(장기 실행·fallible)는 tx 외부 유지**(PR-D-1 classify/run 경계 동일 — 장기 tx·fallible 엔진 회피). IDOR-fail audit(orchestrator:103, source_not_found_in_org)는 audit-only(run row 미생성) → 1인자 그대로.
- **syncKnowledgeSource**: 성공/실패 UPDATE+audit 각 tx. ingestDocuments(clone+chunk+embed)는 tx 외부. 사전 syncing-lock UPDATE(sync.ts:74, audit 무페어)는 그대로.
- **markGapResolved**: UPDATE+audit 동일 tx. commentGapResolved(외부 GitHub side-effect)는 **commit 이후**로 이동(PR-B sendDigestEmail 경계 동일 — 외부 부작용은 tx 롤백 대상 아님).
- **consult.ts auto-flag**: orgId 분기 withTenantScope(dbs→UPDATE+audit, `dbs as unknown as AuditDbHandle` cast) / 미조재 분기 db.transaction(tx→UPDATE+audit). markExpertReview 헬퍼 제거 후 인라인 update(PgTransaction ≠ `typeof db` `$client` 한계 — consult.ts:675 typecheck 에러, impact analyzer 동일 패턴).

### 안전 분류 (수정 없음 — L-013 직돀 false-positive 8곳)
- **lib/radar/delta-sync/ingest.ts:134** — 이미 `withTenantScope(tx)` 내부 + `writeAudit({...}, tx)` 2인자(M-2/#300 fix). traceability.section_superseded.
- **lib/knowledge-gap/owning-issue.ts:233** — audit-only(`owning_issue_creation_failed`, retry 3회 실패 시 mutation 없음).
- **lib/model-governance/rlhf-gate.ts:52** — `writeAudit({...}, dbs as unknown as AuditDbHandle)` withTenantScope 내부 전달(modelgov.change_requested).
- **lib/rlhf/calibration-proposal.ts:95** — `writeAudit({...}, tx as unknown as AuditDbHandle)` withTenantScope 내부 전달(rlhf.calibration_proposed). @MX:WARN "audit MUST share the tx" 이미 이행.
- **lib/standards/alert-pipeline.ts:72** — `writeAudit({...}, tx)` withTenantScope 내부 전달(standards.alert.emitted).
- **lib/inngest/knowledge-sources/orphan-cleanup.ts:114** — `writeAudit({...}, tx)` withTenantScope 내부 전달(source.orphan_sunsetted).
- **lib/ai/consult.ts:274** — audit-only(`llm.call`, LLM 호출 전 usage audit, mutation 없음).
- **lib/ai/consult.ts:371** — audit-only(`source.access`, RAG citation 접근 audit, mutation 없음).

→ registry §4 "ai/consult(4곳)" 중 실제 위반은 :658 1곳만(:274/:371 audit-only, :604 expert_review.flag는 별도 decision-audit). grep/AST 근사 ~15곳 → 직돀 위반 **10곳**(PR-D-1 8→5 패턴 동일 감소).

### 검증
- typecheck 0 · lint 0(lint:hex OK, 변경 파일 biome clean — 12 기존 warning 무관) · full vitest **4786 passed**(frontend-shell 플래키 1건 단독 재실행 19/19 green 확인, 무관 — #384)
- ci:* 종 PASS — ci:audit "Audit completeness check: PASS" / format / rbac / module-boundaries / migrations / tokens / i18n / glossary / contrast / build 전 exit 0
- 테스트 mock 보정 6파일: db mock에 `transaction: async (cb) => cb(<db>)` 추가(tx를 db와 동일 체인) + writeAudit 단언 2인자(`, expect.anything()`) 5곳(delta-sync-orchestrator 4 + owning-routing 1). audit-only 경로 단언은 1인자 유지(orchestrator IDOR-fail / owning-issue creation_failed).

### 잔여 후보 (후속 PR-E 대상)
- **lib Priority Medium**: PR-D-2 완료 → **잔여 0곳**
- **구조적(PR-E)**: enqueueActionItems tx 시그니처(Drizzle PgTransaction ≠ Database `$client`) + AuditDbHandle duck-typing 전사 전환(`tx as unknown as AuditDbHandle` cast 3곳 + consult orgId 분기 cast 제거) + digest:42 withTenantScope 통합
- workflows 잔여 3종(audit-response / indication-impact / pccp) 별도 직돀 — cer는 이미 tx 패턴
- **#384 frontend-shell 플래키**(REQ-FND-012 metadata timeout) — 별도 처리

## 14. PR-E-① (#378) — enqueueActionItems tx 시그니처 확장 (impact action item 원자성)

PR-A/B/B-lib/C/D-1/D-2 연속. #366/§3 구조적 한계로 미뤘던 impact action item 원자성 해소 — enqueueActionItems(action-queue.ts)가 auditActionItemCreated(analyzer.ts:140)와 별도 autocommit 경계 → 동일 `db.transaction`으로 통합.

### 직돀 (이슈 전제 정정 — L-013)
- §3 "action items는 별도 경계" → 실제 원인은 Drizzle `PgTransaction` ≠ `Database`(`$client`) 타입 한계(analyzer.ts:116-120 주석 명시), 설계 의도 아님.
- enqueueActionItems(action-queue.ts)는 **INSERT만**(auditActionItemCreated 호출 안 함). audit는 analyzer.ts:140에서 **tx 미전달**로 autocommit → action item INSERT + audit 별도 경계 = 위반.
- SELECT-back(analyzer.ts:133 `db.select...where assessmentId`)로 생성된 item id 조회 후 per-item audit. 이 SELECT도 tx 통합 대상.

### 구현 (PR-B-lib 패턴 준용, 2 파일 +62/-36)
- **action-queue.ts**: `export type DbClient = PostgresJsDatabase<typeof schema>` 추가, 시그니처 `(input, db: DbClient, tx?: DbClient)` + `const q = tx ?? db` + `q.insert`. 기존 호출자 호환(tx optional). `Database`는 DbClient 상위타입(`$client` 추가) → global db 그대로 전달 가능.
- **analyzer.ts:116-146**: action items 블록(enqueueActionItems + SELECT-back + per-item auditActionItemCreated)을 `db.transaction(async (tx) => {...})`로 래핑. `enqueueActionItems(input, db, tx as DbClient)`(단일 cast, PR-B-lib 선례) + `tx.select` + `auditActionItemCreated({...}, tx)`(raw tx, 기존 impact analyzer:84-104 패턴 — cast 불필요).
- **동작 보존**: action items는 assessment INSERT tx(analyzer:67-108)와 **별도 경계 유지** — action item 실패가 durable assessment+audit를 롤백하지 않음(failure isolation 보존). 오직 action item INSERT + 그 audit 간 원자성 확보(Part 11 §11.10(e) 핵심).

### 검증 (직검, L-007/008/009/013/015)
- typecheck 0(테스트 포함, `tx as DbClient` cast 정상) · lint 0(biome organizeImports 자동 정리) · full vitest **4784 passed**(3 플래키: frontend-shell #384 + traceability REQ-057/058 + mapping-engine-deadcode — **전부 단독 green**, full-suite 병렬 부하 플래키, impact 변경과 무관 도메인)
- ci:* 종 PASS — audit / format / rbac / module-boundaries / migrations 전 exit 0
- 테스트 mock 보정 **0파일**: enqueueActionItems 전용 단위 테스트 부재(impact-migrations는 enum 카운트만). action-items 원자성 행위 테스트는 커버리지 갭(평가자 권고 후보)이나 기존 상태(회귀 아님).

### 잔여 후보 (후속 PR-E ②③ 대상)
- **PR-E ② AuditDbHandle duck-typing 전사 전환**: `tx as DbClient`(본 PR action-queue) + `tx as unknown as AuditDbHandle` cast 3곳(rlhf-gate:65, calibration-proposal:111, consult:668) + model-governance 3곳(rollback:104, change-workflow:223/266) 제거 → AuditDbHandle를 전사 표준 tx 타입으로 승격.
- **PR-E ③ digest:42 통합**: generateWeeklyDigest withTenantScope(RLS tx) GUC 기반 구조적 설계 변경.
- workflows 잔여 3종(audit-response / indication-impact / pccp) 별도 직돀.
- **#384 frontend-shell 플래키**.

## 15. workflows 3종 직돀 (#378) — pccp 위반 2곳 tx 래핑 / audit-only 5곳 분류

PR-A/B/B-lib/C/D-1/D-2/E-① 연속. #378 잔여 workflows 3종(audit-response / indication-impact / pccp) 라우트 직돀. cer는 이미 tx 패턴(§11 확인), submission-drafter는 PR-C 완료 → 제외.

### 직돀 결과 — 위반 2곳 (pccp만, 나머지 audit-only dispatcher)
- **SAFE 5곳(수정 없음)**:
  - audit-response/route.ts · indication-impact/route.ts — **audit-only**(writeAudit workflow.start, DB mutation 자체 없음 — runId는 crypto.randomUUID, workflow_runs INSERT 없음). 원자성 우려 성립 안 함.
  - audit-response/[runId]/status · indication-impact/[runId]/status — writeAudit/mutation 0.
  - pccp/[id]/export/route.ts — **audit-only**(workflow.download 2건, DB mutation 없음 — 파일 생성은 in-memory).
  - cer/route.ts — 이미 `db.transaction`(line 90, §11 레지스트리 확인).
- **위반 2곳**:
  - pccp/route.ts(create) — INSERT pccpVersions + auditPccpCreated 별도 autocommit.
  - pccp/[id]/approve/route.ts — transitionPccpStatus(UPDATE via lib, global db) + auditPccpExpertApproved + auditPccpStatusChanged 별도 autocommit.

### 구현 (PR-B-lib + impact audit-wiring 패턴, 4 파일 +131/-71)
- **lib/pccp/audit-wiring.ts**: auditPccpCreated / auditPccpExpertApproved / auditPccpStatusChanged에 `tx?: AuditDbHandle` 추가 + writeAudit forward(impact audit-wiring 패턴). AuditDbHandle import.
- **lib/pccp/version-manager.ts**: `DbClient = PostgresJsDatabase<typeof schema>` 추가, transitionPccpStatus에 `tx?: DbClient` 옵션 + `q = tx ?? db`(SELECT 검증 + UPDATE 모두 q 사용). 단일 호출처(approve)만 영향.
- **pccp/route.ts**: INSERT + auditPccpCreated를 `db.transaction(async (tx) => { tx.insert; auditPccpCreated({...}, tx) })` 래핑. `if (!row) return null` → 500 보존.
- **pccp/[id]/approve/route.ts**: transitionPccpStatus + 2 audit를 `db.transaction` 래핑. `transitionPccpStatus({..., tx: tx as DbClient})` + `auditPccpExpertApproved({...}, tx)` + `auditPccpStatusChanged({...}, tx)`.
- 동작 보존: transitionPccpStatus의 SELECT 검증(isValidTransition)은 tx 내에서 동일 동작. 404/409/422 사전 검증 라우트는 tx 외부 유지.

### 검증 (직검, L-007/008/009/013/015)
- typecheck 0(테스트 포함) · lint 0(biome organizeImports 정상) · full vitest **4785 passed**
- 2 플래키(frontend-shell #384 + useConversations REQ-BREADTH) — **전부 단독 green**(useConversations 7/7), pccp 무관 도메인. pccp-migrations 7/7(영향 0).
- ci:* 종 PASS — audit / format / rbac / module-boundaries / migrations 전 exit 0
- 테스트 mock 보정 0파일: pccp 라우트 전용 단위 테스트 부재(pccp-migrations는 enum 카운트만). 행위 테스트 갭은 기존 상태.

### 잔여 후보 (후속 PR-E ②③ 대상)
- **workflows 3종**: 본 PR 완료 → **잔여 0곳**(pccp 위반 2곳 해소, 나머지 audit-only).
- **PR-E ② AuditDbHandle duck-typing 전사 전환**: `tx as DbClient`(action-queue + version-manager 본 2 PR) + `tx as unknown as AuditDbHandle` cast 3곳(rlhf-gate, calibration-proposal, consult) + model-governance 3곳(rollback, change-workflow ×2) 제거.
- **PR-E ③ digest:42 통합**: generateWeeklyDigest withTenantScope GUC 기반 구조적 설계 변경.
- **#384 frontend-shell 플래키**.

## 16. PR-E-② (#378) — AuditDbHandle duck-typing 전사 전환 (cast 10곳 제거)

PR-A/B/B-lib/C/D-1/D-2/E-①/workflows 연속. AuditDbHandle를 전사 표준 tx 타입으로 승격 → `tx as DbClient` 4곳 + `tx as unknown as AuditDbHandle` 6곳 = **cast 10곳 전부 제거** + 병렬 `DbClient` 타입 3개(action-queue, version-manager, signature/queries) 제거.

### 직돀 핵심 (feasibility 검증)
- AuditDbHandle 주석이 "PgTransaction provides all three (insert/select/execute) with compatible signatures, ~24 db.transaction sites compatible WITHOUT change" 명시 → cast가 **과보호적(historical)**일 가능성.
- **실험**: rlhf-gate 1곳 cast 제거 → typecheck EXIT 0 → DrizzleClient(withTenantScope callback)가 AuditDbHandle에 **직접 할당 가능** 확정. 전사 cast 제거 착수.

### 구현 (13 파일 +37/-49, net 단순화)
- **lib/audit.ts AuditDbHandle 확장**: `update` + `delete` 추가 → `{insert; select; update; delete; execute}`. (lib 도메인 함수들이 select/update/delete를 쓰므로 확장 필요. PgTransaction + db singleton 모두 호환.)
- **`as unknown as AuditDbHandle` 6곳 제거**: rlhf-gate · calibration-proposal · consult(orgId 분기) · model-governance rollback · change-workflow ×2. withTenantScope callback(DrizzleClient) → AuditDbHandle 직접 할당. 미사용 import 정리.
- **DbClient → AuditDbHandle 통일 (4 lib)**: action-queue · version-manager · signature/queries · signature/lock(isAnswerLocked). `DbClient = PostgresJsDatabase<typeof schema>` 타입 정의 + PostgresJsDatabase/schema-namespace import 제거 → AuditDbHandle import로 대체. lib 함수 db/tx 파라미터 모두 AuditDbHandle. (lock.ts는 evaluator completeness flag로 추가 — cast 없이 자체 DbClient 정의 사용하던 4번째.)
- **`as DbClient` 4곳 제거**: analyzer.ts(enqueueActionItems) · pccp/approve(transitionPccpStatus) · signature route · revoke route. PgTransaction → AuditDbHandle 직접 할당. DbClient import 제거.

### 검증 (직검, L-007/008/009/013/015)
- typecheck 0(테스트 포함, 2단계 검증: Sub-step A 6 cast → EXIT 0, Sub-step B 통일 → EXIT 0) · lint 0(12 기존 warning 무관, unused import 정리 완료)
- full vitest **4787 passed 0 failed**(플래키 0 — #384 fix 유지). 타입 전사 통일 회귀 없음.
- ci:* 종 PASS — audit / format / rbac / module-boundaries / migrations 전 exit 0

### 효과
- cast 10곳 + 병렬 타입 3개 제거 → 단일 AuditDbHandle duck-type로 tx 전달 통일. 향후 audit-atomicity PR cast 불필요.
- net -12 LOC(단순화). Part 11 원자성 변경 없음(타입만).

### 잔여 후보 (후속 PR-E ③ 대상)
- **PR-E ③ digest:42 통합**: generateWeeklyDigest withTenantScope(RLS tx) GUC 기반 구조적 설계 변경 — 마지막 구조적 청크.
- (참고) #384 플래키는 PR #388로 CLOSED.

## 17. PR-E-③ (#378) — digest:42 통합 (audit를 lib withTenantScope tx 내부로)

PR-A/B/B-lib/C/D-1/D-2/E-①/workflows/E-② 연속. #378 마지막 구조적 청크. §10의 "digest:42 audit-only 안전" 분류를 직돀로 **정정**(L-013) → 실제 위반.

### 직돀 정정 (§10 분류 오류)
- §10은 digest:42를 "route writeAudit(digest_generated)은 audit-only 부수 기록, INSERT는 withTenantScope 원자적"으로 안전 분류.
- **직돀**: route line 42 `digest_generated` audit는 resource_id=payload.week_id(INSERT된 digest) 기록 → INSERT와 **페어**이지만 **별도 tx**(INSERT는 lib withTenantScope 커밋 후, route는 autocommit) → **위반**. §10 "audit-only" 분류 오류.
- 추가 발견: Inngest cron(weekly-digest.ts)은 generateWeeklyDigest 호출 후 audit **0건**(누락 — INSERT만, audit 없음).

### 구현 (GUC 기반 통합, 3 파일 +36/-10)
- **lib/digest/digest-generator.ts**: digest_generated audit를 generateWeeklyDigest 내부 withTenantScope(weeklyDigests upsert와 동일 tx)로 이동. INSERT+audit 원자적. `actorId?: string | null` param 추가(route=user, cron=system null).
- **app/api/ra/digest/generate/route.ts**: route line 42 audit 제거(이제 lib에서). `generateWeeklyDigest(orgId, weekId, session.user.id)`로 actor 전달.
- 효과: INSERT+audit 동일 RLS tx 원자적 + cron 경로 audit 누락 해소(system actor). digest:62(emailSentAt+digest_emailed)는 PR-B 래핑으로 이미 안전(변경 없음).
- **테스트**: digest-generator.test.ts에 writeAudit mock 추가(구조/카운트 단위 테스트 — audit의 advisory-lock execute 경로 회피).

### 검증 (직검, L-007/008/009/013/015)
- typecheck 0 · lint 0 · full vitest **4787 passed 0 failed**(digest-generator 17/17, 회귀 0, 플래키 0)
- ci:* 종 PASS — audit/format/rbac/module-boundaries/migrations 전 exit 0

### 진척 — #378 사실상 완결
- 본 PR로 #378 writeAudit tx 원자성 작업 **완결**: app/api/ra(PR-A/B/C) + non-ra(PR-D-1) + lib Priority Medium(PR-D-2) + 구조적(PR-E-① enqueueActionItems / E-② AuditDbHandle 전사 / E-③ digest 통합) + workflows(pccp) + impact(#366) 전 커버.
- 잔여: 행위 테스트 보강(evaluator 권고, runImpactAnalysis action-items + pccp create/approve — 커버리지 갭, 회귀 아님).
