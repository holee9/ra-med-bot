---
artifact: research
spec_id: SPEC-REGULA-VALIDATION-002
version: 0.1.0
status: draft
created: 2026-07-07
updated: 2026-07-07
author: manager-spec (plan-phase)
---

# Research — SPEC-REGULA-VALIDATION-002 (Validation 정식 연동)

본 research는 VALIDATION-001의 fallback/stub 지점을 정식 연동으로 전환하기 위해
4개 선행 SPEC(#71 MODEL-GOVERNANCE, #47 TRACEABILITY, #48 SOURCE-GOVERNANCE, #31
RELEASE)의 코드 자산을 인벤토리화하고, VALIDATION-001이 소비할 read-only API를
식별한다. Charter [지양-5] (SaaS 외판 금지, over-engineering 금지)와 VALIDATION-001
§1.5 CSV-Lite 원칙에 따라 모든 연동은 **thin glue layer**로만 수행한다.

---

## §1 범위 배경 (VALIDATION-001 fallback/stub 인벤토리)

### 1.1 VALIDATION-001 산출물 (main `c154b43` 기준, PR #359 머지)

| 코드 자산 | 라인 수 | 역할 | 정식 연동 대상 |
|-----------|--------|------|---------------|
| `scripts/validation/collect-iq.ts` | 308 | IQ evidence 수집 (env/deps/migrations/config/secret) | 본 SPEC 범위 외 (이미 self-contained) |
| `scripts/validation/collect-oq.ts` | 228 | OQ evidence 수집 (CI run ID 매핑) | 본 SPEC 범위 외 |
| `scripts/validation/collect-pq.ts` | 319 | PQ evidence 수집 (E2E + eval) | 본 SPEC 범위 외 |
| `scripts/validation/classify-changes.ts` | 350 | 7축 change-control 분류 | **본 SPEC R2/M1 + source-gov/M2 대상** |
| `scripts/validation/build-report.ts` | 261 | Release Validation Report Markdown 빌더 | **본 SPEC R6/M3 대상 (3 stub 섹션)** |
| `lib/validation/rerun-gate.ts` | 129 | high-impact + rerun 부재 시 sign-off 차단 | 본 SPEC 범위 외 (이미 완결) |
| `lib/validation/evidence-writer.ts` | 114 | evidence INSERT 헬퍼 | 본 SPEC 범위 외 |
| `lib/validation/checklist.ts` | 89 | sign-off checklist 항목 정의 | 본 SPEC 범위 외 |
| `app/api/validation/signoff/route.ts` | 216 | sign-off API (checklist gate + audit write) | 본 SPEC 범위 외 |

### 1.2 정확한 fallback/stub 코드 위치 (본 SPEC 전환 대상)

#### A. classify-changes.ts — model/prompt 축 (R2)

**상태**: VALIDATION-001 plan.md는 R2를 "model-governance 미구현 → fallback
허용"으로 기술했으나, **실제 구현(`c154b43`)은 이미 `change_request` 테이블을
직접 조회**한다 (classify-changes.ts:83-119).

```
// classify-changes.ts:83-119 — 현재 구현 (이미 정식 연동의 기반)
async function classifyModelGovernanceAxis(axis: 'prompt' | 'model') {
  const column = axis === 'prompt' ? changeRequest.promptId : changeRequest.modelPinId;
  const approved = await db.select({ id: changeRequest.id })
    .from(changeRequest)
    .where(and(eq(changeRequest.approvalStatus, 'approved'), isNotNull(column)));
  // ... approved.length > 0 → high impact
}
```

**R2 실제 gap** (정식 연동으로 보강해야 할 점):
1. **Window scoping 부재**: `createdAt` 기준 `[previous_release_tag, current_cutoff]`
   범위 필터가 없음 → 과거 release에서 승인된 change_request도 high로 분류됨.
2. **org scoping 명시 부재**: RLS에 의존 (암묵적). consumer wrapper에서 명시해야
   VALIDATION-002 도메인 경계가 명확해짐.
3. **eval_run 연계 누락**: `change_request.evalRunId` / `evalResultRef`를
   `change_control.evidence_ref`에 연결하지 않음 → rerun gate가 OQ evidence로만
   평가함 (change_request 내부의 eval 게이트 결과 무시).

