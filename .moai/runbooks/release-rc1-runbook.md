---
runbook_id: RELEASE-RC1
version: 7.1.0
created: 2026-05-05
updated: 2026-05-06
owner: drake.lee
status: active
---

# Regula 1차 RC v1.0.0-rc 실행 콘티 (Runbook v7.1)

> 기준: 2026-05-06 KST GitHub Issues/PR 전수 재점검.
>
> 목적: #22 이후 등록 이슈 누락으로 작업 순서가 흔들리는 문제를 차단하고, RC 직전 작업과 RC 이후 Wave backlog를 분리한다.

---

## 0. 작업 게이트

모든 작업 시작 전 #18 Work Gate를 먼저 적용한다.

1. `origin/main` 최신화 및 현재 브랜치 확인
2. 동일 issue/SPEC의 기존 branch/PR 확인
3. stale branch 직접 merge 금지
4. `main`에 없는 유효 변경만 추출
5. 활성 branch와 handoff 상태를 GitHub Issue 또는 `.moai/state/session-memo.md`에 기록

현재 로컬 기준:

| 항목 | 값 |
|---|---|
| active branch | `main` |
| `HEAD` / `origin/main` | `8b06349` |
| dirty files | deploy review follow-up files before commit |

---

## 1. RC 즉시 실행 순서

아래 순서만 v1.0.0-rc 직전 실행 큐다. #22~#25 및 #35~#92는 RC 이후 backlog로 분리한다.

| 순서 | 이슈/PR | 상태 | 작업 판단 |
|---|---|---|---|
| 1 | #32 RELEASE-GATE-001 | CLOSED / COMPLETED | 완료. PR/CI/branch 정합성 gate 반영 |
| 2 | #33 RELEASE-HARDENING-001 / PR #102 | MERGED | 완료. Dashboard, Knowledge, logger, Citation E2E 일부 반영 |
| 3 | #34 QUALITY-001 / PR #103 | MERGED | 완료. Corpus, Eval, Vectorize, DocIngest, Security/RBAC 반영 |
| 4 | #97 SPEC E2EFIX + #104 Impl / PR #106 | MERGED | 완료. E2E 7-spec 활성화 및 `global-setup` 반영 |
| 5 | #105 DEPLOY-001 | COMPLETED / REVIEW FOLLOW-UP | `.github/workflows/deploy.yml` 후속 리뷰 수정 반영 |
| 6 | #26 build reproducibility | OPEN | #31 전 release blocker. build timeout/프로세스 정리 증거 필요 |
| 7 | #30 PR/CI closure integrity | OPEN | #31 전 release blocker. PR #20/#21/#12/#13/#14 정합성 최종 댓글 필요 |
| 8 | #31 RELEASE-001 | OPEN | #105/#26/#30 완료 후 최종 release umbrella gate |
| 9 | `v1.0.0-rc` tag | 미생성 | #31 PASS 후 release notes 작성 및 prerelease tag |

주의:

- #102, #103, #106은 PR 번호다. GitHub Issue 목록에는 나타나지 않는다.
- #104는 구현 추적 이슈이고 PR #106의 closing reference는 #97이다. #104에는 완료 댓글이 남아 있다.
- #98/#99/#100은 과거 canonical SPEC 이슈였지만 현재 `NOT_PLANNED`로 폐기되어 실행 대상이 아니다.
- #101은 폐기된 병렬 worktree tracker다.

---

## 2. RC 실행 절차

### Step 5 - #105 DEPLOY-001

목적: `deploy.yml` 신설. Vercel preview-per-PR, Cloudflare staging, production manual gate, post-deploy smoke를 분리한다.

기준:

- Issue: #105
- SPEC: `.moai/specs/SPEC-REGULA-DEPLOY-001/spec.md`
- Branch: `main`
- Primary file: `.github/workflows/deploy.yml`

후속 리뷰 수정:

- Cloudflare staging deploy 전에 Wrangler CLI를 설치한다.
- `vercel-preview` job output의 preview URL을 post-deploy smoke에 전달한다.
- `scripts/post-deploy-smoke.sh`는 파싱 가능해야 하며, `BASE_URL` 없이는 localhost로 fallback하지 않는다.

완료 기준:

- `deploy.yml` syntax/dry-run PASS
- PR 환경 `production-vercel` / `production-cloudflare` 분리
- preview, staging, production manual gate 경로 명시
- post-deploy smoke gate 명시
- PR 본문에 `QA evidence` 기록

### Step 6 - #26 Build Reproducibility

목적: release build 검증이 장시간 무출력으로 멈추는 문제를 재현 가능하게 통제한다.

완료 기준:

- CI 환경과 동일한 env placeholder로 `pnpm ci:build` 통과 또는 bounded failure 근거 확보
- timeout/프로세스 정리 기준 문서화
- orphan Node/Next/esbuild 점검 절차 문서화
- 결과를 #26 댓글과 #31 release evidence에 연결

### Step 7 - #30 PR/CI Closure Integrity

목적: 과거 release blocker 상태였던 PR #20/#21 및 이슈 #12/#13/#14 정합성을 최신 상태로 닫을 수 있는지 확인한다.

현재 확인:

- PR #20: MERGED
- PR #21: MERGED
- #12/#13/#14: CLOSED
- 과거 PR #21 LLM Eval 실패 흔적은 #34/PR #103 이후 상태로 재판단 필요

완료 기준:

- `gh pr view 20`, `gh pr view 21`, `gh issue view 12/13/14` 증거 댓글
- release blocker 잔여 여부 판단
- 필요 시 #30 close 또는 #31로 evidence 이관

### Step 8 - #31 RELEASE-001

목적: RC 선언 전 최종 우산 gate.

완료 기준:

- #105/#26/#30 완료 또는 명시적 waiver
- Sentry ErrorBoundary, Langfuse trace, 4-way observability E2E 판단
- #73 QA Matrix와 release checklist PASS/WAIVED 상태 일치
- release notes 준비

---

## 3. #22 이후 이슈 전수 감사 결과

### 3.1 RC in-scope / release blockers

| 이슈 | 상태 | 처리 |
|---|---|---|
| #26 | OPEN | #31 전 처리 필요 |
| #27 | CLOSED / COMPLETED | 완료 |
| #28 | CLOSED / COMPLETED | 완료 |
| #29 | CLOSED / COMPLETED | 완료 |
| #30 | OPEN | #31 전 처리 필요 |
| #31 | OPEN | 최종 release umbrella |
| #32 | CLOSED / COMPLETED | 완료 |
| #33 | CLOSED / COMPLETED | PR #102 완료 |
| #34 | CLOSED / COMPLETED | PR #103 완료 |
| #97 | CLOSED / COMPLETED | PR #106 closing reference |
| #104 | CLOSED / COMPLETED | E2EFIX 구현 추적 완료 |
| #105 | OPEN | 다음 구현 작업 |

### 3.2 Post-RC Wave 3 backlog

Wave 3는 RC 태그 이후 착수한다. 시작점은 #22다.

| 이슈 | SPEC | 상태 |
|---|---|---|
| #22 | PREDICATE-001 | OPEN |
| #23 | CER-001 | OPEN |
| #24 | PCCP-001 | OPEN |
| #35 | KNOWLEDGE-GAP-001 | OPEN |
| #36 | REVIEW-OPS-001 | OPEN |
| #37 | SUBMISSION-LIFECYCLE-001 | OPEN |
| #38 | ADOPTION-001 | OPEN |
| #39 | WORKFLOWS-LLM-002 | OPEN |
| #40 | STRATEGY-001 | OPEN |
| #41 | IMPACT-001 | OPEN |
| #42 | CROSSMARKET-001 | OPEN |
| #43 | BATCH-001 | OPEN |
| #47 | TRACEABILITY-001 | OPEN |
| #48 | SOURCE-GOVERNANCE-001 | OPEN |
| #50 | KNOWLEDGE-PROMO-001 | OPEN |
| #51 | PROJECT-MEMORY-001 | OPEN |
| #52 | NOTIFICATIONS-001 | OPEN |
| #55 | ROI-001 | OPEN |
| #58 | DIGEST-001 | OPEN |
| #59 | CLASSIFY-001 | OPEN |
| #60 | CLINICAL-LIT-001 | OPEN |
| #61 | VIGILANCE-001 | OPEN |
| #62 | STANDARDS-001 | OPEN |

### 3.3 Post-RC Wave 4 backlog

| 이슈 | SPEC | 상태 |
|---|---|---|
| #25 | COEDIT-001 | OPEN |
| #44 | CALENDAR-001 | OPEN |
| #45 | DELTA-SYNC-001 | OPEN |
| #46 | RISK-001 | OPEN |
| #49 | VALIDATION-001 | OPEN |
| #53 | PMS-001 | OPEN |
| #54 | CHANGE-CONTROL-001 | OPEN |
| #56 | RLHF-001 | OPEN |
| #57 | QMS-INTEGRATION-001 | OPEN |
| #63 | SAMD-001 | OPEN |
| #64 | DHF-001 | OPEN |
| #65 | ESUBMIT-001 | OPEN |

### 3.4 Post-RC Wave 5 backlog

