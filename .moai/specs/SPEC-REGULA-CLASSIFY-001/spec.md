---
id: SPEC-REGULA-CLASSIFY-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 59
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-CHAT-001
  - SPEC-REGULA-BREADTH-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
---

# SPEC-REGULA-CLASSIFY-001 — 의료기기 분류 자동화 마법사 (FDA/EU/MFDS/NMPA/PMDA 통합)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #59 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

모든 규제 제출의 출발점은 의료기기 분류다. 510(k)/PMA/CE/국내허가 중 어느 경로를 밟을지, 제출 비용이 얼마나 들지, 어떤 표준이 적용되는지는 전부 분류에서 결정된다. 현재 Regula는 510(k) 초안기(#22), CER 빌더(#23), PCCP 작성기(#24) 등 제출 도구는 갖추었지만, 그 제출이 필요한지·어떤 제출인지를 결정하는 분류 단계가 빠져 있다.

Regula가 end-to-end RA 플랫폼이 되려면 Classification Wizard가 모든 워크플로우의 진입점이 되어야 한다. 사용자가 기기 용도·작동 원리·환자 접촉 여부 등을 입력하면 FDA/EU MDR/MFDS/NMPA/PMDA 5개 관할권의 분류 결과와 규제 경로를 자동 산출한다.

분류 엔진은 규칙 기반 분류 트리(FDA Product Code DB, EU MDR Annex VIII 규칙 트리, MFDS/NMPA/PMDA 분류 코드 맵)에 RAG 보조를 결합한다. Haiku intent parser로 기기 특성을 추출한 뒤 각 관할권 분류 엔진을 거쳐 결과를 집계하고 ComparisonTable, Timeline, Citations 블록으로 렌더링한다.

분류 결과는 predicate search(#22), CER builder(#23), strategy generator(#40), standards mapping(SPEC-REGULA-STANDARDS-001), SaMD path(SPEC-REGULA-SAMD-001) 등 후속 워크플로우의 입력으로 연계된다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA: 21 CFR 862-892 (Device Classification), Class I/II/III, Product Code, Regulation Number, 510(k)/PMA/De Novo/Exempt 경로
- EU MDR: Regulation (EU) 2017/745 Annex VIII Rules 1-22, Class I/IIa/IIb/III, MDR/IVDR 구분, Notified Body 선정
- MFDS: 의료기기 품목 및 품목별 등급에 관한 규정 (1~4등급)
- NMPA: 의료기기 등급 분류 (1~3등급)
- PMDA: PMD Act 클래스 I~IV
- AI/ML SaMD: SPEC-REGULA-SAMD-001 연계

### 1.3 본 SPEC의 범위 (In Scope)

- 분류 입력 파라미터: intended use 자연어 입력, 신체 접촉 여부(비접촉/외부접촉/내부접촉/이식형), 기기 유형(능동/비능동, SW/HW), AI/ML 구성 요소 여부
- FDA 분류 엔진: Class I/II/III + Exempt/510(k)/PMA 경로 결정, Product Code + Regulation Number 산출, De Novo 경로 식별, predicate 초기 목록 제시
- EU MDR 분류 엔진: Class I/IIa/IIb/III (Annex VIII Rules 1-22), MDR/IVDR 구분, Notified Body 필요 여부
- MFDS/NMPA/PMDA 분류 엔진: 한국·중국·일본 분류 등급 산출, 동등 경로 식별
- 분류 결과 보고서: 5개 관할권 비교표, 예상 타임라인, 핵심 표준 목록, 추정 제출 비용 범위

### 1.4 Out of Scope

- 실제 외부 기관 제출 (SPEC-REGULA-EXTERNAL-001 소관)
- SaMD 세부 경로 분기 (SPEC-REGULA-SAMD-001 소관)
- 표준 개정 추적 (SPEC-REGULA-STANDARDS-001 소관, 본 SPEC은 표준 목록 연계만)

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CLASSIFY-001 | WHEN a user submits an intended-use description in natural language THE SYSTEM SHALL extract device characteristics via the Haiku intent parser. | High |
| REQ-CLASSIFY-002 | WHEN a user specifies body contact THE SYSTEM SHALL accept one of (non-contact / surface-contact / internal-contact / implantable) as a classification parameter. | High |
| REQ-CLASSIFY-003 | WHEN a user specifies device type THE SYSTEM SHALL capture active/non-active and software/hardware attributes. | High |
| REQ-CLASSIFY-004 | IF the device contains an AI/ML component THEN THE SYSTEM SHALL route the SaMD path branch to SPEC-REGULA-SAMD-001. | High |
| REQ-CLASSIFY-005 | WHEN FDA classification runs THE SYSTEM SHALL determine Class I/II/III plus the Exempt/510(k)/PMA path. | High |
| REQ-CLASSIFY-006 | WHEN FDA classification runs THE SYSTEM SHALL produce the Product Code and Regulation Number (21 CFR §). | High |
| REQ-CLASSIFY-007 | WHEN FDA classification runs THE SYSTEM SHALL identify any applicable De Novo path. | Medium |
| REQ-CLASSIFY-008 | WHEN FDA classification produces a result THE SYSTEM SHALL present an initial predicate device list and link to #22 Predicate Search. | Medium |
| REQ-CLASSIFY-009 | WHEN EU MDR classification runs THE SYSTEM SHALL classify Class I/IIa/IIb/III by applying Annex VIII Rules 1-22. | High |
| REQ-CLASSIFY-010 | WHEN EU MDR classification runs THE SYSTEM SHALL distinguish MDR from IVDR. | Medium |
| REQ-CLASSIFY-011 | WHEN EU MDR classification runs THE SYSTEM SHALL determine whether Notified Body selection is required. | High |
| REQ-CLASSIFY-012 | WHEN MFDS/NMPA/PMDA classification runs THE SYSTEM SHALL produce the Korea/China/Japan classification grades. | High |
| REQ-CLASSIFY-013 | WHEN MFDS/NMPA/PMDA classification runs THE SYSTEM SHALL identify each jurisdiction's equivalent path (등가심사, 비교 인증). | Medium |
| REQ-CLASSIFY-014 | WHEN classification completes THE SYSTEM SHALL render a 5-jurisdiction comparison table using the ComparisonTable block. | High |
| REQ-CLASSIFY-015 | WHEN classification completes THE SYSTEM SHALL render an expected regulatory timeline using the Timeline block. | Medium |
| REQ-CLASSIFY-016 | WHEN classification completes THE SYSTEM SHALL list applicable core standards and link to SPEC-REGULA-STANDARDS-001. | Medium |
| REQ-CLASSIFY-017 | WHEN classification completes THE SYSTEM SHALL include citations to the classification basis documents. | High |
| REQ-CLASSIFY-018 | WHEN classification completes THE SYSTEM SHALL automatically link the result to the Submission Lifecycle (#37). | Medium |
| REQ-CLASSIFY-019 | WHEN a user requests 5-jurisdiction classification THE SYSTEM SHALL return a response within 3 seconds. | High |
| REQ-CLASSIFY-020 | WHEN classification results are produced THE SYSTEM SHALL persist them to the device_classifications table. | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | FDA 분류 정확도가 테스트 기기 셋 기준 90% 이상이다. | Test |
| AC-02 | 5개 관할권 동시 분류 응답이 3초 이내이다. | Test |
| AC-03 | 분류 근거 문서 citation이 포함된다. | Test / Review |
| AC-04 | 분류 결과가 Submission Lifecycle (#37)로 자동 연계된다. | Test |
| AC-05 | EU MDR 분류가 Annex VIII Rules 1-22를 적용하여 Class I/IIa/IIb/III를 산출한다. | Test |
| AC-06 | AI/ML 구성 기기는 SaMD 경로 분기(SPEC-REGULA-SAMD-001)로 라우팅된다. | Test |

---

## §4 Technical Approach

### 4.1 파일 구조

- `app/(workflows)/classify/page.tsx` — 분류 마법사 진입 UI
- `app/api/classify/route.ts` — 분류 세션 API
- `lib/classify/intent-parser.ts` — Haiku intent parser (기기 특성 추출)
- `lib/classify/engines/fda.ts` — FDA 분류 엔진 (Product Code DB)
- `lib/classify/engines/eu-mdr.ts` — EU MDR Annex VIII 규칙 트리
- `lib/classify/engines/mfds-nmpa-pmda.ts` — 분류 코드 맵
- `lib/classify/aggregator.ts` — 결과 집계 → ComparisonTable/Timeline/Citations

### 4.2 DB Schema

- `device_classifications` (신규): 분류 결과 저장 (intended_use, parameters JSON, fda_result, eu_result, mfds_result, nmpa_result, pmda_result, citations JSON)
- `classification_rules` (신규): 관할권별 분류 규칙 (버전 관리)
- `product_code_index` (신규): FDA Product Code 인덱스 (CDRH 데이터)

### 4.3 API Endpoints

- `POST /api/classify` — 분류 세션 생성 (입력: device description + parameters)
- `GET /api/classify/[id]` — 분류 결과 조회
- `GET /api/classify/[id]/export` — 분류 보고서 export

### 4.4 의존성

- #22 Predicate Search (분류 결과 → predicate 검색 진입점)
- #23 CER Builder (EU 분류 결과 → CER 범위 결정)
- #40 Strategy Generator (분류 결과 → 전략 생성 입력)
- SPEC-REGULA-STANDARDS-001 (분류 결과 → 적용 표준 매핑)
- SPEC-REGULA-SAMD-001 (AI/ML 구성 → SaMD 경로 분기)
- #37 Submission Lifecycle (자동 연계)
- FDA CDRH Product Code DB, EU MDR Annex VIII 규칙 데이터
