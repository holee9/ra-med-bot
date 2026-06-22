---
id: SPEC-REGULA-REIMBURSEMENT-001
version: 1.0.0
status: draft
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 70
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CER-001
  - SPEC-REGULA-CLASSIFY-001
  - SPEC-REGULA-ROI-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-REIMBURSEMENT-001 — 보험·상환 경로 분석기 (CPT/HCPCS·DRG·수가·시장접근 근거 생성)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #70 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula가 인허가 경로와 제출 패키지를 완성해도 실제 사업 성과는 상환·수가·시장접근 전략에 크게 좌우된다. #55 ROI는 내부 효율을 측정하지만, 제품 자체의 CPT/HCPCS/DRG, HIRA(심평원)/NHIS, EU HTA(Health Technology Assessment) 등 상환 경로 판단은 다루지 않는다.

본 SPEC은 의료기기 제품 설명과 시장 전략을 기반으로 관할권별 보험·상환 가능성, 필요 근거, 코딩 경로, 시장접근 리스크를 분석한다. 미국 CPT/HCPCS/ICD-10/DRG 후보 매핑, CMS coverage pathway 및 payer evidence requirement 요약, 한국 심평원/NHIS 급여·비급여 경로 체크리스트, EU 주요 시장 HTA evidence requirement 요약을 포함한다.

