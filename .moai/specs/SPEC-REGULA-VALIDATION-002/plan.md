---
artifact: plan
spec_id: SPEC-REGULA-VALIDATION-002
version: 0.1.0
status: completed
created: 2026-07-07
updated: 2026-07-07
author: manager-spec (plan-phase)
development_mode: tdd
---

# Implementation Plan — SPEC-REGULA-VALIDATION-002

본 plan은 research.md의 자산 인벤토리를 소비하여 5개 milestone(M0~M4)로 구성된다.
각 milestone은 priority 기반 순서를 가지며, 시간 추정은 moai-constitution Time
Estimation 금지 원칙에 따라 phase ordering으로 표현한다.

**범위 통제 원칙** (Charter [지양-5] + VALIDATION-001 §1.5 계승):
- 신규 DB 테이블 금지 (release_registry 포함, REQ-VAL2-012)
- 신규 테스트 harness 금지 (기존 vitest 패턴 준용)
- 외부 라이브러리 도입 금지
- VALIDATION-001 public 시그니처 불변 (비파괴)

---

## §1 Milestone 개요

| Milestone | 이름 | Priority | Depends On | 산출물 |
|-----------|------|----------|------------|--------|
| M0 | Consumer Wrappers (Read-Only Integration Seam) | Critical (blocker) | — | `lib/validation/consumers/*.ts` 4 파일 + 단위 테스트 |
| M1 | R2 — model/prompt 정식 연동 (window-scoped) | High | M0 | `classify-changes.ts` 수정 + eval_run 연계 |
| M2 | R2 확장 — source_policy 정식 연동 | Medium | M0 | `classify-changes.ts` 수정 + dashboard snapshot |
| M3 | R6 — report stub → 실데이터 | High | M0 | `build-report.ts` 3 섹션 실데이터 렌더링 |
| M4 | R7 — release_id 정식화 (regex + git tag) | Medium | M0 | `lib/validation/consumers/release.ts` + API gate |

> M1/M2/M3/M4는 M0 완료 후 병렬 착수 가능 (독립 파일). 단 PR 분리를 위해
> 순차 진행을 권장한다.

---

## §2 Milestone 상세

### M0 — Consumer Wrappers (Critical Blocker)

**목표**: 4개 선행 SPEC의 read-only 소비를 단일 진입점(`lib/validation/consumers/`)으로
라우팅하는 헬퍼 모듈을 신규 생성. 이후 milestone이 의존하는 기반.

**태스크**:
1. `lib/validation/consumers/model-governance.ts` 신규
   - `fetchWindowScopedChangeRequests(params: { orgId, windowStart, windowEnd }): Promise<ChangeRequestRow[]>`
   - `windowStart` = previous release tag date (git log -1 --format=%cI `<tag>`)
   - `windowEnd` = 현재 release cutoff (기본 `new Date()`)
   - 컬럼: `id`, `promptId`, `modelPinId`, `evalRunId`, `evalResultRef`,
     `approvalStatus`, `approvedAt`, `createdAt`
   - 명시적 `WHERE org_id = $1 AND created_at >= $2 AND created_at < $3`
2. `lib/validation/consumers/traceability.ts` 신규
   - `snapshotTraceability(params: { orgId, projectId? }): Promise<MatrixSummary>`
   - 내부적으로 `buildMatrix(db, filters, deps)` 호출
   - `MatrixSummary = { totalRows: number; withGaps: number; stale: number }`
   - staleNodeIds 주입을 위해 `lib/traceability/stale-propagation.ts` 패턴 준용
3. `lib/validation/consumers/source-governance.ts` 신규
   - `snapshotSourceGovernance(params: { orgId }): Promise<GovernanceDashboard>`
   - `getGovernanceDashboard` thin wrapper (변환 없음, 투명 전달)
4. `lib/validation/consumers/release.ts` 신규
   - `validateReleaseIdFormat(releaseId: string): { valid: boolean; reason?: string }`
   - regex `^v\d+\.\d+\.\d+(-rc\d+)?$`
   - `checkGitTagExists(releaseId: string): Promise<{ exists: boolean; warning?: string }>`
   - `git tag --list <releaseId>` 호출 (child_process spawnSync)
