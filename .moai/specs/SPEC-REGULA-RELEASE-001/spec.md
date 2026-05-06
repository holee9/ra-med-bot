---
id: SPEC-REGULA-RELEASE-001
title: "Regula First Release Readiness — 우산 SPEC"
status: completed
phase: "release-orchestration"
priority: Critical
version: 0.2.0
created: 2026-05-04
updated: 2026-05-06
author: release-orchestrator
issue_number: 31
depends_on:
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
related_specs:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-STRUCTURED-001
  - SPEC-REGULA-BREADTH-001
  - SPEC-REGULA-ENTERPRISE-001
  - SPEC-REGULA-LAUNCH-001
  - SPEC-REGULA-CLOUDFLARE-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-RADAR-001
  - SPEC-REGULA-NETWORK-001
  - SPEC-REGULA-TENANT-001
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
related_issues:
  - "#12"
  - "#13"
  - "#18"
  - "#26"
  - "#27"
  - "#28"
  - "#29"
  - "#30"
  - "#31"
  - "#32"
  - "#33"
  - "#34"
related_prs:
  - "#20"
  - "#21"
labels:
  - release
  - umbrella
  - critical
revision_history:
  - version: 0.2.0
    date: 2026-05-05
    author: manager-spec (plan-auditor remediation)
    notes: "Plan-auditor 보강 — frontmatter 표준화(spec_id→id, priority/depends_on/issue_number 추가), §2.1 60개 OPEN 이슈 5분류 분류표 추가, REQ-REL-001~060 EARS 라벨 부착, REQ-REL-002 #18 처리 명료화, traceability-matrix 별도 파일화. research/plan/acceptance 4-doc 셋 보강 완료."
  - version: 0.1.0
    date: 2026-05-04
    author: release-orchestrator
    notes: "초기 초안. 1차 릴리즈 차단 근거 식별, REQ-REL Group A~G 정의."
---

# SPEC-REGULA-RELEASE-001 — First Release Readiness (우산 SPEC)

## HISTORY

| Version | Date       | Author                                | Change                                                                                                                                                                                                                                          |
| ------- | ---------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.2.0   | 2026-05-05 | manager-spec (plan-auditor remediation) | frontmatter 표준화 / §2.1 60개 이슈 5분류 / EARS 라벨 / REQ-REL-002 #18 처리 명료화 / 4-doc 셋 보강 / `_shared/qa-gate-roadmap.md` SSoT 도입                                                                                                                                                        |
| 0.1.0   | 2026-05-04 | release-orchestrator                  | 초기 초안                                                                                                                                                                                                                                                                                                                                                |

---

## 1. 판단

현재 구현은 MVP 초기 검토 수준을 넘어선 내부 검증 beta 수준이다. 다만 1차 릴리즈 후보(RC) 수준은 아니다.

릴리즈 차단 근거 (자세한 검증은 `research.md` §1):

