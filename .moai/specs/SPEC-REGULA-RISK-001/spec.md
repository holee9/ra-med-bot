---
id: SPEC-REGULA-RISK-001
version: 1.0.0
status: draft
phase: wave4
priority: Medium
created: 2026-06-20
updated: 2026-06-20
author: manager-spec (Regula harness)
issue_number: 46
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-CER-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
  - component/rag
  - priority/medium
---

# SPEC-REGULA-RISK-001 — ISO 14971 위험관리 통합 (위험 식별·분석 매트릭스·통제 조치 추천)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-20 | manager-spec (Regula harness) | 초기 작성. Wave 4 SPEC, Issue #46 기반. 36 REQ (4 group: 위험 식별 / 분석 매트릭스 / 통제 조치 / 보고서·GSPR). CER Builder(SPEC-REGULA-CER-001) workflow 패턴 재사용. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

**ISO 14971:2019 (Medical devices — Application of risk management to medical devices)** 는 의료기기 전 생애주기에 걸친 위험관리를 의무화하는 국제 표준이다. EU MDR(Regulation (EU) 2017/745) **Annex I (General Safety and Performance Requirements, GSPR)** 의 §3은 제조자가 ISO 14971에 부합하는 위험관리 시스템을 수립·문서화·유지할 것을 명시적으로 요구하며, FDA 역시 510(k)/PMA 심사 시 위험관리 파일(Risk Management File, RMF)을 핵심 검토 자료로 삼는다.

현재 Regula 운영 환경에서 RA 담당자는 다음과 같은 어려움을 겪는다:

- **위험 식별(hazard identification)** 을 수작업 브레인스토밍에 의존하여 누락 위험(특히 기기 특성상 잘 드러나지 않는 use error, software failure)이 빈번하다.
- **위험 분석 매트릭스(severity × probability)** 의 위험도 수준 분류를 일관성 없이 정성적으로 판단한다.
- **ISO 14971:2019 §6.2 위험 통제 계층(risk control option hierarchy)** 순서(inherent safety by design → protective measures → information for safety)를 매번 수동으로 적용해야 한다.
- 유사 기기의 이상사례(MAUDE 등)와 통제 사례를 별도 검색해야 한다.
- ISO 14971 구조에 맞는 **위험관리 보고서** 작성과 EU MDR GSPR 매핑에 1건당 수십 시간이 소요된다.

본 SPEC은 Wave 4에서 위 작업을 **반자동화(semi-automated)** 하는 ISO 14971 위험관리 모듈을 구축한다. 자동화 대상은 (1) 기기 기능 설명 → RAG 기반 위험 식별 목록 생성, (2) 심각도×발생 확률 매트릭스 UI 및 ISO 14971 Annex E 기준 위험도 분류, (3) §6.2 통제 계층 기반 통제 조치 추천 + 잔류 위험 평가, (4) ISO 14971 구조 준수 보고서 DOCX export + EU MDR GSPR 매핑이다.

**법적 책임이 따르는 위험 판단(허용 가능 위험, 잔류 위험 수용, 최종 보고서)은 모두 expert review gate를 통해 RA-lead 승인 후에만 "approved" 상태로 전환된다.** LLM/RAG는 draft 생성과 보조에만 사용되며, 자동 승인은 발생하지 않는다.

### 1.2 규제 근거 (Regulatory Anchor)

- **ISO 14971:2019** — 위험관리 프로세스 전반
  - §5 Risk analysis (위험 분석: 의도된 사용, hazard 식별, 위험 추정)
  - §6 Risk evaluation (위험 평가: 허용 가능 위험 판단)
  - §6.2 (편의상 표기; 2019 판 §7) Risk control option analysis — 통제 계층 우선순위
  - §7 Risk control (통제 조치 실행, 잔류 위험 평가)
  - §8 Evaluation of overall residual risk
  - Annex C — 위험 분석 기법 / Annex E — 위험 개념 (severity/probability 분류 가이드)
- **ISO/TR 24971:2020** — ISO 14971 적용 가이드 (severity/probability 척도 설계 참조)
- **EU MDR Annex I (GSPR)** §1~§9 — 위험 통제 결과와의 매핑 대상
- **ALARP 원칙** (As Low As Reasonably Practicable) — 잔류 위험 수용 판단 기준

