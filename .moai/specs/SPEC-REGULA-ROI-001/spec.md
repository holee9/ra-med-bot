---
id: SPEC-REGULA-ROI-001
version: 1.0.0
status: draft
phase: wave3
priority: Medium
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 55
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-ROI-001 — 비즈니스 가치 대시보드: RA 업무 효율화 ROI 정량화

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #55 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula 도입 후 RA 팀의 실질적 효율화를 측정하고 경영진에게 증명하는 수단이 없다. SaaS 갱신 결정과 추가 도입 확대(enterprise upsell)는 ROI 증명에 달려 있다. 정량적 가치를 제시하지 못하면 도입 효과가 체감으로만 남고, 예산 의사결정에서 우선순위가 밀린다.

현재 Adoption Analytics(#38)는 사용자 온보딩/참여 지표를 다루지만, 비용 절감·시간 절약의 재무적 가치는 측정하지 않는다. 즉 "얼마나 많이 쓰는가"는 알 수 있어도 "그래서 얼마를 아꼈는가"는 알 수 없다.

본 SPEC은 AI 어시스트 답변의 시간 절약을 추정하고(질문 유형별 평균 답변 시간 기준), 전문가 검토 감소율(AI 자신감 향상 추이)을 측정하며, 문서 초안 생성 시간을 수동 작성 시간과 비교한다. 경영진/RA 디렉터용 ROI 리포트를 자동 생성하고, 조직 도입 전후 벤치마크를 제시한다.

ROI 뷰는 민감한 비즈니스 데이터이므로 RBAC로 admin/ra-lead만 접근하도록 제한한다. 월간 ROI 리포트는 조직 로고를 포함한 PDF로 내보낼 수 있다. 시간 절약 추정은 추정 모델이므로 산출 근거(베이스라인, 가정)를 명시하여 과대평가를 방지한다.

### 1.2 규제 근거 (Regulatory Anchor)

본 SPEC은 직접적인 규제 산출물이 아닌 운영 분석 도구이므로 외부 규제 표준의 직접 적용 대상은 아니다. 다만 다음을 준수한다:

- ROI 지표 산출에 사용되는 워크플로우/검토 데이터 접근은 audit_logs에 기록 (내부 통제)
- ROI 뷰 접근은 RBAC(admin/ra-lead)로 제한 (데이터 최소 노출 원칙)
- 추정 모델의 가정과 베이스라인을 리포트에 명시 (투명성, 오도 방지)

### 1.3 본 SPEC의 범위 (In Scope)

- 시간 절약 추정 모델: 질문 복잡도(토큰 수, 인용 수)별 베이스라인 설정
- 워크플로우 실행 시간 추적 (시작 → 완료)
- Expert Review 비율 추이 (AI 신뢰도 향상 측정)
- ROI 대시보드 뷰 (/dashboard 확장 또는 신규 /dashboard/roi)
- 월간 ROI 리포트 PDF 내보내기 (조직 로고 포함)
- 비교 벤치마크: 조직 도입 전후 지표 (온보딩 시 기준선 설정)
- RBAC: admin/ra-lead만 ROI 뷰 접근

### 1.4 Out of Scope

- 실제 인건비/환율 기반 금액 정산 (시간 절약을 화폐로 환산하는 회계 처리)
- 외부 BI 도구(Tableau, Looker 등) 연동
- 사용자 개인별 생산성 평가/감시
- #38 Adoption Analytics가 이미 다루는 온보딩/참여 지표

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-ROI-001 | THE SYSTEM SHALL define a time-saving estimation model with baselines indexed by question complexity (token count, citation count) | High |
| REQ-ROI-002 | WHEN a workflow run starts and completes THE SYSTEM SHALL record its start and completion timestamps | High |
| REQ-ROI-003 | THE SYSTEM SHALL compute estimated time saved per answer by comparing against the complexity baseline | High |
| REQ-ROI-004 | THE SYSTEM SHALL track the expert review deflection rate as the trend of high-confidence AI responses over time | High |
| REQ-ROI-005 | THE SYSTEM SHALL compute draft generation time versus a manual authoring baseline for 510(k) and CER drafts | Medium |
| REQ-ROI-006 | THE SYSTEM SHALL provide an ROI dashboard view at /dashboard/roi | High |
| REQ-ROI-007 | THE SYSTEM SHALL export a monthly ROI report as a PDF including the organization logo | Medium |
| REQ-ROI-008 | WHEN an organization is onboarded THE SYSTEM SHALL allow a pre-adoption baseline to be set for before/after comparison | Medium |
| REQ-ROI-009 | IF a user without admin or ra-lead role requests the ROI view THEN THE SYSTEM SHALL deny access | High |
| REQ-ROI-010 | THE SYSTEM SHALL compute knowledge reuse rate as the citation count of promoted answers (#50) | Medium |
| REQ-ROI-011 | THE SYSTEM SHALL compute corpus coverage improvement from the knowledge gap reduction rate (#35) | Medium |
| REQ-ROI-012 | WHEN an ROI report is generated THE SYSTEM SHALL state the estimation model assumptions and baselines used | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 질문 복잡도별 베이스라인 기반 시간 절약 추정이 산출된다 | Test |
| AC-02 | 워크플로우 실행 시간(시작→완료)이 추적된다 | Test |
| AC-03 | Expert Review 비율 추이가 시계열로 표시된다 | Review |
| AC-04 | /dashboard/roi 뷰가 제공된다 | Review |
| AC-05 | 월간 ROI 리포트가 조직 로고를 포함한 PDF로 export된다 | Test |
| AC-06 | admin/ra-lead 외 역할은 ROI 뷰 접근이 차단된다 | Test |
| AC-07 | 도입 전후 벤치마크 비교가 표시된다 | Review |
| AC-08 | ROI 리포트에 추정 모델의 가정·베이스라인이 명시된다 | Review |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    (dashboard)/dashboard/roi/
      page.tsx                  # ROI 대시보드 (RBAC: admin/ra-lead)
    api/roi/
      route.ts                  # ROI 지표 집계
      report/route.ts           # 월간 PDF 리포트
      baseline/route.ts         # 도입 전 베이스라인 설정
  lib/roi/
    time-saving.ts              # 복잡도별 시간 절약 추정 모델
    deflection.ts               # expert review deflection 추이
    reuse.ts                    # knowledge reuse, corpus coverage
    report-pdf.ts               # 로고 포함 PDF
  db/schema/roi.ts
```

### 4.2 DB Schema

- `roi_baselines`: id, org_id, question_complexity_band, baseline_minutes, set_at, set_by
- `workflow_run_durations`: id, workflow_run_id, started_at, completed_at, complexity_band, estimated_saved_minutes
- `roi_snapshots`: id, org_id, period (month), questions_per_hour, deflection_rate, completion_time_avg, reuse_rate, coverage_improvement, created_at
- 기존 테이블 재사용: workflow_runs(시간), expert_reviews(deflection), promoted_answers #50(reuse), knowledge_gaps #35(coverage)
- audit_logs 재사용 — ROI 데이터 접근 기록

### 4.3 API Endpoints

- `GET /api/roi` — 집계 지표 (RBAC: admin/ra-lead 서버 검증)
- `POST /api/roi/baseline` — 도입 전 베이스라인 설정
- `GET /api/roi/report?period=YYYY-MM` — 월간 PDF 리포트 (로고 포함)
- 모든 ROI 경로에 admin/ra-lead RBAC 미들웨어 적용

### 4.4 의존성

- SPEC-REGULA-FOUNDATION-001 (org, RBAC, audit_logs, 조직 로고)
- SPEC-REGULA-WORKFLOWS-001 (workflow_runs 실행 시간)
- #38 Adoption Analytics (보완 관계 — 참여 vs 비즈니스 가치)
- #37 Submission Lifecycle (510k/CER 워크플로우 완료 시간)
- #50 Knowledge Promotion (knowledge reuse 메트릭)
- #35 Knowledge Gap Ops (corpus coverage improvement)