5. 단위 테스트 (TDD RED → GREEN):
   - mock DB로 change_request window query 검증
   - mock buildMatrix로 snapshot 검증
   - mock getGovernanceDashboard로 snapshot 검증
   - release_id regex accept/reject 케이스 (v0.1.0, v0.1.0-rc1, invalid-id, v0.1)
   - git tag 존재/부재 케이스 (mock spawnSync)
6. `index.ts` barrel export ( consumers/ 진입점)

**Reuse**: `change_request` schema, `buildMatrix`, `getGovernanceDashboard`, git CLI

**Gate (M0 → M1/M2/M3/M4)**:
- `pnpm ci:typecheck` green
- consumers/ 단위 테스트 N개 green (mock 기반)
- 각 consumer 함수가 순수 함수 (side-effect 없음) 인증
- `lib/validation/consumers/` 디렉토리에 4 파일 + index.ts 존재
- AC-10 (consumer 경유) 기반 마련

**Risks**:
- `buildMatrix`의 `deps.staleNodeIds` 주입 패턴 학습 필요 → 기존
  `app/api/traceability/route.ts` 호출 패턴 참조
- git tag 호출이 샌드박스 환경에서 차단될 수 있음 → spawnSync fallback
  (warning만, exit 0)

---

### M1 — R2 해소: model/prompt 정식 연동 (High)

**목표**: `classify-changes.ts`의 model/prompt 축이 consumer 경유 + window-scoped로
동작하도록 전환.

**태스크**:
1. `scripts/validation/classify-changes.ts` 수정:
   - `classifyModelGovernanceAxis(releaseId, axis)`가
     `fetchWindowScopedChangeRequests({ orgId, windowStart, windowEnd })` 호출
   - `previousRef` 인자를 받아 windowStart 계산:
     `git log -1 --format=%cI <previousRef>` → ISO timestamp
   - `windowEnd` = `new Date()` (현재 release cutoff)
2. `orgId` 결정 로직:
   - 환경변수 `REGULA_ORG_ID` 또는 기본 org (시스템 검증 컨텍스트)
   - 단일-org 가정 (Charter [지양-5] — SaaS 외판 아님)
3. high-impact 시 `change_control.evidence_ref`에 `evalRunId` 기록:
   - consumer가 반환한 `evalRunId` / `evalResultRef`를
     `upsertChangeControlRow`의 `evidenceRef` 인자로 전달
4. 단위 테스트 (TDD):
   - window 내 change_request 1건 → high-impact 분류
   - window 외 (과거) change_request → low-impact (무시)
   - pending_review 1건 → medium-impact
5. integration 테스트:
   - 실DB에 change_request 2건 (window 내/외) seed → classify-changes 실행 →
     change_control 행 2개의 impact_level 직검 (L-013)
   - high-impact 행의 evidence_ref에 evalRunId 문자열 포함 확인

**Reuse**: `lib/validation/consumers/model-governance.ts` (M0)

**Gate (M1 완료 조건)**:
- AC-1 (window-scoped query) 통과
- AC-2 (evidence_ref에 evalRunId) 통과
- 기존 VALIDATION-001 classify-changes 단위 테스트 회귀 없음
- `pnpm ci:typecheck` green

---

### M2 — R2 확장: source_policy 정식 연동 (Medium)

**목표**: source_policy 축을 git-diff + dashboard snapshot 결합으로 강화.

**태스크**:
1. `scripts/validation/classify-changes.ts` 수정:
   - `classifySourcePolicyAxis(releaseId, previousRef)`가
     `snapshotSourceGovernance({ orgId })` 호출
   - 현재 git-diff 카운트와 dashboard counts를 모두 residual_risk에 기록
2. residual_risk 문자열 포맷:
   ```
   git_diff={N} commit(s) under lib/source-governance/;
   dashboard=approved:{a},pending:{p},stale:{s},superseded:{u}
   ```
3. impact rating 조정:
   - git-diff >= 3 OR dashboard.stale > 0 OR dashboard.superseded > 0 →
     high-impact (보수적 과분류, VALIDATION-001 R3 원칙 계승)
   - 그 외 기존 임계값 유지
4. 단위 테스트:
   - git-diff 0 + dashboard counts 모두 0 → low
   - git-diff 2 + dashboard.superseded 1 → high (superseded 우선)
   - dashboard.stale > 0 → high
5. integration 테스트:
   - 실DB에 sources 행 3건 (approved/pending/superseded) seed → classify-changes
     실행 → residual_risk 문자열에 counts 포함 직검