> 주의: ISO 14971:2019 판은 통제 조치를 §7로 두고, 통제 옵션 우선순위(inherent safety → protective measures → information for safety)를 §7.1에서 규정한다. Issue #46이 "§6.2"로 표기한 통제 계층 요구사항은 본 SPEC에서 ISO 14971:2019 §7.1의 통제 옵션 우선순위로 해석하여 구현한다. 보고서 섹션 라벨은 사용자가 채택한 판본에 맞춰 설정 가능해야 한다.

### 1.3 본 SPEC의 범위 (In Scope)

- 위험관리 위저드 UI (`app/(app)/workflows/risk/page.tsx`)
- 기기 기능 설명 → RAG 기반 위험 식별 (`lib/risk/hazard-identification.ts`, hybrid-ra-saas `POST /rag/query`)
- 심각도 × 발생 확률 매트릭스 grid UI (`components/risk/RiskMatrix.tsx`)
- ISO 14971 Annex E 기준 위험도 수준 분류 + ALARP 판단 (`lib/risk/risk-evaluation.ts`)
- 통제 조치 추천 (ISO 14971 §7.1 계층 + RAG 유사 사례, `lib/risk/control-recommendation.ts`)
- 잔류 위험 평가 (`lib/risk/residual-risk.ts`)
- ISO 14971 구조 준수 보고서 DOCX export + EU MDR GSPR 매핑 섹션 (`lib/risk/report-builder.ts`)
- expert review gate (모든 위험 판단 RA-lead 승인)
- BFF proxy route handlers (`app/api/ra/risk/*`)
- DB schema 확장 (`risk` workflow type + `risk_items`, `risk_controls`, `risk_gspr_mappings` 테이블)
- promptfoo eval (인슐린 펌프, 인공호흡기 2개 기기 정확도 >85%)

---

## §2 Goals and Non-Goals

### 2.1 Goals

| # | Goal | 성공 지표 (KPI) |
|---|------|-----------------|
| G1 | 기기 기능 설명 → 위험 식별 목록 자동 생성 | 식별 항목 100%에 citation(표준 조항 또는 유사 기기 이상사례) 포함 |
| G2 | 위험 분석 매트릭스 UI | severity(1~5) × probability(1~5) grid + ISO 14971 Annex E 위험도 수준 자동 분류 |
| G3 | 통제 조치 추천 | ISO 14971 §7.1 3계층 순서 강제 + 계층별 ≥1 추천 + RAG 유사 사례 |
| G4 | 잔류 위험 평가 | 통제 후 재산정된 severity×probability + ALARP 판단 100% 기록 |
| G5 | ISO 14971 구조 준수 보고서 DOCX export | 보고서에 ISO 14971 필수 섹션 + EU MDR GSPR 매핑 테이블 포함 |
| G6 | expert review gate | 모든 위험 판단(허용 가능/잔류 위험/최종 보고서)은 RA-lead 승인 후 approved 전환 |
| G7 | promptfoo eval 정확도 | 인슐린 펌프·인공호흡기 위험관리 계획 생성 정확도 >85% |

### 2.2 Non-Goals (Exclusions — What NOT to Build)

> [HARD] 본 SPEC은 다음을 명시적으로 구현 범위에서 제외한다. 이는 범위 이탈(scope creep) 방지를 위한 계약이다.

