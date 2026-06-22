---
id: SPEC-REGULA-CHANGE-CONTROL-001
version: 1.0.0
status: draft
phase: wave4
priority: Medium
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 54
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-CHANGE-CONTROL-001 — 설계 변경 규제 영향 자동 평가기 (Change Control RA Impact)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #54 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

의료기기 개발 과정에서 설계 변경(design change)은 불가피하다. 그러나 모든 설계 변경이 규제적 영향을 가지며, 잘못된 평가는 새로운 허가 신청 누락 → 무허가 기기 판매 → 리콜·행정제재로 이어진다. 변경 영향 평가는 RA 전문가의 가장 반복적이고 시간 소모적인 업무 중 하나다.

현재 규제 영향 평가는 RA 전문가의 경험에 전적으로 의존한다. FDA 21 CFR 807.81(a)(3), EU MDR Article 120(3), MFDS 기준 등 다중 관할권의 변경 평가 기준이 서로 다르며, 각 시장별로 새 허가 신청 필요 여부 판단 로직이 상이하다.

본 SPEC은 설계 변경을 구조화 입력으로 받아 각 시장별 규제 영향을 자동 평가한다. 변경 유형(design, material, manufacturing_process, software, labeling, intended_use)을 분류하고, 관할권별로 "새 허가 필요 / 변경 신고 / 내부 기록만 / 해당 없음"을 판단하며, 각 판단에 규제 문서 citation을 강제한다. 평가 결과는 PDF 보고서로 내보내어 기존 DHF/변경 관리 시스템에 첨부할 수 있다.