**Reuse**: `lib/validation/consumers/source-governance.ts` (M0)

**Gate (M2 완료 조건)**:
- AC-3 (residual_risk에 dashboard counts) 통과
- 기존 VALIDATION-001 source_policy 단위 테스트 회귀 없음

**Risks**:
- dashboard counts가 cumulative이므로 "release 기간 내 변경"을 직접 의미하지
  않음 → residual_risk에 "snapshot at {timestamp}" 명시로 정확한 의미 기록

---

### M3 — R6 해소: report stub → 실데이터 (High)

**목표**: `build-report.ts`의 3 stub 섹션을 실데이터 렌더링으로 교체.

**태스크**:
1. `scripts/validation/build-report.ts` 수정:
   - 신규 함수 `renderReleaseScopeSection(releaseId, evidence)`:
     IQ/OQ/PQ evidence count + git tag info + #31-34 정적 완료 상태
   - 신규 함수 `renderTraceabilitySection(orgId)`:
     `snapshotTraceability({ orgId })` 호출 → totalRows/withGaps/stale 표
   - 신규 함수 `renderSourceGovernanceSection(orgId)`:
     `snapshotSourceGovernance({ orgId })` 호출 → counts 표 + reviewDue 길이
   - `renderReviewOpsSection()` (수정):
     stub 유지 + "not implemented — #36 OPEN" 사유 명시
2. `buildReleaseReportMarkdown` 수정:
   - 3 stub 문자열 제거 → 새 렌더링 함수 호출로 교체
   - `Promise.all([evidence, changes, rerunGate, traceSnapshot, sourceSnapshot])`
     병렬 조회
3. 단위 테스트:
   - 각 render 함수가 non-stub Markdown 반환 (grep "Stub" → 0)
   - traceability 섹션에 `totalRows: N` 포함
   - source-gov 섹션에 `approved: N` 포함
   - release scope 섹션에 `IQ: N OQ: N PQ: N` 포함
   - review-ops 섹션에 `not implemented` + `#36` 포함
4. integration 테스트:
   - 실DB에 evidence 6건 (IQ 2/OQ 2/PQ 2) seed + trace/source 행 seed →
     build-report 실행 → 출력 Markdown grep 직검

**Reuse**: `lib/validation/consumers/{traceability,source-governance,release}.ts` (M0)

**Gate (M3 완료 조건)**:
- AC-4, AC-5, AC-6, AC-7 모두 통과
- 생성된 report Markdown에서 "Stub" 단어 등장 0회 (review-ops는 "not implemented"
  로 대체 — 둘은 다름)
- 기존 VALIDATION-001 build-report 단위 테스트 회귀 없음

**Risks**:
- `buildMatrix` 호출 비용 (N+1 query) → 프로젝트 필터로 범위 제한 옵션
- `getGovernanceDashboard` 호출이 드물게 지연 → 타임아웃 5초 설정 (non-blocking)

---

### M4 — R7 해소: release_id 정식화 (Medium)

**목표**: release_id regex 검증 + git tag 교차 검증을 모든 validation API/script
진입점에 적용.

**태스크**:
1. `lib/validation/consumers/release.ts` (M0에서 생성)의
   `validateReleaseIdFormat` / `checkGitTagExists`를 다음 진입점에서 호출:
   - `scripts/validation/collect-iq.ts` 진입부
   - `scripts/validation/collect-oq.ts` 진입부
   - `scripts/validation/collect-pq.ts` 진입부
   - `scripts/validation/classify-changes.ts` 진입부
   - `scripts/validation/build-report.ts` 진입부
   - `app/api/validation/iq/route.ts` POST handler
   - `app/api/validation/oq/route.ts`
   - `app/api/validation/pq/route.ts`
   - `app/api/validation/changes/route.ts`
   - `app/api/validation/report/export/route.ts`
   - `app/api/validation/signoff/route.ts`
2. 거부 동작 (REQ-VAL2-009):
   - regex 불일치 → HTTP 400 (API) 또는 exit 1 (script)
   - 오류 메시지: `Invalid release_id format. Expected ^v\d+\.\d+\.\d+(-rc\d+)?$`
3. warning 동작 (REQ-VAL2-010):
   - git tag 부재 → stderr warning + 계속 진행 (exit 0 / HTTP 2xx)
   - 메시지: `Warning: git tag <release_id> not found locally (pre-release candidate?)`