- **FMEA 자동화 (Failure Mode and Effects Analysis)**: FMEA는 별도 분석 기법으로, RPN(Risk Priority Number) 계산·worksheet 자동화는 본 SPEC 범위 밖이다. 본 SPEC은 ISO 14971 top-down 위험관리만 다룬다.
- **real-time 협업 편집**: 위험 항목/매트릭스의 다중 사용자 동시 편집은 SPEC-REGULA-COEDIT-001 범위이다. 본 SPEC은 단일 편집 세션을 가정한다.
- **위험 라이브러리 관리(reusable hazard library)**: 조직 차원의 재사용 가능한 hazard/control 라이브러리 CRUD·버전 관리는 별도 이슈 범위이다. 본 SPEC은 workflow run 단위 위험 항목만 저장한다.
- **위험 자동 승인(auto-approval)**: 모든 최종 위험 판단은 RA-lead의 명시적 승인이 필요하다. LLM은 draft 생성·보조에만 사용된다.
- **MAUDE/이상사례 DB 직접 실시간 통합**: 유사 기기 이상사례는 hybrid-ra-saas에 색인된 RAG 코퍼스를 통해서만 인용한다. 외부 FDA MAUDE API 실시간 조회는 본 SPEC 범위 밖이다.
- **Notified Body / 규제기관 직접 제출**: 보고서는 DOCX로 출력되어 사용자가 별도 채널로 제출한다. EUDAMED 등 직접 통합은 범위 밖이다.
- **PMS/Vigilance 데이터 자동 통합**: 시판 후 위험 데이터 자동 갱신은 SPEC-REGULA-VIGILANCE 계열 범위이며 본 SPEC은 cross-link만 제공한다.

---

## §3 Functional Requirements (36 REQ, EARS Format)

각 REQ는 다음 구조를 따른다: EARS 문장 / 근거(rationale) / 검증 방법(verification).

### Group A — 위험 식별 지원 (REQ-RISK-001 ~ REQ-RISK-010)

**REQ-RISK-001** (Event-Driven)
WHEN 사용자가 기기 기능 설명 텍스트를 입력하고 "위험 식별 생성"을 실행하면, THEN the system SHALL hybrid-ra-saas `POST /rag/query`를 호출하여 위험 식별 후보 목록(hazard, hazardous situation, harm)을 생성한다.
- 근거: ISO 14971 §5.3 hazard 식별 의무. RAG로 누락 위험 최소화.
- 검증: 기기 설명 입력 → ≥1 위험 항목 반환 통합 테스트.

**REQ-RISK-002** (Ubiquitous)
The system SHALL 모든 위험 식별 항목에 최소 1개의 citation(관련 표준 조항 ID 또는 유사 기기 이상사례 source_id)을 첨부한다.
- 근거: 추적성(traceability)과 근거 기반 위험관리. Issue #46 completion criteria.
- 검증: citation 없는 위험 항목 생성 시도 → 검증 실패(저장 차단) 테스트.

**REQ-RISK-003** (State-Driven)
WHILE 위험 식별 결과가 미검토(draft) 상태인 동안, the system SHALL 해당 위험관리 run을 "approved" 상태로 전환하지 못하도록 차단한다.
- 근거: expert review gate. 미검토 위험 판단의 승인 방지.
- 검증: 미검토 run에 approve 요청 → 422 반환 테스트.

**REQ-RISK-004** (Event-Driven)
WHEN RAG 응답의 confidence가 임계값(기본 0.6) 미만이면, THEN the system SHALL 해당 위험 항목을 "low confidence" 플래그로 표시하고 RA 리드 검토를 강제한다.
- 근거: 저신뢰 자동 생성 결과의 무비판적 채택 방지.
- 검증: confidence<0.6 mock 응답 → low_confidence 플래그 true 단위 테스트.

**REQ-RISK-005** (Optional)
WHERE 기기 분류 정보(device class)가 입력되면, the system SHALL RAG filter에 device class를 전달하여 위험 식별 정확도를 높인다.
- 근거: 분류별 위험 프로파일 차이 반영.
- 검증: filter 파라미터가 RAG 요청에 포함되는지 단위 테스트.

**REQ-RISK-006** (Ubiquitous)
The system SHALL 각 위험 항목을 ISO 14971 용어 체계(hazard / sequence of events / hazardous situation / harm)로 구조화하여 저장한다.
- 근거: ISO 14971 §3 용어 정의 준수.
- 검증: 위험 항목 스키마 필드 존재 검증.

**REQ-RISK-007** (Event-Driven)
WHEN 사용자가 자동 생성된 위험 항목을 수정·삭제·추가하면, THEN the system SHALL 변경을 즉시 저장하고 audit_logs에 `risk.item.edit` 액션을 기록한다.
- 근거: 21 CFR Part 11 감사 추적. 사용자 override 100% 보장.
- 검증: 위험 항목 수정 → audit_logs 기록 통합 테스트.

