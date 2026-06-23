---
id: SPEC-REGULA-LABELING-001
version: 1.0.0
status: draft
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 66
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CHANGE-CONTROL-001
  - SPEC-REGULA-TRACEABILITY-001
  - SPEC-REGULA-CROSSMARKET-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-LABELING-001 — 라벨링·IFU·클레임 검토 워크벤치 (표시문구·사용목적·번역 일관성 관리)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #66 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula가 분류, CER, PCCP, DHF, 전자 제출까지 지원해도 실제 제품 출시 전에는 라벨링, IFU(Instructions for Use), intended use, indication, 광고성 claim 검토가 별도 병목으로 남는다. 라벨링 변경은 #54 Change Control과도 연결되지만, 라벨·IFU 문구 자체를 작성·검토·번역·승인하는 전용 워크벤치는 없다.

본 SPEC은 의료기기 라벨, IFU, intended use, indication, 마케팅 claim을 관할권별(FDA, EU MDR, MFDS, PMDA, NMPA) 규제 기준에 맞춰 작성·검토·승인하고, 제출 패키지(#65)와 변경통제(#54)에 연결하는 워크벤치를 정의한다.

핵심 통제는 claim 문구마다 근거 citation 연결을 강제하고, unsupported·comparative·superiority claim을 자동 경고하며, 번역본 간 의미 차이를 검출해 RA 승인 게이트를 거치도록 하는 것이다. 모든 승인·수정·export 이벤트는 audit_logs에 기록한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 21 CFR 801: Labeling (의료기기 라벨링 요구사항)
- FDA 21 CFR 807.87: 510(k) 라벨링 제출
- EU MDR (2017/745) Annex I Chapter III: 라벨 및 IFU 정보 요구사항
- MFDS 의료기기법 표시·기재 기준
- PMDA / NMPA 라벨링 표시사항 기준
- 21 CFR Part 11: 전자 서명·audit trail

### 1.3 본 SPEC의 범위 (In Scope)

- 라벨링/IFU 문서 구조화 작성기
- intended use / indication / contraindication / warning / precaution 섹션 관리
- FDA, EU MDR, MFDS, PMDA, NMPA 관할권별 필수 표시사항 체크
- claim 문구와 근거 citation 연결
- unsupported, comparative, superiority claim 자동 경고
- 번역본 간 의미 차이 검출 및 RA 승인 게이트
- 라벨링 변경 시 #54 Change Control 자동 연계
- 최종 승인본을 #65 전자 제출 패키지에 포함
- 모든 승인·수정·export 이벤트 audit_logs 기록

### 1.4 Out of Scope

- 인쇄용 라벨 아트워크/그래픽 디자인 편집
- UDI(Unique Device Identification) 바코드 생성 (별도 범위)
- 자동 기계 번역 엔진 자체 구현 (검출·게이트만 담당)
- 광고 심의 외부 기관 직접 제출

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-LABEL-001 | THE SYSTEM SHALL 라벨링/IFU 문서를 구조화된 섹션(intended use, indication, contraindication, warning, precaution)으로 작성·관리한다 | High |
| REQ-LABEL-002 | WHEN 사용자가 관할권을 선택하면 THE SYSTEM SHALL FDA/EU MDR/MFDS/PMDA/NMPA별 필수 표시사항 체크리스트를 제공한다 | High |
| REQ-LABEL-003 | WHEN 사용자가 claim 문구를 입력하면 THE SYSTEM SHALL 해당 claim과 근거 citation을 연결하도록 요구한다 | High |
| REQ-LABEL-004 | IF claim이 근거 citation 없이 입력되면 THEN THE SYSTEM SHALL expert review required 상태로 표시하고 경고한다 | High |
| REQ-LABEL-005 | WHEN comparative 또는 superiority claim이 감지되면 THE SYSTEM SHALL 자동 경고를 표시한다 | High |
| REQ-LABEL-006 | IF unsupported claim이 존재하면 THEN THE SYSTEM SHALL export를 제한한다 | High |
| REQ-LABEL-007 | WHEN 번역본이 등록되면 THE SYSTEM SHALL 원본과 번역본 간 의미 차이를 검출하고 RA 승인 게이트를 적용한다 | High |
| REQ-LABEL-008 | WHEN 라벨링 변경이 발생하면 THE SYSTEM SHALL #54 Change Control 항목을 자동 생성하거나 연결한다 | High |
| REQ-LABEL-009 | WHEN 라벨이 최종 승인되면 THE SYSTEM SHALL 승인본을 #65 전자 제출 패키지에 포함한다 | High |
| REQ-LABEL-010 | WHEN 승인·수정·export 이벤트가 발생하면 THE SYSTEM SHALL audit_logs에 기록한다 | High |
| REQ-LABEL-011 | THE SYSTEM SHALL 관할권별 필수 표시사항 체크리스트를 100% 커버한다 | High |
| REQ-LABEL-012 | IF 권한 없는 사용자가 라벨 승인을 시도하면 THEN THE SYSTEM SHALL 접근을 거부한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | FDA/EU/MFDS 필수 라벨링 항목 체크리스트 100% 커버 | unit test (항목 매핑) |
| AC-02 | claim마다 근거 citation 또는 expert review required 상태 강제 | integration test |
| AC-03 | unsupported claim 0건으로 export 제한 동작 | negative test |
| AC-04 | comparative/superiority claim 자동 경고 표시 | unit test |
| AC-05 | 한/영 라벨 의미 차이 검출 및 승인 로그 기록 | integration test |
| AC-06 | 라벨링 변경 → Change Control 자동 생성 또는 연결 | E2E test |
| AC-07 | 승인본이 전자 제출 패키지에 포함됨 | integration test |
| AC-08 | 권한 없는 승인 시도 거부됨 | RBAC negative test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
app/(app)/labeling/                  # 라벨링 워크벤치 UI
lib/labeling/
  section-builder.ts                 # 구조화 섹션 작성기
  claim-validator.ts                 # claim ↔ citation, unsupported/comparative 경고
  jurisdiction-checklist.ts          # 관할권별 필수 표시사항
  translation-diff.ts                # 번역본 의미 차이 검출
lib/db/schema/labeling.ts
```

### 4.2 DB Schema

- `labeling_documents` 테이블: project_id FK, jurisdiction, status, review_status
- `labeling_sections` 테이블: document_id FK, section_type, content, locale
- `labeling_claims` 테이블: section_id FK, claim_text, citation_ref, claim_type(supported|comparative|superiority|unsupported)
- `labeling_translations` 테이블: section_id FK, source_locale, target_locale, semantic_diff_status, approval_status
- `audit_logs` 재사용

### 4.3 API Endpoints

- `POST /api/labeling/documents` — 문서 생성
- `POST /api/labeling/documents/[id]/claims` — claim 입력·검증
- `GET /api/labeling/documents/[id]/checklist?jurisdiction=` — 관할권 체크리스트
- `POST /api/labeling/documents/[id]/translations` — 번역본 등록·diff
- `POST /api/labeling/documents/[id]/approve` — RA 승인 게이트
- `POST /api/labeling/documents/[id]/export` — unsupported claim 0건일 때만 허용

### 4.4 의존성

- #40 Strategy (시장별 claim 전략 입력)
- #42 Crossmarket (관할권별 라벨링 갭 분석)
- #47 Traceability (claim ↔ evidence 연결)
- #54 Change Control (라벨링 변경 영향 평가)
- #65 eSubmit (제출 패키지 포함)
- #64 DHF (설계 산출물 및 변경 이력 연결)