4. 단위 테스트:
   - `v0.1.0` accept, `v0.1.0-rc1` accept, `v0.1` reject, `invalid` reject,
     `0.1.0` reject
   - git tag 존재/부재 케이스
5. integration 테스트:
   - signoff API에 `release_id=invalid` → HTTP 400
   - signoff API에 `release_id=v99.99.99-rc1` (존재하지 않는 tag) → HTTP 200
     + stderr warning

**Reuse**: `lib/validation/consumers/release.ts` (M0)

**Gate (M4 완료 조건)**:
- AC-8 (regex accept/reject) 통과
- AC-9 (git tag warning non-blocking) 통과
- 기존 VALIDATION-001 API route 단위 테스트 회귀 없음

**Risks**:
- release_id 관행이 이미 `v0.1.0-rc1`로 확립되었으나 일부 스크립트가 다른
  포맷을 사용할 수 있음 → grep 사전 조사 (M0에서 수행)
- 정식 release (rc 아님) 시나리오 → regex가 `v\d+\.\d+\.\d+` (rc 접미사 없음)
  도 허용하도록 설계

---

## §3 Phase Gates

| Gate | 위치 | 통과 조건 | 실패 시 |
|------|------|-----------|---------|
| Gate-A | M0 직후 | consumer wrapper 4 파일 + 단위 테스트 green + typecheck | M1~M4 착수 불가 |
| Gate-B | M1~M4 각 milestone | 각 AC-1~AC-9 통과 + 기존 테스트 회귀 없음 | 다음 milestone 착수 보류 + plan 재검토 |
| Gate-C | M4 완료 (SPEC 전체) | AC-1~AC-10 모두 통과 + `pnpm test` green + `pnpm ci:*` green | SPEC 완료 불가, plan-auditor 재검토 |

---

## §4 리스크 레지스터

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|-----------|-------|
| R1 | `buildMatrix` 시그니처 진화 (TRACEABILITY-001 v1.x) | 중 | 중 | consumer wrapper interface가 완충 (single seam); 추상화 비용 1회 | M0/M3 담당 |
| R2 | source-gov dashboard counts cumulative only → release 간 delta 불가 | 높 | 중 | residual_risk에 "snapshot at {ts}" 명시; post-v0.1 snapshot-at-release 테이블 검토 | M2 담당 |
| R3 | release_id regex가 RELEASE-001 실관행과 불일치 | 중 | 중 | M0에서 git tag 리스트 grep 사전 조사; regex 완화 옵션 (`v\d+\.\d+\.\d+(-rc\d+)?`) | M0/M4 담당 |
| R4 | change_request 대량 누적 시 window 쿼리 지연 | 낮 | 낮 | `idx_change_request_org_status` + created_at range scan; 100k 행 이상 시 파티셔닝 검토 (post-v0.1) | M1 담당 |
| R5 | #36 Review-Ops 장기 미구현 → stub 영구화 | 높 | 낮 | REQ-VAL2-008이 "not implemented" 사유 명시를 강제하여 허구 데이터 차단 | SPEC owner |
| R6 | VALIDATION-001 코드 회귀 (비파괴 원칙 위반) | 낮 | 높 | 각 milestone에서 기존 VALIDATION-001 단위 테스트 full 실행 (L-009); 시그니처 불변 grep 검증 | 각 milestone 담당 |
| R7 | git tag CLI 호출이 샌드박스/CI 환경에서 차단 | 중 | 낮 | spawnSync 실패 시 warning-only fallback (non-blocking); CI에서는 `actions/checkout --tags` 사전 확인 | M4 담당 |
| R8 | consumer wrapper가 순환 의존성 유발 (consumers → A → consumers) | 낮 | 높 | consumers/ 는 lib/db, lib/traceability, lib/source-governance만 의존; 역방향 import 금지 (ESLint rule 추가 검토) | M0 담당 |

---

## §5 테스트 전략

### 5.1 단위 테스트 (vitest)

- consumer wrapper 4종 (mock DB / mock child_process)
- classify-changes.ts 수정 분 (window query 로직, eval_run 연계)
- build-report.ts render 함수들 (non-stub 검증)
- release_id regex / git tag 검증

### 5.2 Integration 테스트

