---
id: SPEC-REGULA-RELEASE-001
artifact: plan
title: "Plan — First Release Readiness 우산 실행 계획"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
phase: release-orchestration
priority: Critical
related_spec: .moai/specs/SPEC-REGULA-RELEASE-001/spec.md
related_specs:
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
---

# Plan — SPEC-REGULA-RELEASE-001 First Release Readiness 우산 실행 계획

본 plan은 우산 SPEC이 **자식 SPEC 3종(GATE-001 / HARDENING-001 / QUALITY-001)을 어떤 순서로 묶어 1차 릴리즈 RC를 선언하는가**를 정의한다. 본 SPEC 자체는 코드 변경 0건이며, 자식 SPEC 완료 후 RC tagging과 release notes 생성만을 담당한다.

---

## 1. 구현 전략 개요

본 SPEC family는 **선후 의존성**이 명확하다.

```
SPEC-REGULA-RELEASE-GATE-001  (P0, Critical, Issue #32)
        │
        │ (P0 완료 후 진입)
        ▼
SPEC-REGULA-RELEASE-HARDENING-001  (P1, High, Issue #33)
        │
        │ (P1 완료 후 진입)
        ▼
SPEC-REGULA-QUALITY-001  (P2, High, Issue #34)
        │
        │ (P2 완료 후 진입)
        ▼
SPEC-REGULA-RELEASE-001  (Umbrella, Critical, Issue #31)
        │
        ▼
v1.0.0 RC tag + Release notes
```

자식 SPEC 내부의 그룹 간 병렬 진행은 각 SPEC의 plan.md를 참조한다. 본 plan은 SPEC 단위 마일스톤만 정의한다.

---

## 2. 마일스톤 (우선순위 기반, 시간 추정 없음)

### Milestone M1 — RELEASE-GATE-001 완료 (Priority: Critical)

**범위**: PR #20/#21 정합성, Issue #12/#13 closure, Branch/Worktree governance, Session memo commit. (자식 SPEC GATE-001 의 20개 EARS REQ 전부)

**진입 조건**:
- 본 plan-auditor 보강 작업이 완료되어 4개 SPEC frontmatter가 통일됨
- `.moai/specs/_shared/qa-gate-roadmap.md` 작성 완료

**완료 기준 (Closing Criteria)**:
- [ ] `gh pr checks 21` 결과 모든 체크 green
- [ ] `gh pr checks 20` 결과 모든 체크 green (chromium, firefox, webkit 포함)
- [ ] `gh issue view 12 --json state -q .state` → `CLOSED`, closure note에 commit `9b7adda` 명시
- [ ] `gh issue view 13 --json state -q .state` → `CLOSED`, closure note에 commit `11bd6fa` 명시
- [ ] `gh issue view 18 --json state -q .state` → `OPEN` (의도적 유지)
- [ ] `git branch --list 'feature/SPEC-REGULA-NETWORK-001'` 결과 empty
- [ ] `git status` → main 브랜치에서 clean working tree
- [ ] `.moai/state/session-memo.md` main에 commit, 본 SPEC 완료 상태 명시
- [ ] GATE-001 acceptance.md checklist 4.1~4.5 5/5 PASS

**Exit Artifact**: GATE-001 traceability-matrix.md의 모든 row가 status=`verified`

**Issue Closure**: #12, #13, #28, #30 (GATE-001 frontmatter `closes_issues` 정의)

---

### Milestone M2 — RELEASE-HARDENING-001 완료 (Priority: High)

**범위**: 6개 그룹 결함 해소 (Dashboard / Knowledge / Console / TODO / E2E / Workflow Beta). (자식 SPEC HARDENING-001 의 28개 EARS REQ 전부)

**진입 조건**:
- M1 (GATE-001) 완료
- main 브랜치 clean state

**완료 기준 (Closing Criteria)**:
- [ ] Group A: `GET /api/ra/dashboard` 응답이 `stats: { totalConversations: number, expertReviews: number, pendingReviews: number, totalProjects: number }` 만족
- [ ] Group B: `GET /api/ra/sources` list endpoint 동적 결과 반환, `/knowledge` 페이지 hardcoded `sourceGroups` 제거 확인
- [ ] Group C: `git grep -rnE "console\.(log|warn|error|debug)" app/ lib/ workers/ --include="*.ts"` 결과 0건 또는 모두 `@MX:NOTE: console-allowed` 주석 동반
- [ ] Group D: `git grep -rnE "TODO|FIXME|placeholder" app/ lib/ workers/ --include="*.ts"` 결과 0건 또는 모두 `@MX:TODO` + `@MX:SPEC` 동반
- [ ] Group D 특이사항: `lib/ai/hybrid-router.ts:142`은 본 SPEC이 수정하지 않음. QUALITY-001 REQ-QUAL-011~014로 ownership 이관됨 (REQ-HARDEN-020 명시)
- [ ] Group E: `tests/e2e/citation-click.spec.ts`의 `test.skip(true, ...)` 제거 확인, CI에서 chromium·firefox 통과
- [ ] Group F: `/workflows`, `/workflows/*` 페이지에 Beta 배지 + non-dismissable 디스클로저 배너 노출, executor mock 응답에 `_mock: true`, audit log `metadata.mock_data: true`
- [ ] HARDENING-001 acceptance.md DoD 100% 통과