| 이슈 | SPEC | 상태 |
|---|---|---|
| #66 | LABELING-001 | OPEN |
| #67 | CYBERDEVICE-001 | OPEN |
| #68 | CAPA-001 | OPEN |
| #69 | CLINICAL-INVESTIGATION-001 | OPEN |
| #70 | REIMBURSEMENT-001 | OPEN |
| #71 | MODEL-GOVERNANCE-001 | OPEN |
| #72 | CORPUS-LICENSE-001 | OPEN |
| #84 | ANSWER-REFINE-001 | OPEN |
| #85 | CONFIDENCE-EXPLAIN-001 | OPEN |
| #86 | PERSONAL-LIB-001 | OPEN |
| #87 | EXPORT-HUB-001 | OPEN |
| #88 | ESIG-001 | OPEN |
| #89 | DSAR-001 | OPEN |
| #90 | DATA-RESIDENCY-001 | OPEN |
| #91 | DLP-001 | OPEN |
| #92 | AUDITOR-VIEW-001 | OPEN |

### 3.5 QA / E2E cross-cutting lane

이슈별 구현과 별도 lane으로 유지하되, 모든 구현 이슈의 Gate로 적용한다.

| 이슈 | 역할 | 상태 |
|---|---|---|
| #73 | QA Matrix | OPEN |
| #74 | Gate 0 SPEC readiness | OPEN |
| #75 | Gate 1 implementation checkpoint | OPEN |
| #76 | Gate 2 PR acceptance | OPEN |
| #77 | Gate 3 wave integration | OPEN |
| #78 | Gate 4 domain UAT | OPEN |
| #79 | Gate 5 operations QA | OPEN |
| #80 | Local E2E infra | OPEN |
| #81 | Wave 1 E2E gate | OPEN |
| #82 | Wave 2 E2E gate | OPEN |
| #83 | CI E2E gate | OPEN |

### 3.6 폐기 / 중복 / 비실행 대상

| 이슈 | 상태 | 판단 |
|---|---|---|
| #93 | CLOSED / NOT_PLANNED | #97로 superseded |
| #94 | CLOSED / NOT_PLANNED | #98/#105로 superseded |
| #95 | CLOSED / NOT_PLANNED | #99/#32/#34로 superseded |
| #96 | CLOSED / NOT_PLANNED | #100/#31로 superseded |
| #98 | CLOSED / NOT_PLANNED | SPEC-only 폐기. 실행은 #105 |
| #99 | CLOSED / NOT_PLANNED | #32/#34에 흡수 |
| #100 | CLOSED / NOT_PLANNED | #31로 흡수 |
| #101 | CLOSED / NOT_PLANNED | 병렬 worktree tracker 폐기 |

### 3.7 영구 오픈 정책 이슈

| 이슈 | 역할 | 처리 |
|---|---|---|
| #1 | 4-Layer Memory / Wiki ADR | 계속 OPEN |
| #18 | Work Gate / duplicate-work prevention | 계속 OPEN |

---

## 4. 운영 규칙

- RC 작업자는 #105 -> #26 -> #30 -> #31 순서로만 착수한다.
- Wave 3+ 작업자는 RC 태그 전에는 착수하지 않는다.
- Wave 3+ 시작 시 첫 구현 후보는 #22다.
- #73~#83은 구현 대상이 아니라 QA/E2E gate다. 각 구현 이슈의 PR 본문에 QA evidence로 연결한다.
- #93~#101은 실행 큐에서 제외한다.
- 새 이슈가 생성되면 이 runbook의 해당 lane에 즉시 추가한다.

---

## 5. 명령 Cheatsheet

```bash
# 항상 먼저:
git fetch --prune origin
git status --short --branch
gh issue view 18

# 현재 다음 작업:
git checkout main
git pull origin main
git checkout -b work/deploy-001
claude  # /moai run SPEC-REGULA-DEPLOY-001

# #105 완료 후:
gh issue view 26
gh issue view 30
gh issue view 31
```

---

## 6. 감사 기록

2026-05-06 감사에서 확인한 문제:

- 기존 runbook v6은 #104가 이미 MERGED된 뒤에도 일부 cheatsheet가 `PR #106 OPEN`으로 남아 있었다.
- README는 #32/#33/#34를 미착수로 표시하고 있었다.
- #22 이후 이슈가 최신 업데이트순 조회 제한에 밀려 누락될 수 있었다.
- #105는 #22~#92 QA 본문 일괄 삽입 이후 생성되어 QA 단계 보강이 필요했다.
- #31/#73 댓글은 #104/#105 최신 상태를 반영해야 했다.

조치:

- runbook을 v7.0으로 승격하고 #22 이후 이슈를 lane별로 전수 재정렬했다.
- README/session memo를 최신 상태로 맞춘다.
- #18/#31/#73/#105에 감사 결과와 다음 작업 기준을 댓글로 남긴다.