**REQ-RISK-008** (Unwanted)
IF 사용자가 위험 식별 단계를 건너뛰고 위험 분석(매트릭스) 단계로 진행하려 하면, THEN the system SHALL 진행을 차단하고 "위험 항목 ≥1개 필요" 메시지를 표시한다.
- 근거: 빈 위험 분석 방지. 단계 순서 강제.
- 검증: 위험 항목 0개 상태 → 분석 단계 진입 차단 테스트.

**REQ-RISK-009** (State-Driven)
WHILE 위험 식별 결과를 표시하는 동안, the system SHALL 각 항목별로 출처 citation을 클릭 가능한 형태로 렌더링한다.
- 근거: 검토자의 근거 확인 편의.
- 검증: citation 클릭 → source 상세 표시 E2E 테스트.

**REQ-RISK-010** (Ubiquitous)
The system SHALL 위험 식별 RAG 호출 시 `audit_logs`에 `risk.identify.generate` 액션과 RAG confidence를 기록한다.
- 근거: LLM 호출 추적성.
- 검증: 식별 생성 → audit 기록 확인 테스트.

### Group B — 위험 분석 매트릭스 (REQ-RISK-011 ~ REQ-RISK-020)

**REQ-RISK-011** (Ubiquitous)
The system SHALL 심각도(severity, 1~5) × 발생 확률(probability, 1~5)의 5×5 grid 매트릭스 UI를 제공한다.
- 근거: ISO 14971 §5.5 위험 추정. Annex E 척도.
- 검증: RiskMatrix 컴포넌트 25셀 렌더링 컴포넌트 테스트.

**REQ-RISK-012** (Event-Driven)
WHEN 사용자가 위험 항목의 severity와 probability를 선택하면, THEN the system SHALL ISO 14971 Annex E 기준 위험도 수준(예: acceptable / ALARP / unacceptable)을 자동 분류하여 표시한다.
- 근거: 일관된 위험도 분류. 정성 판단 편차 제거.
- 검증: (severity=5, probability=4) → "unacceptable" 분류 단위 테스트.

**REQ-RISK-013** (Ubiquitous)
The system SHALL 위험도 수준 분류 임계값(risk acceptability matrix)을 조직 설정으로 구성 가능하게 한다.
- 근거: ISO/TR 24971 — 척도·임계값은 제조자가 정의. 조직별 정책 반영.
- 검증: 임계값 설정 변경 → 분류 결과 반영 단위 테스트.

**REQ-RISK-014** (State-Driven)
WHILE 위험도가 "unacceptable" 또는 "ALARP" 인 동안, the system SHALL 해당 위험 항목에 통제 조치 입력을 강제(required)한다.
- 근거: ISO 14971 §7 — 허용 불가/ALARP 위험은 통제 필요.
- 검증: unacceptable 항목에 통제 없이 진행 → 차단 테스트.

**REQ-RISK-015** (Event-Driven)
WHEN 사용자가 위험 항목의 허용 가능 위험(acceptable) 여부를 판단하면, THEN the system SHALL ALARP 원칙 적용 근거(justification) 텍스트 입력을 요구한다.
- 근거: ALARP 판단의 문서화 의무.
- 검증: 허용 판단 시 justification 미입력 → 저장 차단 테스트.

**REQ-RISK-016** (Ubiquitous)
The system SHALL 매트릭스를 색상 코딩(녹/황/적)으로 위험도 수준을 시각화한다.
- 근거: 검토자의 직관적 위험 인지.
- 검증: 위험도별 셀 색상 클래스 컴포넌트 테스트.

**REQ-RISK-017** (Event-Driven)
WHEN 다수 위험 항목이 동일 (severity, probability) 셀에 위치하면, THEN the system SHALL 해당 셀에 항목 수를 배지로 표시한다.
- 근거: 위험 집중 영역 가시화.
- 검증: 동일 셀 2개 항목 → "2" 배지 렌더링 테스트.