- change_request window 내/외 seed → classify-changes → change_control 직검
- sources 행 seed → classify-changes source_policy → residual_risk 문자열 검증
- evidence + trace + source 행 seed → build-report → Markdown grep
- validation API에 release_id invalid → HTTP 400

### 5.3 회귀 테스트 (L-009 원칙)

- 각 milestone 완료 시 `pnpm test` **full 스위트** 실행 (타깃만 아님)
- 기존 VALIDATION-001 테스트 (collect-iq/oq/pq, classify-changes, build-report,
  rerun-gate) green 유지
- 특히 classify-changes.ts / build-report.ts 시그니처 불변 grep 검증

### 5.4 직접 검증 (L-007/L-013 원칙)

- migration 신규 0건 → L-010 해당 없음
- CI run ID / artifact는 실 GitHub Actions 출력과 교차 검증
- dashboard counts는 실DB SELECT COUNT(*)로 직검 (self-report 금지)
- 모든 게이트는 로컬 `pnpm ci:*` 직검 + CI green 병행 (L-015)

### 5.5 수동 QA

- release_id 포맷이 릴리즈 관행과 일치하는지 RA Lead 검토
- source-gov snapshot 문자열 가독성 검토

---

## §6 범위 통제 원칙 (Scope Discipline)

Charter [지양-5] + VALIDATION-001 §1.5 계승:

1. **신규 DB 테이블 금지** — release_registry 포함 (REQ-VAL2-012)
2. **신규 테스트 harness 금지** — 기존 vitest + CI 집계
3. **신규 외부 라이브러리 금지** — Drizzle + child_process only
4. **VALIDATION-001 API 시그니처 불변** — 비파괴 원칙
5. **허구 데이터 금지** — Review-Ops stub은 "not implemented" 명시 (Charter [지양-2])
6. **Traceability release-dim delta 금지** — snapshot 현재 시점 only (post-v0.1)
7. **PDF export 금지** — Markdown only (REQ-VAL-011 Optional 계승)
8. **다중 관할권 matrix 금지** — post-v0.1

구현 중 scope creep 발견 시 §8 Exclusions로 이월하고 milestone을 재조정한다.

---

## §7 의존성 타임라인

```
VALIDATION-001 (main c154b43, MERGED) ────┐
                                          ├─→ M0 (consumers) ─→ M1 (model-gov)
MODEL-GOVERNANCE-001 (#71, CLOSED) ───────┤                    ├─→ M2 (source-gov)
TRACEABILITY-001 (#47, CLOSED) ───────────┤                    ├─→ M3 (report)
SOURCE-GOVERNANCE-001 (#48, CLOSED) ──────┤                    └─→ M4 (release_id)
RELEASE-001 (#31, CLOSED) ────────────────┤
REVIEW-OPS (#36, OPEN) ───────────────────┴─→ M3 (stub 유지, "not implemented")
```

모든 핵심 의존성이 CLOSED이므로 fallback 모드 불필요. 단 #36은 OPEN이므로
해당 섹션만 stub 유지.

---

## §8 Definition of Done (SPEC 완료 조건)

- [ ] AC-1~AC-10 모두 통과 (acceptance.md)
- [ ] M0~M4 모든 milestone Gate 통과
- [ ] `pnpm test` 전체 green (기존 VALIDATION-001 테스트 회귀 0)
- [ ] `pnpm ci:typecheck`, `pnpm ci:lint`, `pnpm ci:format`, `pnpm ci:migrations` green
- [ ] `pnpm ci:audit` green (VALIDATION-002가 audit에 영향 없음)
- [ ] `lib/validation/consumers/` 디렉토리 4 파일 + index.ts 존재
- [ ] `scripts/validation/build-report.ts` 출력 Markdown에서 "Stub" 0회 (review-ops
  "not implemented"는 허용)
- [ ] classify-changes.ts / build-report.ts의 직접 import 대신 consumers/ 경유
  (grep 검증)
- [ ] SPEC 문서 4종 (spec/plan/acceptance/research) 최신 상태
- [ ] PR 본문에 QA evidence 섹션 (이슈 MoAI 교차검증 기준)
- [ ] #36 Review-Ops가 OPEN인 동안 stub이 "not implemented" 사유 유지 (REQ-VAL2-008)
- [ ] release_registry 테이블 도입 안 함 (REQ-VAL2-012, Exclusions §7)