#### B. classify-changes.ts — source_policy 축 (R2 확장)

**상태**: 순수 git-diff heuristic (classify-changes.ts:186-195).

```
// classify-changes.ts:186-195
async function classifySourcePolicyAxis(_releaseId, previousRef) {
  return classifyGitDiffAxis('source_policy', previousRef, [
    'lib/source-governance/', 'lib/ai/policy-keywords.ts',
  ]);
}
```

**Gap**: #48 SOURCE-GOVERNANCE의 `getGovernanceDashboard` API가 corpus 상태
(approved/pendingReview/rejected/stale/superseded counts)를 노출하지만, 현재
축 분류는 이를 소비하지 않음. "release 기간 내 source 권위도 변경"을
평가하려면 dashboard snapshot 비교가 필요하다.

#### C. build-report.ts — 3 stub 섹션 (R6)

**정확한 위치**: `scripts/validation/build-report.ts:208-223`.

```
## Release Scope Status (#31-#34)
> **Stub** — SPEC-REGULA-RELEASE-001 (#31-#34) not yet complete. ...

## Traceability Status (#47)
> **Stub** — SPEC-REGULA-TRACEABILITY-001 (#47) not yet complete. ...

## Source Governance Status (#48) · Review Ops Status (#36)
> **Stub** — ... not yet complete. ...
```

이제 #31/#47/#48은 모두 CLOSED/completed 상태이므로 stub을 실데이터로 교체해야
한다. #36 (Review-Ops)은 여전히 OPEN이므로 stub을 유지하되 "not implemented"
사유를 명시한다 (REQ-VAL2-008).

#### D. release_id 포맷 (R7)