**REQ-RISK-018** (Unwanted)
IF 사용자가 severity 또는 probability를 정의된 범위(1~5) 밖 값으로 설정하려 하면, THEN the system SHALL 입력을 거부한다.
- 근거: 척도 무결성.
- 검증: severity=6 입력 → 검증 실패 단위 테스트.

**REQ-RISK-019** (State-Driven)
WHILE 위험 분석 결과가 미검토 상태인 동안, the system SHALL 매트릭스 분류 결과를 잠정(provisional)으로 표시한다.
- 근거: 미승인 분류의 확정 오인 방지.
- 검증: 미검토 run → provisional 라벨 표시 E2E 테스트.

**REQ-RISK-020** (Ubiquitous)
The system SHALL 각 위험 항목의 severity·probability·위험도 수준 변경 이력을 audit_logs에 `risk.analysis.update` 액션으로 기록한다.
- 근거: 위험 판단 추적성.
- 검증: severity 변경 → audit 기록 테스트.

### Group C — 위험 통제 조치 추천 (REQ-RISK-021 ~ REQ-RISK-030)

**REQ-RISK-021** (Event-Driven)
WHEN 사용자가 위험 항목에 대한 통제 조치 추천을 요청하면, THEN the system SHALL ISO 14971 §7.1 통제 옵션 우선순위(inherent safety by design → protective measures → information for safety) 3계층 각각에 대해 통제 후보를 생성한다.
- 근거: ISO 14971 §7.1 — 통제 옵션은 우선순위 순서로 고려해야 함.
- 검증: 통제 추천 → 3계층 모두 반환 통합 테스트.

**REQ-RISK-022** (Ubiquitous)
The system SHALL 통제 조치 추천 시 hybrid-ra-saas RAG를 통해 유사 기기의 통제 사례를 인용(citation 포함)하여 함께 제시한다.
- 근거: 근거 기반 통제 설계. Issue #46 §C.
- 검증: 통제 추천 응답에 RAG citation 포함 테스트.

**REQ-RISK-023** (State-Driven)
WHILE 통제 옵션 우선순위를 적용하는 동안, the system SHALL information for safety(라벨/IFU)를 단독 통제로 채택할 경우 상위 계층(inherent/protective) 미적용 사유 입력을 요구한다.
- 근거: ISO 14971 §7.1 — 정보 제공은 최후 수단. 상위 계층 우선 검토 의무.
- 검증: information-only 통제 선택 + 사유 미입력 → 저장 차단 테스트.

**REQ-RISK-024** (Event-Driven)
WHEN 사용자가 통제 조치를 채택하면, THEN the system SHALL 통제 후 잔류 위험(residual severity × residual probability)을 재산정하도록 요구한다.
- 근거: ISO 14971 §7.4 — 통제 후 잔류 위험 평가 의무.
- 검증: 통제 채택 → residual risk 입력 필드 활성화 E2E 테스트.

**REQ-RISK-025** (State-Driven)
WHILE 잔류 위험이 여전히 "unacceptable" 인 동안, the system SHALL 추가 통제 조치 또는 위험/편익 분석(risk-benefit analysis) 근거를 요구한다.
- 근거: ISO 14971 §7.4/§8 — 허용 불가 잔류 위험은 추가 통제 또는 편익 정당화 필요.
- 검증: residual unacceptable + 추가 통제·편익 미입력 → 차단 테스트.

**REQ-RISK-026** (Ubiquitous)
The system SHALL 각 통제 조치를 그것이 완화하는 위험 항목과 연결(traceability)하여 저장한다.
- 근거: ISO 14971 — 위험-통제 추적성. RMF 무결성.
- 검증: 통제 ↔ 위험 항목 FK 관계 스키마 검증.

**REQ-RISK-027** (Event-Driven)
WHEN 새 통제 조치가 새로운 위험(통제 자체가 유발하는 위험)을 발생시킬 수 있으면, THEN the system SHALL "통제 유발 위험" 여부 확인을 사용자에게 요청한다.
- 근거: ISO 14971 §7.2 — 통제 조치가 새 위험을 만들 수 있음.
- 검증: 통제 채택 → 신규 위험 확인 프롬프트 표시 테스트.

