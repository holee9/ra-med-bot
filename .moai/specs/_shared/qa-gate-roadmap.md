---
artifact: shared-roadmap
title: "QA 단계 게이트 0~5 통합 로드맵"
created: 2026-05-05
updated: 2026-05-05
author: manager-spec
scope: regula-release-family
related_specs:
  - SPEC-REGULA-RELEASE-001
  - SPEC-REGULA-RELEASE-GATE-001
  - SPEC-REGULA-RELEASE-HARDENING-001
  - SPEC-REGULA-QUALITY-001
related_issues:
  - "#73"
  - "#74"
  - "#75"
  - "#76"
  - "#77"
  - "#78"
  - "#79"
---

# QA 단계 게이트 0~5 통합 로드맵 (Single Source of Truth)

본 문서는 Regula 1차 릴리즈 SPEC 패밀리(`SPEC-REGULA-RELEASE-001`, `SPEC-REGULA-RELEASE-GATE-001`, `SPEC-REGULA-RELEASE-HARDENING-001`, `SPEC-REGULA-QUALITY-001`)에서 공통적으로 참조하는 **QA 단계 게이트 0~5** 정의의 단일 출처(SSoT)이다.

각 SPEC은 이 문서를 참조하여 중복 정의를 제거하고, QA 게이트 변경 시 본 파일 한 곳만 수정한다.

---

## 1. QA 단계 게이트 매트릭스 (한 줄 요약)

| QA Gate | GitHub Issue | SPEC ID (예정) | 한 줄 범위 |
|---|---|---|---|
| QA Program (메타) | #73 | SPEC-REGULA-QA-MATRIX-001 | 전체 이슈 QA 매트릭스 — 요구사항·테스트·증거 추적 체계 |
| QA Gate 0 — SPEC 준비도 | #74 | SPEC-REGULA-QA-SPEC-READINESS-001 | 구현 시작 전 요구사항·AC·테스트 설계 점검 |
| QA Gate 1 — 구현 중 체크포인트 | #75 | SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001 | 단위·계약·감사·citation 회귀 검증 |
| QA Gate 2 — PR 수락 | #76 | SPEC-REGULA-QA-PR-ACCEPTANCE-001 | 변경 범위·회귀·접근성·보안·증거 패키지 확인 |
| QA Gate 3 — Wave 통합 시나리오 | #77 | SPEC-REGULA-QA-WAVE-INTEGRATION-001 | Cross-feature E2E·데이터 흐름·사용자 여정 검증 |
| QA Gate 4 — RA 도메인 UAT | #78 | SPEC-REGULA-QA-DOMAIN-UAT-001 | 전문가 승인·citation 정확도·출처 사용권 확인 |
| QA Gate 5 — 운영 QA·회귀 모니터링 | #79 | SPEC-REGULA-QA-OPERATIONS-001 | synthetic checks·rollback drill·품질 지표 추적 |

---

## 2. 1차 릴리즈와의 관계

1차 릴리즈는 **QA Gate 0 ~ 2**까지 통과를 RC 선언 전제로 한다. **Gate 3 ~ 5**는 1차 릴리즈 직후 v0.2 운영 단계에서 활성화된다.