**상태**: `validation_evidence.releaseId`는 `text()` (schema.ts:3451), FK 아님.
RELEASE-001 (#31)은 release lifecycle 테이블을 정의하지 않는다 (아래 §2.4 참조).

---

## §2 선행 SPEC 코드 자산 인벤토리

### 2.1 SPEC-REGULA-MODEL-GOVERNANCE-001 (#71, status: draft, code exists)

> Issue #71은 CLOSED. SPEC 문서는 `draft`이나 코드는 lib/model-governance/에
> 구현되어 있으며, VALIDATION-001이 이미 `change_request` 테이블을 소비 중.

**코드 자산** (lib/model-governance/):

| 파일 | 역할 | VALIDATION-002 소비 여부 |
|------|------|--------------------------|
| `change-workflow.ts` | change_request CRUD + 승인 워크플로우 | **소비 (간접)** — DB 직접 SELECT |
| `registry.ts` | prompt registry 조회 | 소비 안 함 |
| `model-pinning.ts` | model pin 관리 | 소비 안 함 |
| `eval-gate.ts` | eval 게이트 실행 | 소비 안 함 (change_request.evalRunId로 간접) |
| `rollback.ts` | 롤백 절차 | 소비 안 함 |
| `audit.ts` | model-gov 감사 | 소비 안 함 |

**소비 인터페이스** (VALIDATION-002가 읽을 데이터):
- 테이블: `change_request` (schema.ts:2822-2845)
- 컬럼: `id`, `orgId`, `promptId`, `modelPinId`, `evalRunId`, `evalStatus`,
  `evalResultRef`, `approvalStatus`, `approvedAt`, `createdAt`
- 인덱스: `idx_change_request_org`, `idx_change_request_org_status`

**정식 연동 추가 쿼리** (M1):
```sql
-- window-scoped, org-scoped model/prompt approved change count
SELECT id, eval_run_id, eval_result_ref, approved_at
FROM change_request
WHERE org_id = $1
  AND approval_status = 'approved'
  AND (prompt_id IS NOT NULL OR model_pin_id IS NOT NULL)
  AND created_at >= $2  -- previous release tag date
  AND created_at < $3   -- current release cutoff
```

### 2.2 SPEC-REGULA-TRACEABILITY-001 (#47, status: completed)

**코드 자산** (lib/traceability/):

| 파일 | 역할 | VALIDATION-002 소비 여부 |
|------|------|--------------------------|
| `matrix.ts` | `buildMatrix(db, filters, deps)` → MatrixResult | **소비 (M3)** |
| `graph.ts` | node/edge CRUD + `findNodeByRef`, `isNodeStale` | 소비 안 함 |
| `verify-edges.ts` | edge 무결성 검증 | 소비 안 함 |
| `stale-propagation.ts` | stale 전파 | 소비 안 함 |
| `client.ts` | 클라이언트 SDK | 소비 안 함 |

**소비 인터페이스** (M3):
```typescript
// lib/traceability/matrix.ts:61
export async function buildMatrix(
  db: TraceabilityDb,
  filters: MatrixFilters,  // { orgId, projectId?, ... }
  deps: { staleNodeIds: Set<string>; ... }
): Promise<MatrixResult>
// MatrixResult.summary = { totalRows, withGaps, stale }
```

**경계 주의**: `buildMatrix`는 org/project 스코프이며 **release 차원이 없다**.
VALIDATION-002는 sign-off 시점에 snapshot을 찍어 report에 기록하는 방식으로
소비한다 (release 간 delta 비교는 post-v0.1).

### 2.3 SPEC-REGULA-SOURCE-GOVERNANCE-001 (#48, status: draft, code exists)

> Issue #48 CLOSED. 코드는 lib/source-governance/에 구현.

**코드 자산** (lib/source-governance/):

| 파일 | 역할 | VALIDATION-002 소비 여부 |
|------|------|--------------------------|
| `dashboard.ts` | `getGovernanceDashboard({orgId})` → counts + reviewDue + staleArtifacts | **소비 (M2 + M3)** |
| `authority-model.ts` | 6-tier 권위도 모델 | 소비 안 함 |
| `stale-check.ts` | `verifyGovernanceFreshness` | 소비 안 함 |
| `review-workflow.ts` | source 검토 워크플로우 | 소비 안 함 |
| `retrieval-gate.ts` | RAG 검색 게이트 | 소비 안 함 |

**소비 인터페이스** (M2/M3):
```typescript
// lib/source-governance/dashboard.ts:40
export async function getGovernanceDashboard(params: {
  orgId: string;
}): Promise<GovernanceDashboard>
// counts: { approved, pendingReview, rejected, stale, superseded }
// reviewDue: ReviewDueSource[]
// staleCitationArtifacts: StaleCitationArtifact[]
```

**경계 주의**: dashboard counts는 **cumulative** (현재 시점 전체 corpus 상태).
release 기간 내 delta를 구하려면 snapshot-at-release 테이블이 필요하나, 이는
VALIDATION-002 범위를 넘는다 (Exclusions §7). M2에서는 "현재 시점 snapshot"을
`change_control.residual_risk`에 문자열로 기록한다.

### 2.4 SPEC-REGULA-RELEASE-001 (#31, status: completed)

**상태**: umbrella SPEC. **release lifecycle 테이블을 정의하지 않음**.
자식 SPEC 3종 (GATE-001 / HARDENING-001 / QUALITY-001) 모두 completed.

**구현 코드**:

| 자산 | 위치 | 역할 |
|------|------|------|
| `lib/release-gate/` | — | 디렉토리 없음 (게이트 로직은 lib/validation/rerun-gate.ts로 통합) |
| release_id SSoT | 없음 | `validation_evidence.releaseId`는 text(), FK 아님 |
| release 산출물 | `scripts/release-rc1/` | rc1 빌드 스크립트 (VALIDATION-001 plan.md에 참조) |

**R7 gap 결론**: RELEASE-001이 release_id 생명주기를 관리하는 테이블을 갖지
않으므로, VALIDATION-002는 **release_id regex + git tag 교차 검증**으로
최소한의 정식화를 수행한다 (Charter [지양-5] 준수 — 신규 테이블 도입 금지).
release_registry 테이블은 별도 후속 SPEC (RELEASE-002 권고)으로 이월한다
(Exclusions §7).

### 2.5 #36 Review-Ops (OPEN, 미구현)

Issue #36은 OPEN 상태이며 lib/review-ops/ 디렉토리가 없다. VALIDATION-002는
report의 Review Ops 섹션을 stub으로 유지하되 "not implemented" 사유를 명시한다
(REQ-VAL2-008). 이는 허구 데이터 생성을 금지하는 Charter [지양-2] 준수 조치다.

---

## §3 Reuse Map (VALIDATION-002 소비 모델)

```
lib/validation/consumers/ (신규, 본 SPEC M0)
├── model-governance.ts   ─→ change_request SELECT (window-scoped)
├── traceability.ts        ─→ buildMatrix() snapshot
├── source-governance.ts   ─→ getGovernanceDashboard() snapshot
└── release.ts             ─→ release_id regex + git tag 교차 검증

scripts/validation/classify-changes.ts (본 SPEC M1/M2)
├── classifyModelGovernanceAxis()  ─→ consumers/model-governance.ts
└── classifySourcePolicyAxis()     ─→ consumers/source-governance.ts (+ git diff)

scripts/validation/build-report.ts (본 SPEC M3)
├── renderTraceabilitySection()    ─→ consumers/traceability.ts
├── renderSourceGovernanceSection() ─→ consumers/source-governance.ts
├── renderReleaseScopeSection()    ─→ consumers/release.ts + evidence count
└── renderReviewOpsSection()       ─→ stub 유지 (#36 OPEN)
```

**원칙** (Charter [지양-5]):
- 모든 외부 SPEC 소비는 `lib/validation/consumers/` 단일 진입점으로 라우팅
  (REQ-VAL2-011). 순환 의존성 방지 + SPEC 경계 명확화.
- consumer wrapper는 read-only SELECT + 순수 함수 only. 신규 DB 테이블 금지.
- 기존 VALIDATION-001 코드의 public 시그니처는 불변 (비파괴).

---

## §4 R 리스크별 해소 매트릭스 (VALIDATION-001 plan.md §4 기준)

| VALIDATION-001 리스크 | 원 상태 | VALIDATION-002 해소 방식 | milestone |
|----------------------|---------|--------------------------|-----------|
| R2 (model-gov fallback) | 코드는 `change_request` 조회 중이나 window 없음 | window-scoped query + eval_run 연계 | M1 |
| R2 확장 (source_policy) | 순수 git-diff heuristic | getGovernanceDashboard snapshot 결합 | M2 |
| R6 (report stub) | 3 stub 섹션 (#31/47/48) | buildMatrix + getGovernanceDashboard 실데이터 주입 | M3 |
| R7 (release_id) | regex 제안만, 관리 주체 없음 | regex + git tag 교차 검증 (release_registry는 RELEASE-002 이월) | M4 |

---

## §5 의존성 API 안정성 평가

| 선행 SPEC | API 안정성 | 순환 의존 가능성 | 비고 |
|-----------|-----------|------------------|------|
| #71 MODEL-GOV | 높음 (이미 VALIDATION-001이 소비 중) | 없음 | consumer wrapper가 명시적 경계 |
| #47 TRACEABILITY | 중간 (buildMatrix 시그니처 진화 가능) | 없음 | wrapper interface가 완충 |
| #48 SOURCE-GOV | 중간 (dashboard counts 스키마 변경 시) | 없음 | wrapper interface가 완충 |
| #31 RELEASE | 해당 없음 (테이블 없음) | 없음 | regex + git tag만 소비 |

모든 소비는 read-only이므로 순환 의존성(VALIDATION-002 → 선행 SPEC →
VALIDATION-002)은 발생하지 않는다.

---

## §6 테스트 고려 (L-013 직검 원칙)

- 각 consumer wrapper는 mock DB로 단위 테스트 (VALIDATION-001 패턴 준용).
- integration 테스트는 실DB에서 `change_request`, `evidence_nodes`,
  `sources` 행을 seed → consumer 호출 → 반환값 직검.
- AC 검증은 `pnpm test` 전체 스위트 + 수동 DB query (L-013).
- `pnpm lint` (lint:hex 포함) full 실행 (L-008).
- 마이그레이션 신규 0건 (본 SPEC은 스키마 변경 없음) → L-010 해당 없음.

---

## §7 References

- VALIDATION-001 SPEC: `.moai/specs/SPEC-REGULA-VALIDATION-001/spec.md`
- VALIDATION-001 plan.md §4 리스크 레지스터: line 189-195 (R2/R6/R7)
- VALIDATION-001 plan.md §7 의존성 타임라인: line 243-259
- PR #359 (VALIDATION-001 run-phase): main `c154b43`
- PR #358 (VALIDATION-001 plan-phase): main `7c88a87`
- Charter [지양-5] (SaaS 외판 금지): `~/.claude/projects/.../memory/product-charter.md`