**REQ-RISK-028** (Unwanted)
IF 통제 옵션 우선순위 3계층 모두에서 통제 후보가 0개로 생성되면, THEN the system SHALL 자동 추천 실패를 명시하고 수동 입력으로 fallback한다.
- 근거: RAG/LLM 실패 시 graceful degradation. 작업 중단 방지.
- 검증: 빈 통제 mock 응답 → 수동 입력 fallback UI 표시 테스트.

**REQ-RISK-029** (Ubiquitous)
The system SHALL 통제 조치의 채택/거부 결정과 사유를 audit_logs에 `risk.control.decide` 액션으로 기록한다.
- 근거: 통제 결정 추적성.
- 검증: 통제 채택 → audit 기록 테스트.

**REQ-RISK-030** (State-Driven)
WHILE 통제 조치 결과가 미검토 상태인 동안, the system SHALL 잔류 위험 평가 결과를 잠정으로 표시하고 보고서 export를 "draft" 워터마크로 제한한다.
- 근거: 미승인 통제·잔류 위험의 확정본 오인 방지.
- 검증: 미검토 run export → draft 워터마크 포함 E2E 테스트.

### Group D — 위험관리 보고서 생성 및 GSPR 매핑 (REQ-RISK-031 ~ REQ-RISK-036)

**REQ-RISK-031** (Event-Driven)
WHEN 사용자가 위험관리 보고서 export를 요청하면, THEN the system SHALL ISO 14971 구조(위험관리 계획 / 위험 분석 / 위험 평가 / 위험 통제 / 전체 잔류 위험 평가 / 결론)를 준수하는 DOCX 문서를 생성한다.
- 근거: ISO 14971 — RMF 구조. Issue #46 completion criteria.
- 검증: export → DOCX 내 ISO 14971 필수 섹션 존재 통합 테스트.

**REQ-RISK-032** (Ubiquitous)
The system SHALL 보고서에 EU MDR GSPR(General Safety and Performance Requirements) 매핑 섹션을 포함하여, 각 식별 위험·통제를 해당 GSPR 항목과 연결한 테이블을 생성한다.
- 근거: EU MDR Annex I 적합성 입증. Issue #46 §D.
- 검증: export → DOCX 내 GSPR 매핑 테이블 존재 테스트.

**REQ-RISK-033** (Ubiquitous)
The system SHALL 보고서 내 모든 위험 항목에 citation(관련 표준 조항 또는 유사 기기 이상사례)을 표기한다.
- 근거: 근거 추적성. Issue #46 §D.
- 검증: export → 위험 항목별 citation 표기 테스트.

**REQ-RISK-034** (State-Driven)
WHILE 위험관리 run이 RA-lead의 expert review를 통과(approved)하지 않은 동안, the system SHALL 보고서 DOCX에 "DRAFT — Not Approved" 워터마크를 강제 삽입한다.
- 근거: expert review gate. 미승인 보고서의 제출용 오인 방지.
- 검증: 미승인 export → 워터마크 포함 / 승인 후 export → 워터마크 제거 E2E 테스트.

**REQ-RISK-035** (Event-Driven)
WHEN RA-lead가 위험관리 run을 승인(approve)하면, THEN the system SHALL workflow_runs.status를 approved로 전환하고 audit_logs에 `risk.approve` 액션을 기록한다.
- 근거: expert review gate 완결. 승인 추적성.
- 검증: RA-lead 승인 → status=approved + audit 기록 통합 테스트.

**REQ-RISK-036** (Unwanted)
IF RA-member(비 RA-lead) 사용자가 위험관리 run 승인을 시도하면, THEN the system SHALL 권한 거부(403)를 반환하고 audit_logs에 `rbac.permission_deny`를 기록한다.
- 근거: RBAC. 승인 권한은 RA-lead 전용. Issue #46 — expert review gate.
- 검증: ra-member 승인 요청 → 403 + audit 기록 통합 테스트.

---

## §4 Acceptance Criteria

Issue #46 completion criteria에 1:1 대응한다. 상세 Given-When-Then 시나리오는 `acceptance.md` 참조.