| QA Gate | 1차 릴리즈 RC 전제? | 1차 릴리즈 우선순위 | Owner SPEC |
|---|---|---|---|
| QA Program (#73) | 매트릭스 구축 필수 (메타) | High | SPEC-REGULA-RELEASE-001 (감독) |
| Gate 0 (#74) | 필수 (모든 in-scope SPEC) | High | SPEC-REGULA-RELEASE-001 (검증), 각 SPEC (생산) |
| Gate 1 (#75) | 필수 (RUN 단계 진입 전) | High | SPEC-REGULA-RELEASE-HARDENING-001, SPEC-REGULA-QUALITY-001 |
| Gate 2 (#76) | 필수 (모든 PR 머지 전) | Critical | SPEC-REGULA-RELEASE-GATE-001 |
| Gate 3 (#77) | 1차 릴리즈 직후 권장 | Medium | post-v0.1 |
| Gate 4 (#78) | 1차 릴리즈 직후 필수 | High | post-v0.1 (도메인 전문가 가용성 의존) |
| Gate 5 (#79) | 1차 릴리즈 직후 필수 | High | post-v0.1 (운영 환경 가용성 의존) |

---

## 3. RACI 요약 (상세는 각 SPEC 참조)

본 로드맵은 **누가 어떤 게이트의 무엇을 책임지는지**의 단일 출처를 제공한다. 항목별 상세 RACI는 각 SPEC §References 섹션에 별도 표로 정리되어 있다.

| 영역 | RELEASE-GATE-001 (#32) | QUALITY-001 (#34) | QA Gate (#73-#79) |
|---|---|---|---|
| 보안 헤더 미들웨어 코드 (R) | — | Owner (REQ-QUAL-020~023) | Verifier (#76 PR Acceptance) |
| 보안 헤더 E2E 테스트 작성 (R) | — | Owner | — |
| 보안 헤더 E2E CI 실행 결과 (A) | Verifier | Owner | Verifier (#76, #79) |
| RBAC 매트릭스 코드 (R) | — | Owner (REQ-QUAL-024~025) | Verifier (#76) |
| Branch/PR/Issue closure (R/A) | Owner | — | Verifier (#76) |
| Synthetic monitoring (R) | — | — | Owner (#79 QA Gate 5) |
| Domain UAT (R/A) | — | — | Owner (#78 QA Gate 4) |

R = Responsible, A = Accountable

---

## 4. 게이트별 PASS 조건 (요약)

각 SPEC의 acceptance criteria는 본 표의 PASS 조건과 정합한다.

### Gate 0 — SPEC 준비도 (#74)
- 4-doc 셋(spec/plan/acceptance/research) 모두 존재
- EARS 패턴 라벨 (U/ED/SD/O/UB) 100% 부착
- traceability-matrix.md 존재 및 모든 REQ row 정의됨
- Exclusions 섹션 ≥ 1 항목 명시

### Gate 1 — 구현 중 체크포인트 (#75)
- 단위 테스트 통과 (`pnpm test`)
- 계약 테스트 통과 (API contract)
- audit log entry 검증 (`audit_logs` row 발생 확인)
- citation 회귀 테스트 통과 (`tests/e2e/citation-click.spec.ts`)

### Gate 2 — PR 수락 (#76)
- 모든 CI check green (`gh pr checks <N>`)
- 접근성(a11y) 검증 (axe-core 위반 0건)
- 보안 스캔 통과 (gitleaks, dependency scan)
- 증거 패키지 첨부 (CI artifact, screenshots, audit log dump)

### Gate 3 — Wave 통합 시나리오 (#77)
- Cross-feature E2E (Foundation+Chat+RAG+Workflow) 통과
- 데이터 흐름 검증 (upload → ingest → search → answer → audit)
- 사용자 여정 시나리오 (4종 페르소나) 통과

### Gate 4 — RA 도메인 UAT (#78)
- 도메인 전문가 ≥ 3명의 명시적 승인
- citation 정확도 ≥ 95% (sample 50건)
- 출처 사용권 확인 (라이선스 검증)

### Gate 5 — 운영 QA·회귀 모니터링 (#79)
- Synthetic check (5개 canonical query) 통과
- Rollback drill 성공
- 품질 지표 (latency P95, error rate, cost/query) baseline 등록

---

## 5. 변경 정책

본 문서는 SPEC family 공통 SSoT이므로 다음 정책을 따른다:

- **수정 권한**: Plan/Sync 단계에서만 수정 가능. RUN 단계 중 변경 금지.
- **수정 시 영향 분석**: 본 문서를 변경하면 4개 SPEC (RELEASE-001/GATE-001/HARDENING-001/QUALITY-001) 모두에서 참조 정합성 검증 필요.
- **버전 관리**: 변경 시 본 파일 frontmatter `updated` 필드 갱신 + 4개 SPEC `revision_history`에 참조 코멘트 추가.

---

## 6. 참조

- GitHub Issues: #73~#79 (QA Program 7종)
- 4개 owner SPEC: SPEC-REGULA-RELEASE-001, SPEC-REGULA-RELEASE-GATE-001, SPEC-REGULA-RELEASE-HARDENING-001, SPEC-REGULA-QUALITY-001
- E2E 인프라 issues: #80, #81, #82, #83 (E2E 환경 구축·게이트)