**Exit Artifact**: HARDENING-001 traceability-matrix.md의 모든 row가 status=`verified`

**Issue Closure**: #27, #29 (HARDENING-001 frontmatter `closes_issues` 정의 시 추가)

---

### Milestone M3 — QUALITY-001 완료 (Priority: High)

**범위**: 6개 그룹 품질 향상 (Corpus seed / Eval pipeline / Cloudflare fallback / DocIngest E2E / Security headers / Admin RBAC). (자식 SPEC QUALITY-001 의 25개 EARS REQ 전부)

**진입 조건**:
- M2 (HARDENING-001) 완료
- 5개 코퍼스(FDA/EU-MDR/MFDS/NMPA/PMDA) 시드 데이터 라이선스 검토 완료

**완료 기준 (Closing Criteria)**:
- [ ] Group A: `pnpm db:seed:corpus` 결정적으로 ≥ 100 행 적재, 5 코퍼스 × 20+ 청크
- [ ] Group A: `SELECT COUNT(*) FROM source_sections WHERE embedding IS NOT NULL` = total
- [ ] Group B: `pnpm eval:ci` exit code 0, ≥ 80% 통과율 (55 시나리오 / 6 datasets)
- [ ] Group B: 30분 timeout 내 완주, 결과 baseline.json commit
- [ ] Group C: `lib/ai/hybrid-router.ts` Vectorize TODO 0건, pgvector fallback 명시화
- [ ] Group C: `tests/integration/hybrid-router-fallback.test.ts` 통과
- [ ] Group D: 관리자 문서 업로드 E2E (`tests/e2e/admin-document-upload.spec.ts`) 통과
- [ ] Group D: non-admin 접근 시 HTTP 403 + audit log entry
- [ ] Group E: `pnpm test:e2e --grep @security-headers` chromium 통과 (CSP nonce, X-Frame-Options DENY, HSTS, X-Content-Type-Options 모두 검증)
- [ ] Group F: `pnpm ci:rbac` exit code 0, admin 문서 라우트 4종 (`/admin/documents`, `/admin/documents/upload`, `/admin/documents/[id]`, `/admin/radar`) 포함
- [ ] QUALITY-001 acceptance.md DoD 100% 통과

**Exit Artifact**: QUALITY-001 traceability-matrix.md의 모든 row가 status=`verified`

**Issue Closure**: 본 SPEC이 직접 close 하는 이슈 없음 (QUALITY-001 frontmatter는 verifies_specs 위주)

---

### Milestone M4 — RELEASE-001 RC Declaration (Priority: Critical)

**범위**: 자식 SPEC 3종 통합 검증 + Release notes 생성 + v1.0.0-rc tag 부여.

**진입 조건**:
- M1, M2, M3 모두 완료
- 모든 자식 SPEC traceability-matrix.md row가 `verified`

**완료 기준 (Closing Criteria)**:
- [ ] REQ-REL-001 ~ REQ-REL-060 모두 acceptance.md scenario PASS
- [ ] `git status --short --branch` 결과 main 브랜치에서 clean (intentionally ignored/generated 파일 제외)
- [ ] Release notes 작성 완료 (`docs/releases/v1.0.0-rc.md` 또는 동등 위치)
  - 포함된 scope (자식 SPEC 3종 + Foundation/Chat/Structured/Breadth/Enterprise/Launch/Cloudflare/DocIngest/Workflows/Radar/Tenant)
  - 제외된 scope (post-v0.1 / Wave 3-5 backlog / QA Program)
  - Known limitations (Workflow Beta mock 명시, Vectorize fallback 등)
  - Verification evidence (CI run links, audit log dump, eval baseline)
  - Rollback path (이전 stable commit, DB migration revert 절차)
- [ ] `git tag v1.0.0-rc` 부여 후 push
- [ ] Issue #31 (RELEASE-001 SPEC tracking issue) closure with RC tag reference

**Issue Closure**: 본 SPEC family 종결 시 #26 (build 검증), #31 (RELEASE-001 tracking) close

---

## 3. 기술 접근 (High-level)

### 3.1 우산 SPEC의 책임 경계

본 SPEC은 **자식 SPEC을 직접 구현하지 않는다**. 다음만 수행:

1. **선후 순서 강제**: M1 미완 시 M2 진입 차단 (CI / hook으로 강제 가능하면 권장)
2. **Acceptance 통합 검증**: 자식 SPEC의 DoD를 본 SPEC acceptance.md scenario로 다시 검증
3. **Release notes 생성**: 자식 SPEC 3종의 변경사항 요약 + 1차 릴리즈 scope 정리
4. **RC tagging**: `v1.0.0-rc` semver tag 부여
5. **Issue 정합성**: 자식 SPEC들이 닫지 못한 우산 레벨 issue (#26, #31) closure

### 3.2 자식 SPEC와의 상호작용

자식 SPEC RUN 단계에서 본 SPEC plan은 다음을 제공:
- §2 마일스톤의 **Closing Criteria 체크리스트** — 각 자식 SPEC RUN 종료 시점에 본 plan을 참조해 자체 검증
- **Cross-SPEC ownership 표** (research.md §2.4) — 중복 작업 방지

### 3.3 Release Notes 템플릿 (M4 산출물)

Release notes는 다음 8 섹션을 의무 포함:

1. **Release Summary** — RC 버전, 릴리즈 일자, 누적 자식 SPEC 3종 ID
2. **In-Scope Features** — Phase 1~11 + Tenant-Lite 명시
3. **Out-of-Scope (Deferred)** — Wave 3~5 backlog, QA Program 운영 트랙
4. **Quality Evidence** — CI run links, eval baseline, security scan results
5. **Audit & Compliance** — 21 CFR Part 11 append-only audit 검증 결과
6. **Known Limitations** — Workflow Beta mock, Vectorize fallback 등
7. **Migration / Rollback** — DB migration 목록, rollback 절차
8. **Verification Commands** — 사용자가 RC를 직접 검증할 수 있는 gh / git / pnpm 명령어 모음

---

## 4. 영향 받는 파일 (예상)

본 SPEC은 코드 수정 0건이며, 다음 메타 파일만 수정:

- `.moai/specs/SPEC-REGULA-RELEASE-001/spec.md` (frontmatter 표준화 — Task A)
- `.moai/specs/SPEC-REGULA-RELEASE-001/research.md` (생성 — Task A)
- `.moai/specs/SPEC-REGULA-RELEASE-001/plan.md` (본 파일 — Task A)
- `.moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md` (생성 — Task A)
- `.moai/specs/SPEC-REGULA-RELEASE-001/traceability-matrix.md` (생성 — Task E)
- `.moai/specs/SPEC-REGULA-RELEASE-001/audit-remediation-report.md` (생성 — 본 plan-auditor 종료 시점)
- 자식 SPEC frontmatter 표준화 (Task E)
- `docs/releases/v1.0.0-rc.md` (M4 산출물)
- `CHANGELOG.md` (M4 산출물)
- `git tag v1.0.0-rc` (M4 산출물)

---

## 5. 위험 요소 및 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| 자식 SPEC 사이 작업 머지 충돌 (HARDENING-001 ↔ QUALITY-001 모두 `lib/ai/`를 건드림) | Medium | research.md §2.4 ownership 표로 명확히 분리. HARDENING-001 REQ-HARDEN-020은 hybrid-router.ts를 수정하지 않음 명시 |
| 자식 SPEC 미완 상태에서 RC 선언 압박 | High | 본 plan §2 Closing Criteria가 hard gate. 자동화된 acceptance check 통과 전 tag 부여 금지 |
| Release notes 작성 시 자식 SPEC 변경사항 누락 | Medium | 각 자식 SPEC traceability-matrix.md를 source-of-truth로 사용 |
| `v1.0.0-rc` tag 이후 추가 결함 발견 | Medium | post-RC patch는 별도 SPEC으로 발행 (예: `SPEC-REGULA-RELEASE-002`), 본 SPEC scope 보존 |
| QA Gate 0~5 정의 변경 시 4개 SPEC 동기화 누락 | Low | `.moai/specs/_shared/qa-gate-roadmap.md` SSoT 강제 — 4개 SPEC 모두 본 파일 참조 |

---

## 6. 진행 순서 (Wave-based)

1. **Wave 0 (현재)** — Plan-auditor 보강 (Tasks A~E): 4개 SPEC 4-doc 셋 정합성 회복
2. **Wave 1** — M1 (GATE-001) 단일 트랙
3. **Wave 2** — M2 (HARDENING-001) 그룹별 병렬 (자식 SPEC plan.md §6 참조)
4. **Wave 3** — M3 (QUALITY-001) 그룹별 병렬 (자식 SPEC plan.md §2 참조)
5. **Wave 4** — M4 (RC Declaration) 단일 트랙

각 Wave 종료 시점에 본 plan §2 Closing Criteria 자가 검증 필수.

---

## 7. RUN Phase 권장 에이전트

본 SPEC은 RUN 단계에서 **새로운 코드 수정을 요구하지 않는다**. 다만 M4 RC declaration 시점에 다음 에이전트 호출:

- `manager-docs` — Release notes 생성 (`docs/releases/v1.0.0-rc.md`)
- `manager-git` — `v1.0.0-rc` tag 부여 및 push
- `manager-quality` — TRUST 5 통합 검증 (자식 SPEC 3종 결과 합산)
- `evaluator-active` — 1차 릴리즈 readiness 독립 평가 (4-dimension scoring)

---

## 8. References

- 자식 SPEC plan.md:
  - `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/plan.md` (작성 시)
  - `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/plan.md`
  - `.moai/specs/SPEC-REGULA-QUALITY-001/plan.md`
- 공통 SSoT: `.moai/specs/_shared/qa-gate-roadmap.md`
- 본 SPEC research: `.moai/specs/SPEC-REGULA-RELEASE-001/research.md`
- 본 SPEC acceptance: `.moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md`