| # | Completion Criteria | 대응 REQ | 검증 방법 |
|---|---------------------|----------|-----------|
| AC1 | 기기 기능 설명 → 위험 식별 목록 자동 생성 (citation 포함) | REQ-RISK-001, 002 | 통합 테스트 + E2E |
| AC2 | 위험도 매트릭스 UI (심각도 × 발생 확률 grid) | REQ-RISK-011, 012, 016 | 컴포넌트 + E2E |
| AC3 | 위험 통제 조치 추천 (ISO 14971:2019 기준) | REQ-RISK-021, 022, 023 | 통합 테스트 |
| AC4 | ISO 14971 구조 준수 보고서 DOCX export | REQ-RISK-031 | 통합 테스트 |
| AC5 | EU MDR GSPR 매핑 섹션 포함 | REQ-RISK-032 | 통합 테스트 |
| AC6 | expert review gate (모든 위험 판단 RA-lead 검토 필수) | REQ-RISK-003, 034, 035, 036 | 통합 + E2E |
| AC7 | promptfoo eval: 인슐린 펌프·인공호흡기 정확도 >85% | G7 | promptfoo eval suite |

---

## §5 Implementation Notes

- **Workflow 패턴**: `workflowRuns` 테이블에 `risk` workflow type을 추가하여 CER Builder(SPEC-REGULA-CER-001)와 동일한 multi-step run 모델을 재사용한다. 위험 항목·통제·GSPR 매핑은 `workflow_runs.id`를 FK로 하는 child 테이블에 저장한다.
- **RAG 통합**: `lib/api/hybrid-ra-client.ts`의 `createHybridRaFetch` + `RagQueryRequest/RagQueryResponse` 타입을 재사용한다. 신규 클라이언트 추가 없이 기존 BFF 패턴(`app/api/ra/checklists/*` 참조)을 따른다.
- **DOCX export**: 기존 `docx@^9.7.1` 패키지를 사용한다 (CER Builder와 동일).
- **권한**: `lib/auth/with-permission.ts`로 route를 감싼다. 신규 permission: `risk.generate`, `risk.view`, `risk.update`, `risk.approve` (RA-lead 전용).
- **Audit**: 신규 audit action — `risk.identify.generate`, `risk.item.edit`, `risk.analysis.update`, `risk.control.decide`, `risk.approve`, `risk.export`. `auditActionEnum` 확장 필요.
- **DB 마이그레이션**: `lib/db/migrations/` 다음 번호로 `risk` enum 값 추가 + 3개 신규 테이블 + RLS 정책 + audit action 추가.

---

## §6 Risks

| # | Risk | 영향 | 완화 방안 |
|---|------|------|-----------|
| R1 | RAG 위험 식별 정확도 부족 (false negative) | High | expert review gate 강제 + low_confidence 플래그 + promptfoo eval >85% 게이트 |
| R2 | ISO 14971:2019 vs 이전 판 §번호 혼동 | Medium | 보고서 섹션 라벨 설정화(§1.2 주의 참조), 통제 계층 우선순위 고정 |
| R3 | severity/probability 척도 임계값 조직별 차이 | Medium | REQ-RISK-013 — 임계값 조직 설정화 |
| R4 | GSPR 매핑 자동화의 부정확 | High | 매핑은 draft 보조만, RA-lead 검토 후 확정. 자동 승인 금지 |
| R5 | DOCX 대용량 보고서 성능 | Low | 서버 측 생성 + 스트리밍, CER Builder export 패턴 재사용 |

---

## §7 Dependencies

- **SPEC-REGULA-FOUNDATION-001**: `workflow_runs`, `expert_reviews`, `audit_logs`, RBAC, RLS 기반 스키마
- **SPEC-REGULA-WORKFLOWS-001**: workflow run 실행·검토 lifecycle
- **SPEC-REGULA-DOCINGEST-001**: RAG 코퍼스(표준 조항, 이상사례) 색인
- **SPEC-REGULA-CER-001**: DOCX export 패턴, expert review gate, workflow child 테이블 패턴 (참조 구현)

---

Version: 1.0.0
Issue: #46
Status: draft (pending RA-lead annotation review)