자동 평가는 잘못된 자동 판단을 막기 위해 expert review gate와 연계되며, ISO 14971(#46) 위험 재평가와 연동된다. 이를 통해 설계 변경 규제 평가 오류로 인한 리콜·행정제재 위험을 제거한다.

### 1.2 규제 근거 (Regulatory Anchor)

| 관할권 | 평가 기준 |
|--------|----------|
| FDA | 21 CFR 807.81(a)(3), FDA Modifications Guidance 2019 (When to Submit a 510(k)) |
| EU MDR | Article 120(3), MDCG 2020-3 (significant changes) |
| MFDS | 의료기기법 제12조 변경 허가/신고 기준 |
| NMPA | 중국 변경 등록 기준 |
| PMDA | 일본 일부변경 승인 기준 |

### 1.3 본 SPEC의 범위 (In Scope)

- `workflow_type` enum에 `change_control_assessment` 추가
- 변경 사항 구조화 입력 폼: 변경 유형, 설명, 영향 범위
- 변경 유형 분류: design, material, manufacturing_process, software, labeling, intended_use
- 관할권별 AI 평가: 새 허가 필요 / 변경 신고 / 내부 기록만 / 해당 없음 (+ 근거)
- 근거 citation 강제: 각 판단에 규제 문서 출처 필수
- 변경 영향 평가 보고서 PDF 내보내기
- ISO 14971(#46) 위험 재평가 연계

### 1.4 Out of Scope

- 실제 변경 허가/신고 외부 제출 자동화
- 변경 관리 시스템(eDHF/QMS) 양방향 동기화
- 전자서명 full validation
- 본 SPEC에 명시되지 않은 추가 관할권 평가 로직

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CHANGE-CONTROL-001 | THE SYSTEM SHALL include change_control_assessment as a value in the workflow_type enum | High |
| REQ-CHANGE-CONTROL-002 | THE SYSTEM SHALL provide a structured change input form capturing change type, description, and impact scope | High |
| REQ-CHANGE-CONTROL-003 | WHEN a change is submitted THE SYSTEM SHALL classify it as one of design, material, manufacturing_process, software, labeling, or intended_use | High |
| REQ-CHANGE-CONTROL-004 | WHEN a change is assessed THE SYSTEM SHALL produce a per-jurisdiction verdict of new submission required, change notification, internal record only, or not applicable | High |
| REQ-CHANGE-CONTROL-005 | THE SYSTEM SHALL evaluate against FDA, EU MDR, MFDS, NMPA, and PMDA criteria for the project's target markets | High |
| REQ-CHANGE-CONTROL-006 | IF an assessment verdict lacks a regulatory document citation THEN THE SYSTEM SHALL reject the verdict and require a citation | High |
| REQ-CHANGE-CONTROL-007 | THE SYSTEM SHALL export the change impact assessment as a PDF report attachable to a DHF or change management system | Medium |
| REQ-CHANGE-CONTROL-008 | WHEN a change assessment is created THE SYSTEM SHALL link it to an ISO 14971 (#46) risk re-evaluation | Medium |
| REQ-CHANGE-CONTROL-009 | WHEN the AI produces a verdict THE SYSTEM SHALL route it through an expert review gate before it is treated as final | High |
| REQ-CHANGE-CONTROL-010 | WHEN a workflow run completes THE SYSTEM SHALL record model, prompt, and template version metadata enabling rollback | Medium |
| REQ-CHANGE-CONTROL-011 | WHILE a verdict is unreviewed THE SYSTEM SHALL display it as provisional and exclude it from final export | High |
| REQ-CHANGE-CONTROL-012 | WHEN a change assessment is recorded THE SYSTEM SHALL write an audit_logs entry with actor, timestamp, and inputs | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | 사용자가 변경 유형·설명·영향 범위를 구조화 입력할 수 있다 | Review |
| AC-02 | 변경이 6개 유형 중 하나로 분류된다 | Test |
| AC-03 | 각 target market에 대해 4단계 verdict(+근거)가 생성된다 | Test |
| AC-04 | citation 없는 verdict는 거부된다 (citation 강제) | Test |
| AC-05 | 변경 영향 평가 보고서가 PDF로 export된다 | Test |
| AC-06 | ISO 14971(#46) 위험 재평가 연계가 생성된다 | Test |
| AC-07 | AI verdict가 expert review 전에는 provisional로 표시되고 export에서 제외된다 | Test |
| AC-08 | 모든 평가가 audit_logs에 기록되고 model/prompt version metadata가 남는다 | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/
    (dashboard)/change-control/
      page.tsx                  # 변경 입력 폼
      [assessmentId]/page.tsx   # 관할권별 verdict, citation, 위험 연계
    api/change-control/
      route.ts                  # assessment 생성 (workflow 실행)
      [assessmentId]/export/route.ts  # PDF 보고서
  lib/change-control/
    classify.ts                 # 변경 유형 분류
    jurisdictions/
      fda.ts                    # 21 CFR 807.81(a)(3) 로직
      eu-mdr.ts                 # Article 120(3), MDCG 2020-3
      mfds.ts                   # 의료기기법 제12조
      nmpa.ts                   # 중국 변경 등록
      pmda.ts                   # 일본 일부변경
    verdict.ts                  # citation 강제 검증
  workflows/change-control-assessment.ts  # Workflows runtime 재사용
  db/schema/change-control.ts
```

### 4.2 DB Schema

- `change_assessments`: id, project_id, change_type, description, impact_scope, status (provisional|reviewed|final), model_version, prompt_version, created_at
- `change_verdicts`: id, assessment_id, jurisdiction, verdict (new_submission|change_notification|internal_record|not_applicable), rationale, created_at
- `change_verdict_citations`: id, verdict_id, source_section_id, excerpt (NOT NULL — citation 강제)
- `change_risk_links`: id, assessment_id, risk_item_id (#46 연계)
- audit_logs 재사용 — assessment 생성/verdict/review 기록

### 4.3 API Endpoints

- `POST /api/change-control` — 구조화 입력 → workflow 실행 → 관할권별 verdict
- `GET /api/change-control/{id}` — verdict + citation + risk link 조회
- `POST /api/change-control/{id}/export` — PDF 보고서 (reviewed 상태 검증)
- review 경로는 #36 Review Ops 게이트 재사용

### 4.4 의존성

- SPEC-REGULA-FOUNDATION-001 (projects, target_markets, source_sections, citations, audit_logs)
- SPEC-REGULA-WORKFLOWS-001 (Cloudflare Workflows runtime 재사용, workflow_type enum)
- #46 ISO 14971 Risk Management (위험 재평가 연계)
- #36 Review Ops (expert review gate — verdict 확정)
