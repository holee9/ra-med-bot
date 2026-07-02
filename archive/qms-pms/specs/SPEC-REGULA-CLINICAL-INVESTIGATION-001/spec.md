---
id: SPEC-REGULA-CLINICAL-INVESTIGATION-001
version: 1.0.0
status: draft
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 69
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CER-001
  - SPEC-REGULA-PMS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-CLINICAL-INVESTIGATION-001 — 임상시험·임상조사 계획기 (FDA IDE·EU MDR Clinical Investigation·IRB 패키지)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #69 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

#23 CER와 #60 Clinical Literature는 기존 임상 근거 수집과 보고서 작성을 다룬다. 그러나 임상 근거가 부족할 때 필요한 FDA IDE(Investigational Device Exemption), EU MDR Clinical Investigation, IRB/EC(Institutional Review Board / Ethics Committee) 제출 패키지 생성은 별도 범위이다.

본 SPEC은 임상 근거 갭을 바탕으로 임상시험·임상조사 필요 여부를 판단하고, 관할권별 제출·승인·운영 패키지를 생성한다. CER/문헌 근거 갭 기반 clinical investigation 필요성 평가, FDA IDE 필요 여부 결정 트리, EU MDR Article 62 및 Annex XV 임상조사 체크리스트, IRB/EC 제출 문서 패키지 초안 생성을 포함한다.