임상·경제성 근거 갭 분석을 수행하고 CER(#23), Clinical Literature(#60), PMS(#53) 근거를 재사용하며, 시장별 reimbursement readiness score를 제공하고 상환 전략 메모 및 executive summary export를 지원한다. ROI dashboard와 시장접근 지표를 연결한다.

### 1.2 규제 근거 (Regulatory Anchor)

- CMS National/Local Coverage Determination (NCD/LCD)
- AMA CPT / HCPCS Level II 코딩 체계
- CMS MS-DRG (Diagnosis Related Groups)
- 한국 건강보험심사평가원(HIRA) 요양급여·신의료기술평가
- 국민건강보험공단(NHIS) 급여 기준
- EU HTA Regulation (EU) 2021/2282 (Joint Clinical Assessment)

> 참고: 본 SPEC은 코딩·급여 경로 후보를 분석·제안하며, 규제 인허가가 아닌 시장접근 의사결정 지원 도구이다.

### 1.3 본 SPEC의 범위 (In Scope)

- 미국 CPT/HCPCS/ICD-10/DRG 후보 매핑
- CMS coverage pathway 및 payer evidence requirement 요약
- 한국 심평원/NHIS 급여·비급여 경로 체크리스트
- EU 주요 시장 HTA evidence requirement 요약
- 임상·경제성 근거 갭 분석
- CER(#23), Clinical Literature(#60), PMS(#53) 근거 재사용
- 시장별 reimbursement readiness score 제공
- 상환 전략 메모 및 executive summary export

### 1.4 Out of Scope

- 실제 payer/보험사 청구 제출 또는 협상 자동화
- 정확한 수가 금액 산정 또는 가격 책정
- 코딩 확정 판정 (후보 제안만, 확정은 전문가)
- 실시간 외부 코딩 데이터베이스 API 연동

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-REIMBURSE-001 | WHEN 제품 설명이 입력되면 THE SYSTEM SHALL 미국 CPT/HCPCS/ICD-10/DRG 후보를 매핑한다 | High |
| REQ-REIMBURSE-002 | THE SYSTEM SHALL CMS coverage pathway 및 payer evidence requirement를 요약한다 | High |
| REQ-REIMBURSE-003 | THE SYSTEM SHALL 한국 심평원/NHIS 급여·비급여 경로 체크리스트를 제공한다 | High |
| REQ-REIMBURSE-004 | THE SYSTEM SHALL EU 주요 시장 HTA evidence requirement를 요약한다 | High |
| REQ-REIMBURSE-005 | WHEN 분석이 실행되면 THE SYSTEM SHALL 임상 근거와 경제성 근거 갭을 분석한다 | High |
| REQ-REIMBURSE-006 | WHEN 같은 프로젝트에 CER/Clinical Literature/PMS 근거가 존재하면 THE SYSTEM SHALL 해당 근거를 재사용한다 | High |
| REQ-REIMBURSE-007 | THE SYSTEM SHALL 시장별 reimbursement readiness score를 산출한다 | High |
| REQ-REIMBURSE-008 | THE SYSTEM SHALL 상환 전략 메모 및 executive summary를 export한다 | High |
| REQ-REIMBURSE-009 | THE SYSTEM SHALL 임상 근거와 경제성 근거를 구분하여 표시한다 | High |
| REQ-REIMBURSE-010 | WHEN 코딩/급여 경로 후보가 제안되면 THE SYSTEM SHALL 판단 근거 citation을 포함한다 | High |
| REQ-REIMBURSE-011 | THE SYSTEM SHALL ROI dashboard(#55)와 시장접근 지표를 연결한다 | Medium |
| REQ-REIMBURSE-012 | IF 코딩 후보가 자동 확정되려 하면 THEN THE SYSTEM SHALL 명시적 사용자 선택 또는 expert review gate를 적용한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | US/KR/EU 상환 경로 후보 생성 | integration test |
| AC-02 | reimbursement evidence gap report 생성 | integration test |
| AC-03 | 임상 근거와 경제성 근거를 구분해 표시 | unit test |
| AC-04 | executive summary export 지원 | E2E test |
| AC-05 | ROI dashboard와 시장접근 지표 연결 | integration test |
| AC-06 | CPT/HCPCS/DRG 후보 매핑 동작 | unit test |
| AC-07 | 코딩 후보 자동 확정 방지(사용자 선택/expert gate) | negative test |
| AC-08 | 코딩/급여 판단에 citation 포함 | eval assertion |

---

## §4 Technical Approach

### 4.1 파일 구조

```
app/(app)/reimbursement/             # 상환 경로 분석기 UI
lib/reimbursement/
  us-coding-mapper.ts                # CPT/HCPCS/ICD-10/DRG 후보
  cms-pathway.ts                     # CMS coverage + payer evidence
  kr-pathway.ts                      # 심평원/NHIS 체크리스트
  eu-hta.ts                          # EU HTA evidence
  gap-analyzer.ts                    # 임상·경제성 근거 갭
  readiness-score.ts                 # 시장별 readiness score
lib/db/schema/reimbursement.ts
```

### 4.2 DB Schema

- `reimbursement_analyses` 테이블: project_id FK, jurisdiction(us|kr|eu), readiness_score, review_status
- `reimbursement_codes` 테이블: analysis_id FK, code_system(cpt|hcpcs|icd10|drg), code_candidate, citation_ref, confirmation_status
- `reimbursement_gaps` 테이블: analysis_id FK, evidence_type(clinical|economic), gap_description, source_ref
- `audit_logs` 재사용 (export·확정 이벤트)

### 4.3 API Endpoints

- `POST /api/reimbursement/analyze` — 관할권별 경로 분석
- `GET /api/reimbursement/[id]/codes` — 코딩 후보 조회
- `POST /api/reimbursement/[id]/codes/confirm` — 사용자 선택/expert gate
- `GET /api/reimbursement/[id]/gaps` — 근거 갭 리포트
- `GET /api/reimbursement/[id]/readiness` — readiness score
- `POST /api/reimbursement/[id]/export` — executive summary export

### 4.4 의존성

- #40 Strategy (규제 전략과 시장접근 전략 연결)
- #55 ROI (사업 가치 산정 연결)
- #59 Classification (제품 분류 입력 재사용)
- #60 Clinical Literature (임상·경제성 근거 입력)
- #65 eSubmit (인허가 후 시장 진입 패키지 연결)
- #23 CER, #53 PMS (근거 재사용)