- PR #20: CI 일부 통과, Playwright E2E 3개 브라우저 PENDING
- PR #21: CI Gates 실패 (4 file lint/format)
- Issue #12, #13 OPEN (구현 완료, closure 누락)
- 로컬 worktree clean 미보장: `.moai/state/session-memo.md` modified, `.worktrees/` untracked
- production 경로에 TODO/placeholder/deferred integration 흔적 (HARDENING-001 Group D 대상)
- runtime 경로에 직접 `console.*` 출력 (HARDENING-001 Group C 대상)
- `pnpm ci:build` 로컬 검증 장시간 정지로 bounded proof 부재 (Issue #26)
- RAG 코퍼스 시드 부재 — `source_sections` 빈 상태 (QUALITY-001 Group A 대상)

본 SPEC은 **우산 SPEC**으로, 다음 3개 자식 SPEC을 통합 관리한다:

1. SPEC-REGULA-RELEASE-GATE-001 (P0, Critical, Issue #32) — PR/CI/Branch 정합성
2. SPEC-REGULA-RELEASE-HARDENING-001 (P1, High, Issue #33) — 사용자 가시 결함
3. SPEC-REGULA-QUALITY-001 (P2, High, Issue #34) — RAG 정확성·평가 신뢰성

본 SPEC 자체는 코드 변경 0건이며, 자식 SPEC 완료 후 RC tagging과 release notes 생성만을 책임진다.

---

## 2. 1차 릴리즈 범위

1차 릴리즈는 이미 구현되었거나 완료 직전인 내부 RA 운영체계 범위로 고정한다.

### In scope (1차 릴리즈 필수)

- Foundation, Chat, Structured Outputs, Breadth
- Enterprise hardening: RBAC, expert review, i18n, dark mode, observability, CI gates
- Launch quality: eval harness, E2E, load, security docs, runbook, preflight
- Cloudflare hybrid readiness (현재 구현된 범위 한정 — Vectorize는 fallback 명시화)
- DocIngest
- Workflows (Beta 표기, mock 응답 명시)
- Radar 3-crawler scope
- External Public Data Enrichment
- Tenant-Lite department RBAC
- Release hardening (Issues #26~#30)
- Quality elevation (Corpus seed / Eval / Cloudflare fallback / DocIngest E2E / Security headers / RBAC audit)

### Out of scope for 1차 릴리즈

- 전체 분류는 §2.1 참조

---

### 2.1 전체 OPEN 이슈 5분류표 (type/spec 우선순위, 2026-05-05 기준)

다음 표는 `gh issue list --state open --label "type/spec" --limit 100` 결과(60개)와 추가 type/bug, type/adr 핵심 이슈를 5개 카테고리로 분류한 것이다. 본 표는 §2 In/Out scope의 detailed source-of-truth이다.

카테고리 정의:
- **in-scope**: 1차 릴리즈에 포함 (자식 SPEC 3종 또는 직접 처리)
- **post-v0.1**: 1차 직후 v0.2 활성화
- **Wave3-backlog**: Wave 3 (#41~#43, #50~#52, #58~#62 등) 1차 직후 별도 트랙
- **Wave5-backlog**: Wave 5 (#84~#92) 1차 직후 별도 트랙
- **QA-program**: QA Program 운영 트랙 (#73~#79, separate program)

#### 2.1.1 in-scope (1차 릴리즈 직접 포함)

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #12 | [Phase 10] Regulatory Radar (구현 완료, closure 미완) | Phase 10 | in-scope | GATE-001 (REQ-GATE-009) |
| #13 | [Phase 11] External Public Data Enrichment (구현 완료, closure 미완) | Phase 11 | in-scope | GATE-001 (REQ-GATE-010) |
| #26 | [Release Hardening] build 검증 장시간 정지 방지 및 재현 절차 확립 | Release | in-scope | RELEASE-001 (REQ-REL-020) |
| #27 | [Release Hardening] production 경로 TODO/placeholder 정리 | Release | in-scope | HARDENING-001 (Group D) |
| #28 | [Release Governance] 릴리즈 전 branch/worktree/handoff 정합성 정리 | Release | in-scope | GATE-001 (Group D, E) |
| #29 | [Release Hardening] runtime console 로그 정책 및 관측성 정리 | Release | in-scope | HARDENING-001 (Group C) |
| #30 | [Release Blocker] PR #20/#21 CI 및 이슈 종료 정합성 정리 | Release | in-scope | GATE-001 (Group A, B) |
| #31 | [Release Spec] 1차 릴리즈 완성도 고도화 및 품질 게이트 SPEC-REGULA-RELEASE-001 | Release | in-scope | 본 SPEC umbrella |
| #32 | [Release Gate] PR/CI/Branch 정합성 확보 (SPEC-REGULA-RELEASE-GATE-001) | Release | in-scope | GATE-001 본 SPEC |
| #33 | [Release Hardening] Dashboard·Knowledge·Console·TODO·E2E·Workflow Beta (SPEC-REGULA-RELEASE-HARDENING-001) | Release | in-scope | HARDENING-001 본 SPEC |
| #34 | [Quality Elevation] Corpus Seed · Eval Pipeline · Cloudflare · DocIngest · Security (SPEC-REGULA-QUALITY-001) | Release | in-scope | QUALITY-001 본 SPEC |

#### 2.1.2 post-v0.1 (1차 직후 v0.2)

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #18 | [Post-mortem] feature/SPEC-REGULA-BREADTH-001 브랜치 이중 구현 | post-mortem | post-v0.1 | ADR 별도 작성 (의도적 OPEN) |
| #35 | [Knowledge Gap Ops] 미답변 자동 이슈화 및 지식베이스 보강 루프 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #36 | [Review Ops] 전문가 검토 SLA·승인 워크벤치·증거 패키지 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #37 | [Submission Lifecycle] 510(k)·CER·PCCP 산출물 패키징·검증·추적 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #38 | [Adoption Analytics] 사용자 온보딩·성과 KPI·피드백 루프 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #47 | [Evidence Traceability] 규제 근거·위험·요구사항·초안·검토·제출 추적 매트릭스 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #48 | [Source Governance] 규제·SOP 출처 권위도·버전·유효일·폐기 상태 관리 | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #49 | [System Validation] Regula 자체 검증 패키지 — IQ/OQ/PQ | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #71 | [System Validation] LLM·프롬프트·템플릿 변경통제 (SPEC-REGULA-MODEL-GOVERNANCE-001) | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #72 | [Source Governance] 코퍼스 라이선스·사용권 관리 (SPEC-REGULA-CORPUS-LICENSE-001) | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #80 | [E2E] 로컬 E2E 실행 환경 구축 (Docker Compose + pgvector + .env.test) | post-v0.1 | post-v0.1 | 1차 RC 후 |
| #81 | [E2E Gate] Wave 1 완료 검증 — Foundation+Chat E2E 스모크 게이트 | post-v0.1 | post-v0.1 | #80 완료 후 |
| #82 | [E2E Gate] Wave 2 완료 검증 — RAG Pipeline + Expert Review + Enterprise E2E | post-v0.1 | post-v0.1 | #80 완료 후 |
| #83 | [E2E] CI 파이프라인 E2E 통합 — PR 병합 전 Playwright 자동 실행 게이트 | post-v0.1 | post-v0.1 | #80 완료 후 |

#### 2.1.3 Wave3-backlog (Wave 3 / Wave 3+ / Wave 3 부속)

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #22 | [Wave 3] FDA 510(k) Predicate 검색 엔진 (SPEC-REGULA-PREDICATE-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #23 | [Wave 3] EU MDR 임상평가보고서 빌더 (SPEC-REGULA-CER-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #24 | [Wave 3] FDA PCCP 구조화 작성기 (SPEC-REGULA-PCCP-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #39 | [Wave 3 기술부채] SPEC-REGULA-WORKFLOWS-LLM-002 — 워크플로우 LLM 실제 구현 | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #40 | [Wave 3+] SPEC-REGULA-STRATEGY-001 — 멀티 관할권 규제 전략 생성기 | Wave 3+ | Wave3-backlog | 1차 RC 후 |
| #41 | [Wave 3 부속] SPEC-REGULA-IMPACT-001 — 규제 변경 영향 추적기 | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #42 | [Wave 3] SPEC-REGULA-CROSSMARKET-001 — 멀티 관할권 갭 분석기 | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #43 | [Wave 3] SPEC-REGULA-BATCH-001 — 배치 질의 모드 | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #50 | [Wave 3] 대화 시맨틱 검색 & 우수 답변 팀 지식 승격 (SPEC-REGULA-KNOWLEDGE-PROMO-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #51 | [Wave 3] 프로젝트 지속 컨텍스트 메모리 (SPEC-REGULA-PROJECT-MEMORY-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #52 | [Wave 3] 알림 허브 — 이메일·Slack·Teams 웹훅 통합 (SPEC-REGULA-NOTIFICATIONS-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #55 | [Wave 3] 비즈니스 가치 대시보드 — RA 업무 효율화 ROI 정량화 (SPEC-REGULA-ROI-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #58 | [Wave 3] 규제 인텔리전스 주간 다이제스트 (SPEC-REGULA-DIGEST-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #59 | [Wave 3] 의료기기 분류 자동화 마법사 (SPEC-REGULA-CLASSIFY-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #60 | [Wave 3] 임상 문헌 검색 & 근거 합성기 (SPEC-REGULA-CLINICAL-LIT-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #61 | [Wave 3] 유해사례 보고서 자동 초안기 (SPEC-REGULA-VIGILANCE-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |
| #62 | [Wave 3] 조화 표준 적용성 & 개정 추적기 (SPEC-REGULA-STANDARDS-001) | Wave 3 | Wave3-backlog | 1차 RC 후 |

Wave 4 항목 (Wave3-backlog와 동일 트랙으로 분류):

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #25 | [Wave 4] 실시간 공동편집 — Yjs CRDT + Cloudflare DO (SPEC-REGULA-COEDIT-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #44 | [Wave 4] SPEC-REGULA-CALENDAR-001 — 규제 캘린더 & 데드라인 관리 | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #45 | [Wave 4] SPEC-REGULA-DELTA-SYNC-001 — 코퍼스 증분 동기화 | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #46 | [Wave 4] SPEC-REGULA-RISK-001 — ISO 14971 위험관리 통합 | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #53 | [Wave 4] EU MDR 출시 후 임상 감시 — PMS / PMCF (SPEC-REGULA-PMS-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #54 | [Wave 4] 설계 변경 규제 영향 자동 평가기 (SPEC-REGULA-CHANGE-CONTROL-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #56 | [Wave 4] 사용자 피드백 기반 RAG 품질 연속 개선 (SPEC-REGULA-RLHF-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #57 | [Wave 4] QMS/DMS 양방향 통합 API (SPEC-REGULA-QMS-INTEGRATION-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #63 | [Wave 4] AI/ML SaMD 전용 규제 경로 (SPEC-REGULA-SAMD-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #64 | [Wave 4] 설계 이력 파일(DHF) 통합 관리 (SPEC-REGULA-DHF-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |
| #65 | [Wave 4] 전자 제출 패키지 빌더 (SPEC-REGULA-ESUBMIT-001) | Wave 4 | Wave3-backlog | 1차 RC 후 |

#### 2.1.4 Wave5-backlog

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #66 | [Wave 5] 라벨링·IFU·클레임 검토 워크벤치 (SPEC-REGULA-LABELING-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #67 | [Wave 5] 의료기기 사이버보안·SBOM 제출 증거 (SPEC-REGULA-CYBERDEVICE-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #68 | [Wave 5] 불만·CAPA 폐루프 관리 (SPEC-REGULA-CAPA-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #69 | [Wave 5] 임상시험·임상조사 계획기 (SPEC-REGULA-CLINICAL-INVESTIGATION-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #70 | [Wave 5] 보험·상환 경로 분석기 (SPEC-REGULA-REIMBURSEMENT-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #84 | [Wave 5] 답변 인라인 정제·부분 재생성·톤 조정 (SPEC-REGULA-ANSWER-REFINE-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #85 | [Wave 5] Confidence 점수 근거 표시·대안 답변 비교 (SPEC-REGULA-CONFIDENCE-EXPLAIN-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #86 | [Wave 5] 개인 RA 라이브러리·북마크·태깅·치트시트 (SPEC-REGULA-PERSONAL-LIB-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #87 | [Wave 5] 답변 다중 포맷 Export·메일 포워드·외부 공유 허브 (SPEC-REGULA-EXPORT-HUB-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #88 | [Wave 5] 21 CFR Part 11 §11.70 전자서명·답변 잠금 (SPEC-REGULA-ESIG-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #89 | [Wave 5] GDPR/PIPA 데이터 주체 요청(DSAR) 자동화 (SPEC-REGULA-DSAR-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #90 | [Wave 5] 데이터 거주성 기반 LLM/임베딩 라우팅 (SPEC-REGULA-DATA-RESIDENCY-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #91 | [Wave 5] DLP·자동 redaction·외부 공유 sanitize (SPEC-REGULA-DLP-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |
| #92 | [Wave 5] 외부 감사관 read-only 페르소나·1-click 감사 패키지 (SPEC-REGULA-AUDITOR-VIEW-001) | Wave 5 | Wave5-backlog | GATE-001, HARDENING-001, QUALITY-001 완료 후 |

#### 2.1.5 QA-program (운영 트랙, separate program)

| # | Title | Wave | Category | Blocked-by |
|---|---|---|---|---|
| #73 | [QA Program] 전체 이슈 QA 매트릭스 (SPEC-REGULA-QA-MATRIX-001) | QA Program | QA-program | 1차 RC 후 활성화 |
| #74 | [QA Gate 0] SPEC 준비도 QA (SPEC-REGULA-QA-SPEC-READINESS-001) | QA Program | QA-program | 자식 SPEC 작성 시 적용 |
| #75 | [QA Gate 1] 구현 중 체크포인트 QA (SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001) | QA Program | QA-program | 자식 SPEC RUN 시 적용 |
| #76 | [QA Gate 2] PR 수락 QA (SPEC-REGULA-QA-PR-ACCEPTANCE-001) | QA Program | QA-program | GATE-001 직접 적용 |
| #77 | [QA Gate 3] Wave 통합 시나리오 QA (SPEC-REGULA-QA-WAVE-INTEGRATION-001) | QA Program | QA-program | 1차 RC 후 |
| #78 | [QA Gate 4] RA 도메인 UAT (SPEC-REGULA-QA-DOMAIN-UAT-001) | QA Program | QA-program | 1차 RC 후 |
| #79 | [QA Gate 5] 운영 QA·회귀 모니터링 (SPEC-REGULA-QA-OPERATIONS-001) | QA Program | QA-program | 1차 RC 후 |

QA Gate 0~5 정의는 `.moai/specs/_shared/qa-gate-roadmap.md` 단일 출처를 참조한다.

---

## 3. EARS 요구사항

EARS 패턴 라벨: U=Ubiquitous, ED=Event-Driven, SD=State-Driven, O=Optional, UB=Unwanted.

### Group A — Release Scope Lock

#### REQ-REL-001 (U)
The system **shall** define 1차 릴리즈 scope as the implemented Phase 1~11 plus Tenant-Lite release surface listed in Section 2 and §2.1.

Acceptance:
- README, roadmap, GitHub issues, and PR closure metadata do not imply Wave 3~5 backlog (#22~#25, #41~#46, #50~#92) or QA Program (#73~#79) are required for 1차 릴리즈.
- §2.1 분류표가 `gh issue list --state open --label "type/spec"` 결과와 정합 (drift ≤ 5 issues).

#### REQ-REL-002 (U)
The system **shall** apply the Work Gate process defined by Issue #18 (branch tracking, PR-issue linkage verification) to all release work; this requirement does NOT impose closure of Issue #18 itself, which remains intentionally OPEN until the post-mortem ADR is independently completed.

Acceptance:
- Every release PR references its source issue.
- Stale branches and duplicate implementation branches are checked before merge.
- `gh issue view 18 --json state -q .state` returns `OPEN` throughout this SPEC family lifecycle.

### Group B — Mergeability and CI

#### REQ-REL-010 (ED)
**WHEN** a release PR is open, **THEN** all required checks shall complete successfully before merge.

Acceptance:
- PR #20 has green CI Gates, security scan, LLM eval, and Playwright E2E.
- PR #21 has green CI Gates, security scan, and no skipped required release check caused by upstream failure.
- (자식 SPEC GATE-001 acceptance §4.1 위임)

#### REQ-REL-011 (UB)
**IF** a release PR is not yet merged into main, **THEN** the system **shall not** close its linked release issue until the linked PR is merged or equivalent code is confirmed on main.

Acceptance:
- #12 and #13 closure comments include merged commit (`9b7adda`, `11bd6fa`) or verified main evidence.
- #30 records final PR status and issue closure mapping.
- (자식 SPEC GATE-001 REQ-GATE-009/010/012 위임)

### Group C — Build Reproducibility

#### REQ-REL-020 (U)
The project **shall** provide bounded build verification for local and CI contexts.

Acceptance:
- `pnpm ci:build` has CI evidence (run link in main branch latest commit).
- Local build instructions include timeout, env placeholders, and process cleanup steps.
- A hung local build is recorded as inconclusive, not passed.
- Issue #26 closed with documented bounded-build procedure.

### Group D — Production Placeholder Control

#### REQ-REL-030 (UB)
The production import path **shall not** expose TODO, placeholder, or stub behavior to users unless feature-gated or explicitly deferred via a documented SPEC reference.

Acceptance:
- `lib/ai/hybrid-router.ts` Vectorize runtime gap is resolved or guarded (owner: QUALITY-001 REQ-QUAL-011~014).
- `lib/external/eu-ectd.ts` and `lib/external/fda-estar.ts` are either implemented, feature-gated, or excluded from user-visible release flows (owner: HARDENING-001 REQ-HARDEN-018~019).
- UI placeholder text is limited to normal input placeholder copy, skeleton loading states, or documented non-release surfaces.
- (자식 SPEC HARDENING-001 acceptance Static check D-S1 위임)

### Group E — Runtime Logging and PII Safety

#### REQ-REL-040 (UB)
Runtime app/lib/workers code **shall not** use direct `console.*` for operational events that may include user, document, query, answer, or source content.

Acceptance:
- Runtime console usages are removed, routed to structured logger, or documented as safe exceptions with `@MX:NOTE: console-allowed`.
- Audit logs remain separate from operational logs.
- No PII / raw prompt / raw answer is written to logs.
- (자식 SPEC HARDENING-001 acceptance Static check C-S1, C-S2, C-S3 위임)

### Group F — Security and Compliance Gate

#### REQ-REL-050 (U)
The 1차 릴리즈 **shall** pass the internal security and compliance checklist.

Acceptance:
- 21 CFR Part 11 append-only audit behavior is tested.
- Security headers E2E passes on chromium project (owner: QUALITY-001 REQ-QUAL-020~023).
- Dependency scan and gitleaks pass.
- Runbook and compliance docs match actual env, CI, and deployment behavior.

### Group G — Release Handoff

#### REQ-REL-060 (U)
The project **shall** reach a clean handoff state before release tagging.

Acceptance:
- `git status --short --branch` is clean except intentionally ignored/generated paths.
- Active PR/branch/issue mapping is documented.
- Release notes include included scope, excluded scope (per §2.1 분류표), known limitations, verification evidence, and rollback path.
- `git tag v1.0.0-rc` is applied only after all closing criteria in `plan.md` §2 (M1~M4) are satisfied.

---

## 4. Release 판정 기준

Release candidate (RC):
- REQ-REL-001 ~ 060 all satisfied.
- 자식 SPEC 3종 (GATE-001 / HARDENING-001 / QUALITY-001) status: completed.
- #26~#30, #32~#34 closed with evidence.
- #12 / #13 closure state correct.
- PR #20 / #21 merged or superseded with evidence.
- §2.1 분류표 drift ≤ 5 issues vs current `gh issue list` output.

Release block:
- Any failing required CI check.
- Any open P0/P1 release-hardening issue (자식 SPEC scope).
- Any production-visible placeholder in in-scope flow.
- Any unresolved #18 Work Gate process violation (단, #18 자체는 OPEN 유지 — REQ-REL-002 명시).

---

## 5. Exclusions (What NOT to Build)

본 SPEC이 명시적으로 다루지 않는 항목:

1. **신규 비즈니스 기능** — 본 SPEC은 우산이며, 코드 변경 0건. 모든 구현은 자식 SPEC에 위임.
2. **자식 SPEC scope의 직접 수정** — GATE-001 / HARDENING-001 / QUALITY-001의 REQ는 본 SPEC이 직접 수정하지 않는다.
3. **Wave 3~5 backlog** — §2.1 분류표 Wave3-backlog / Wave5-backlog 카테고리 모든 항목.
4. **QA Program 운영 트랙** — #73~#79는 본 1차 릴리즈와 별도 트랙. 1차 RC 후 활성화.
5. **post-v0.1 카테고리** — §2.1.2 모든 항목 (#35~#38, #47~#49, #71~#72, #80~#83 등).
6. **Issue #18 closure** — post-mortem ADR 미완성으로 의도적 OPEN 유지 (REQ-REL-002 명시).
7. **post-RC patch SPEC** — RC 선언 이후 발견된 결함은 별도 SPEC (예: SPEC-REGULA-RELEASE-002)으로 발행.

---

## 6. Dependencies and Sequencing

- **Hard dependency** (선행 조건):
  - SPEC-REGULA-RELEASE-GATE-001 (P0) 완료 → SPEC-REGULA-RELEASE-HARDENING-001 (P1) 진입
  - SPEC-REGULA-RELEASE-HARDENING-001 (P1) 완료 → SPEC-REGULA-QUALITY-001 (P2) 진입
  - SPEC-REGULA-QUALITY-001 (P2) 완료 → 본 SPEC RC declaration M4 진입
- **Soft dependency**: §2.1 분류표 작성을 위한 `gh issue list` 최신 결과 (drift 검증).
- **No conflict**: 자식 SPEC 간 file ownership 충돌 없음 (research.md §2.4 ownership 표 참조).

---

## 7. References

- 본 SPEC 4-doc:
  - `.moai/specs/SPEC-REGULA-RELEASE-001/research.md`
  - `.moai/specs/SPEC-REGULA-RELEASE-001/plan.md`
  - `.moai/specs/SPEC-REGULA-RELEASE-001/acceptance.md`
  - `.moai/specs/SPEC-REGULA-RELEASE-001/traceability-matrix.md`
- 자식 SPEC:
  - `.moai/specs/SPEC-REGULA-RELEASE-GATE-001/`
  - `.moai/specs/SPEC-REGULA-RELEASE-HARDENING-001/`
  - `.moai/specs/SPEC-REGULA-QUALITY-001/`
- 공통 SSoT (QA Gate 0~5): `.moai/specs/_shared/qa-gate-roadmap.md`
- GitHub artifacts: PR #20, #21; Issues #12, #13, #18, #26~#34, #73~#79
- Tasks reference: `.moai/specs/SPEC-REGULA-RELEASE-001/tasks.md` (기존, 참고용)

QA 단계 게이트 정의는 `.moai/specs/_shared/qa-gate-roadmap.md`를 참조하라.