protocol synopsis, endpoint, inclusion/exclusion criteria 작성 지원, risk/benefit rationale 및 informed consent 초안 생성, investigator brochure 및 monitoring plan 템플릿, study milestone·deviation·adverse event 연결을 제공하며, 결과 데이터를 CER(#23), PMS(#53), DHF(#64)에 반영한다. 각 판단에는 regulatory basis citation을 포함한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 21 CFR 812: Investigational Device Exemptions (IDE)
- FDA 21 CFR 50: Protection of Human Subjects (informed consent)
- FDA 21 CFR 56: Institutional Review Boards
- EU MDR (2017/745) Article 62-82, Annex XV: Clinical Investigations
- ISO 14155: 임상조사 Good Clinical Practice
- Declaration of Helsinki: 임상 윤리 원칙

### 1.3 본 SPEC의 범위 (In Scope)

- CER/문헌 근거 갭 기반 clinical investigation 필요성 평가
- FDA IDE 필요 여부 결정 트리
- EU MDR Article 62 및 Annex XV 임상조사 체크리스트
- IRB/EC 제출 문서 패키지 초안 생성
- protocol synopsis, endpoint, inclusion/exclusion criteria 작성 지원
- risk/benefit rationale 및 informed consent 초안 생성
- investigator brochure 및 monitoring plan 템플릿
- study milestone, deviation, adverse event 연결
- 결과 데이터를 CER(#23), PMS(#53), DHF(#64)에 반영

### 1.4 Out of Scope

- 실제 IRB/EC 또는 규제기관 직접 제출
- EDC(Electronic Data Capture) / CTMS 임상 데이터 수집 시스템 구현
- 환자 모집·스크리닝 운영
- 임상시험 통계 분석 자체 수행

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CLININV-001 | WHEN CER/문헌 근거 갭이 입력되면 THE SYSTEM SHALL clinical investigation 필요성 평가 결과를 생성한다 | High |
| REQ-CLININV-002 | WHEN 사용자가 FDA IDE 경로를 평가하면 THE SYSTEM SHALL IDE 필요 여부 결정 트리를 제공한다 | High |
| REQ-CLININV-003 | WHEN 사용자가 EU MDR 임상조사를 평가하면 THE SYSTEM SHALL Article 62 및 Annex XV 체크리스트를 제공한다 | High |
| REQ-CLININV-004 | THE SYSTEM SHALL IRB/EC 제출 문서 패키지 초안을 생성한다 | High |
| REQ-CLININV-005 | WHEN 사용자가 protocol을 작성하면 THE SYSTEM SHALL protocol synopsis, endpoint, inclusion/exclusion criteria 작성을 지원한다 | High |
| REQ-CLININV-006 | THE SYSTEM SHALL risk/benefit rationale 및 informed consent 초안을 생성한다 | High |
| REQ-CLININV-007 | THE SYSTEM SHALL investigator brochure 및 monitoring plan 템플릿을 제공한다 | High |
| REQ-CLININV-008 | THE SYSTEM SHALL study milestone, deviation, adverse event를 연결·추적한다 | High |
| REQ-CLININV-009 | WHEN study 결과가 확정되면 THE SYSTEM SHALL 결과 데이터를 CER(#23), PMS(#53), DHF(#64)에 반영한다 | High |
| REQ-CLININV-010 | THE SYSTEM SHALL IDE/임상조사 경로 판단의 근거 citation을 포함하도록 강제한다 | High |
| REQ-CLININV-011 | THE SYSTEM SHALL 임상조사 승인/진행 상태 대시보드를 제공한다 | Medium |
| REQ-CLININV-012 | IF expert signoff 없이 임상조사 판단을 close하려 하면 THEN THE SYSTEM SHALL 차단한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | CER gap → clinical investigation recommendation 생성 | integration test |
| AC-02 | FDA IDE / EU MDR Clinical Investigation 경로 판단 근거 citation 포함 | eval assertion (citation coverage) |
| AC-03 | IRB/EC 패키지 초안 생성 | integration test |
| AC-04 | study result가 CER와 DHF traceability에 연결 | integration test |
| AC-05 | 임상조사 승인/진행 상태 대시보드 제공 | E2E test |
| AC-06 | protocol synopsis/endpoint/criteria 작성 지원 동작 | unit/integration test |
| AC-07 | expert signoff 없이 close 차단 | negative test |
| AC-08 | adverse event ↔ Vigilance/study milestone 연결 | integration test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
app/(app)/clinical-investigation/    # 임상조사 계획기 UI
lib/clinical-investigation/
  gap-assessment.ts                  # CER/문헌 갭 → 필요성 평가
  ide-decision-tree.ts               # FDA IDE 결정 트리
  eu-checklist.ts                    # Article 62 / Annex XV
  irb-package.ts                     # IRB/EC 패키지 초안
  protocol-builder.ts                # synopsis/endpoint/criteria
  consent-generator.ts               # informed consent 초안
lib/db/schema/clinical-investigation.ts
```

### 4.2 DB Schema

- `clinical_investigations` 테이블: project_id FK, pathway(fda_ide|eu_mdr), necessity_status, approval_status
- `ci_protocols` 테이블: investigation_id FK, synopsis, endpoints, inclusion_criteria, exclusion_criteria
- `ci_documents` 테이블: investigation_id FK, doc_type(irb_package|consent|brochure|monitoring_plan), content, review_status
- `ci_events` 테이블: investigation_id FK, type(milestone|deviation|adverse_event), data
- `ci_links` 테이블: investigation_id FK, target_type(cer|pms|dhf), target_id

### 4.3 API Endpoints

- `POST /api/clinical-investigation/assess` — 갭 기반 필요성 평가
- `POST /api/clinical-investigation/[id]/ide-decision` — IDE 결정 트리
- `GET /api/clinical-investigation/[id]/eu-checklist`
- `POST /api/clinical-investigation/[id]/protocol`
- `POST /api/clinical-investigation/[id]/irb-package`
- `POST /api/clinical-investigation/[id]/events` — milestone/deviation/AE
- `POST /api/clinical-investigation/[id]/close` — expert signoff 검증

### 4.4 의존성

- #23 CER (임상평가보고서 입력 및 결과 반영)
- #53 PMS/PMCF (시판 후 임상 추적과 연결)
- #60 Clinical Literature (임상 근거 갭 판단)
- #61 Vigilance (시험 중 adverse event 연결)
- #64 DHF (임상 검증 증거 연결)
- #65 eSubmit (IDE/clinical investigation 제출 패키지 포함)
