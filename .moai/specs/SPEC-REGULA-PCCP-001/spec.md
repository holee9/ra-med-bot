---
id: SPEC-REGULA-PCCP-001
version: 1.0.0
status: completed
phase: wave3
priority: High
created: 2026-05-04
updated: 2026-05-04
author: manager-spec (Regula harness)
issue_number: null
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-RADAR-001
lifecycle_level: spec-anchored
---

# SPEC-REGULA-PCCP-001 — FDA Predetermined Change Control Plan Builder

## HISTORY

| Version | Date | Author | Change Summary |
|---------|------|--------|----------------|
| v0.1.0 | 2026-05-04 | manager-spec (Regula harness) | 초기 초안 — Wave 3 PCCP Builder SPEC 생성 (REQ-PCCP-001 ~ REQ-PCCP-025, 3개 그룹: Modification Protocol / SPS+ACP / Output+Audit) |

---

## §1. 목적 (Purpose)

본 SPEC은 Regula RA OS의 **Wave 3** 핵심 산출물로서, FDA의 **Predetermined Change Control Plan (PCCP)** 작성·검증·감사 추적을 자동화하는 빌더 시스템을 정의한다.

### 1.1 PCCP란 무엇인가

**PCCP (Predetermined Change Control Plan)**는 FDA가 AI/ML 기반 SaMD(Software as a Medical Device)에 대해 신규 시판 후 알고리즘이 학습·진화하는 특성을 인정하면서도 안전성·유효성을 유지하기 위해 도입한 사전 변경 통제 계획이다. PCCP가 510(k) 또는 De Novo 신청에 포함·승인되면, 제조사는 PCCP 범위 내의 알고리즘 변경에 대해 **새로운 시판 신청 없이도** 변경을 적용할 수 있다.

### 1.2 왜 AI/ML SaMD에 PCCP가 필요한가

전통적 의료기기는 시판 후 설계가 동결(locked)되지만, AI/ML 기반 SaMD는 실세계 데이터로 재학습되며 성능이 진화한다. 매 재학습마다 510(k) 재신청을 요구하면 혁신 속도가 저해되고, 통제 없이 변경을 허용하면 안전성이 위협받는다. PCCP는 이 두 극단 사이에서 **사전에 합의된 변경 범위·방법·검증 기준**을 정의함으로써 균형을 제공한다.

### 1.3 FDA 가이던스 근거

본 SPEC은 다음 FDA 가이던스를 기준으로 작성된다:

- **"Marketing Submission Recommendations for a Predetermined Change Control Plan for Artificial Intelligence/Machine Learning (AI/ML)-Enabled Device Software Functions"** (FDA Final Guidance, 2024년 4월)
- 21 CFR Part 11 (Electronic Records and Electronic Signatures)
- IMDRF Software as a Medical Device 프레임워크

### 1.4 본 SPEC의 범위

PCCP Builder는 RA 사용자가 **4-단계 위저드**를 통해 PCCP의 4개 핵심 컴포넌트(Description of Modifications, Modification Protocol, Impact Assessment, Performance Testing Protocol)를 작성하고, FDA 제출 형식에 맞게 export하며, 모든 작성·검토·승인 이벤트를 21 CFR Part 11 호환 audit log로 기록할 수 있도록 지원한다.

---

## §2. 목표 및 비목표 (Goals and Non-Goals)

### 2.1 Goals

- **G1**: FDA 2024-04 PCCP 가이던스의 4개 필수 컴포넌트(Description of Modifications, Modification Protocol/SPS+ACP, Impact Assessment, Performance Testing Protocol)를 빠짐없이 생성하는 구조화된 위저드 제공
- **G2**: PCCP 작성 시 FOUNDATION의 audit_logs 스키마와 통합하여 21 CFR Part 11 준수 감사 추적 보장
- **G3**: DOCINGEST 코퍼스의 기존 510(k) 문서를 자동 참조하여 PCCP 템플릿을 사전 채움(pre-population)
- **G4**: RADAR가 감지하는 FDA AI/ML 가이던스 업데이트를 PCCP 빌더 UI에 배너 형태로 노출하여 가이던스 변경 대응
- **G5**: PCCP 4개 컴포넌트의 완결성(completeness) 검증 — section coverage SLO 100% 달성
- **G6**: WORKFLOWS의 workflow_runs 테이블과 통합하여 PCCP를 일반 워크플로우(510(k) Drafter, Audit Response 등)와 동일한 추적 체계로 관리

### 2.2 Non-Goals

- **NG1**: AI/ML 모델 자체의 재학습·평가 자동화 — Regula는 PCCP 문서화 시스템이며, 실제 재학습은 제조사의 ML Ops 시스템에서 수행
- **NG2**: PCCP의 FDA 직접 제출(eSTAR/eCopy 통합) — Wave 3 범위 외, 향후 별도 SPEC에서 검토
- **NG3**: PCCP 외의 변경 통제 메커니즘(예: Change Protocol, Special 510(k)) — 본 SPEC은 PCCP에 한정
- **NG4**: 다국가 규제(EU MDR, KFDA, PMDA 등)의 변경 통제 — Wave 4+에서 별도 SPEC으로 다룸
- **NG5**: PCCP 승인 후 실제 알고리즘 배포 자동화(CI/CD 통합) — 제조사 인프라 책임

---

## §3. 기능 요구사항 (Functional Requirements)

본 섹션은 EARS(Easy Approach to Requirements Syntax) 형식의 25개 요구사항을 3개 그룹으로 정의한다.

### Group A — Modification Protocol Builder (REQ-PCCP-001 ~ REQ-PCCP-010)

#### REQ-PCCP-001: PCCP Document Structure

**EARS**: The system SHALL generate a PCCP document containing the FDA-required 4 components: (1) Description of Modifications, (2) Modification Protocol, (3) Impact Assessment, (4) Performance Testing Protocol. Structure compliant with FDA guidance "Marketing Submission Recommendations for a PCCP for AI/ML-Based SaMD" (April 2024).

- **근거**: FDA 2024-04 가이던스 §III에서 PCCP의 4개 구성요소를 명시적으로 요구. 누락 시 FDA RTA(Refuse to Accept) 가능성.
- **검증 방법**: PCCP 생성 후 4개 컴포넌트 섹션이 모두 존재하는지 자동 검증; 누락 시 export 차단.

#### REQ-PCCP-002: Modification Description

**EARS**: The system SHALL provide a structured form for entering planned modifications: (a) modification type (algorithm change / training data change / intended use expansion / performance improvement), (b) modification description, (c) rationale for modification, (d) expected performance impact.

- **근거**: FDA 가이던스 §III.A에서 변경의 명확한 기술과 합리적 근거 요구.
- **검증 방법**: 4개 필드 모두 미입력 시 다음 단계 진행 차단; 자동화된 form-level validation.

#### REQ-PCCP-003: Software Pre-Specifications (SPS)

**EARS**: The system SHALL generate an SPS document defining: (a) performance metrics thresholds (sensitivity, specificity, AUC, etc.), (b) reference standard, (c) training/test data characteristics, (d) input specification, (e) output specification. SPS SHALL use the same format as FDA-cleared device's original SPS.

- **근거**: FDA 가이던스 §III.B.1 — SPS는 변경 후에도 유지되어야 할 성능 한계를 사전에 정의.
- **검증 방법**: SPS 생성 후 5개 필드 모두 존재 검증; DOCINGEST에서 원 510(k) SPS 자동 참조 확인.

#### REQ-PCCP-004: Algorithm Change Protocol (ACP)

**EARS**: The system SHALL generate an ACP defining: (a) trigger conditions for retraining, (b) retraining data requirements, (c) performance evaluation protocol, (d) comparison to baseline performance, (e) deployment criteria (performance threshold must be met before deployment).

- **근거**: FDA 가이던스 §III.B.2 — ACP는 재학습 트리거·방법·검증·배포 기준을 사전 정의.
- **검증 방법**: ACP의 5개 컴포넌트 자동 존재 검증; deployment criteria가 SPS thresholds와 일치하는지 cross-check.

#### REQ-PCCP-005: Impact Assessment

**EARS**: The system SHALL prompt the user to assess impact on: (a) intended use, (b) indications for use, (c) technological characteristics, (d) clinical safety profile, (e) user interface. Each dimension SHALL have radio buttons: "Substantially Equivalent" / "Modified — review required".

- **근거**: FDA 가이던스 §III.C — substantial equivalence 5대 차원 평가는 PCCP 적용 가능 여부 판단의 핵심.
- **검증 방법**: 5개 차원 모두 라디오 선택 강제; 미선택 시 다음 단계 차단.

#### REQ-PCCP-006: Substantial Equivalence Gate

**EARS**: WHEN impact assessment reveals any "Modified — review required" dimension, the system SHALL display a warning: "This modification may require a new 510(k) submission or De Novo request rather than PCCP implementation. Consult your RA advisor."

- **근거**: PCCP는 substantial equivalence 유지가 전제. 위반 시 새로운 시판 신청 필요.
- **검증 방법**: Impact Assessment Step 5에서 "Modified" 1개 이상 선택 시 경고 배너 표시 통합 테스트.

#### REQ-PCCP-007: PCCP Scope Boundary

**EARS**: The system SHALL include a mandatory Scope section defining which types of modifications are WITHIN PCCP scope vs. which require new marketing submission. System SHALL provide a decision tree based on FDA guidance.

- **근거**: FDA 가이던스에서 PCCP 범위 외 변경(예: intended use 확대)은 별도 신청 필요.
- **검증 방법**: Scope 섹션 텍스트가 FDA 가이던스 표준 항목 6개 이상 포함하는지 lint; decision tree UI 동작 확인.

#### REQ-PCCP-008: PCCP Template Pre-population

**EARS**: The system SHALL pre-populate PCCP templates using the device information from DOCINGEST (the manufacturer's existing 510(k) documentation, if available in the corpus).

- **근거**: 사용자 입력 부담 경감 및 기존 승인 문서와의 일관성 확보.
- **검증 방법**: DOCINGEST에 원 510(k)가 있는 경우 device name/intended use/SPS 자동 채움 확인; 없는 경우 빈 템플릿 폴백.

#### REQ-PCCP-009: PCCP Completeness Validation

**EARS**: Before export, the system SHALL validate that all 4 PCCP components are present and each has minimum required sections. Missing required sections SHALL be flagged with specific section names.

- **근거**: FDA 제출 전 RTA 위험 방지. Section coverage SLO 100% 달성 필수.
- **검증 방법**: `lib/pccp/validator.ts`의 단위 테스트 — 4개 컴포넌트 누락 시나리오, 부분 누락 시나리오 모두 검증.

#### REQ-PCCP-010: PCCP Version Management

**EARS**: Each device SHALL maintain a PCCP version history. When a PCCP is submitted and cleared, the current version SHALL be marked "active". Subsequent modifications generate new PCCP versions.

- **근거**: PCCP는 시간이 지나며 진화 — 어느 버전이 현재 유효한지 명확해야 함.
- **검증 방법**: `pccp_versions` 관계 테이블에서 동일 device당 active=true 레코드가 정확히 1개임을 검증하는 DB 제약 + 단위 테스트.

---

### Group B — SPS and Algorithm Change Protocol (REQ-PCCP-011 ~ REQ-PCCP-018)

#### REQ-PCCP-011: Performance Metric Definition

**EARS**: The system SHALL provide a library of standard performance metrics (sensitivity, specificity, PPV, NPV, AUC-ROC, RMSE, MAE, etc.) with standardized definitions. User selects applicable metrics from the library.

- **근거**: 메트릭 정의의 일관성 및 FDA 검토관과의 용어 호환성.
- **검증 방법**: `lib/pccp/templates/metrics-library.ts`에 최소 10개 메트릭 정의; UI multi-select 동작 확인.

#### REQ-PCCP-012: Performance Threshold Enforcement

**EARS**: The system SHALL require user to set minimum performance thresholds for each selected metric. The ACP SHALL specify that deployment is blocked if any threshold is not met post-retraining.

- **근거**: PCCP의 핵심 안전 메커니즘 — 성능 저하 시 자동 배포 차단.
- **검증 방법**: 메트릭 선택 후 임계값 미입력 시 다음 단계 차단; ACP 텍스트에 deployment block 조항 자동 삽입 확인.

#### REQ-PCCP-013: Data Characteristics Specification

**EARS**: The system SHALL provide structured forms for specifying training data: (a) data source description, (b) demographics (age, sex, race), (c) geographic scope, (d) temporal scope, (e) data volume, (f) class distribution.

- **근거**: FDA 가이던스 §III.B.1 — bias 평가 및 generalizability 확보 핵심.
- **검증 방법**: 6개 필드 모두 입력 강제; demographics는 sub-form으로 age range/sex/race 분리 입력 검증.

#### REQ-PCCP-014: PCCP-RADAR Integration

**EARS**: The system SHALL monitor RADAR (SPEC-REGULA-RADAR-001) for FDA AI/ML guidance updates. When RADAR detects a relevant update, the PCCP builder SHALL display a banner: "FDA AI/ML guidance may have been updated. Review PCCP templates for compliance."

- **근거**: 본 SPEC §6 R1 — FDA PCCP 가이던스 변경 위험 대응. RADAR가 이미 가이던스 변경 감지 인프라 보유.
- **검증 방법**: RADAR 분류 결과에 "AI/ML" 또는 "PCCP" tag가 있을 때 PCCP 빌더 페이지에 배너 렌더링되는지 통합 테스트.

#### REQ-PCCP-015: Algorithm Change Trigger Logging

**EARS**: The system SHALL record each retraining trigger event as `audit_action = 'pccp_algorithm_change_triggered'` with: trigger condition, performance delta from baseline, and approver identity.

- **근거**: 21 CFR Part 11 — 모든 알고리즘 변경 이벤트는 누가/언제/왜 기록.
- **검증 방법**: audit_logs 테이블에 해당 action 레코드 생성 단위 테스트; 3개 메타데이터 필드 모두 기록 검증.

#### REQ-PCCP-016: Retraining Approval Workflow

**EARS**: The system SHALL implement a workflow for retraining approval: (1) RA user initiates retraining request, (2) System validates performance testing protocol completion, (3) Expert review required before deployment, (4) Deployment approval recorded in audit_logs.

- **근거**: FDA 가이던스 — 재학습은 사전 정의된 프로토콜 완수 후 전문가 승인 필요.
- **검증 방법**: 4단계 상태 머신(initiated → validated → reviewed → approved) E2E 테스트; 단계 건너뛰기 시도 차단 확인.

#### REQ-PCCP-017: Performance Testing Protocol

**EARS**: The system SHALL generate a Performance Testing Protocol document specifying: test dataset characteristics, evaluation methodology, statistical analysis plan, success/failure criteria, comparison to locked baseline.

- **근거**: FDA 가이던스 §III.D — 변경 후 성능 검증 프로토콜은 PCCP 4개 컴포넌트 중 하나.
- **검증 방법**: Performance Testing Protocol 컴포넌트 생성 시 5개 필드 자동 검증; baseline 누락 시 export 차단.

#### REQ-PCCP-018: Baseline Performance Snapshot

**EARS**: The system SHALL capture and store the device's baseline performance metrics at time of 510(k) clearance as the reference point for all PCCP modifications.

- **근거**: 모든 변경은 baseline 대비 평가되어야 함 — 일관된 비교 기준 필요.
- **검증 방법**: baseline snapshot 저장 시 timestamp + cleared_510k_id 필수 필드 검증; 한 device당 baseline 1개 제약.

---

### Group C — Output and Audit (REQ-PCCP-019 ~ REQ-PCCP-025)

#### REQ-PCCP-019: PCCP Export

**EARS**: The system SHALL export the complete PCCP as DOCX and PDF. Draft PCCP SHALL include "DRAFT — NOT FOR REGULATORY SUBMISSION" watermark.

- **근거**: 미완성 문서가 실수로 FDA 제출되는 것 방지.
- **검증 방법**: status=draft인 PCCP export 시 워터마크 텍스트 포함 시각적 검증; status=approved 시 워터마크 제거 확인.

#### REQ-PCCP-020: FDA Submission Format

**EARS**: Exported PCCP SHALL follow the section ordering and naming conventions specified in FDA guidance "Marketing Submission Recommendations for a PCCP for AI/ML-Based SaMD" (April 2024).

- **근거**: FDA 검토관의 검토 효율 및 RTA 위험 최소화.
- **검증 방법**: 생성된 DOCX의 섹션 헤딩 추출 후 FDA 가이던스 표준 순서와 일치 확인 단위 테스트.

#### REQ-PCCP-021: PCCP Creation Audit

**EARS**: The system SHALL record `audit_action = 'pccp_created'` with device name and indication at PCCP creation.

- **근거**: 21 CFR Part 11 — 모든 규제 문서 생성은 감사 기록.
- **검증 방법**: PCCP 생성 API 호출 시 audit_logs에 해당 레코드 생성 통합 테스트.

#### REQ-PCCP-022: Component Completion Audit

**EARS**: The system SHALL record `audit_action = 'pccp_component_completed'` for each of the 4 components, with component name and completion timestamp.

- **근거**: 작성 진행 상황 추적 및 책임 소재 명확화.
- **검증 방법**: 4개 컴포넌트 각각 완료 시 audit_logs 레코드 4개 생성 E2E 테스트.

#### REQ-PCCP-023: Expert Approval Audit

**EARS**: The system SHALL record `audit_action = 'pccp_expert_approved'` when expert review is completed, with reviewer identity and timestamp, compliant with 21 CFR Part 11.

- **근거**: 전자서명 동등 효력 확보 — 21 CFR Part 11 §11.50 요구사항.
- **검증 방법**: expert 권한 사용자가 approve 액션 수행 시 audit_logs에 reviewer_id + signed_at 필드 함께 기록 검증.

#### REQ-PCCP-024: PCCP Submission Tracking

**EARS**: The system SHALL track PCCP submission status: draft / submitted / cleared / superseded. Status transitions SHALL be logged as audit events.

- **근거**: PCCP 생애주기 관리 — 어느 PCCP가 현재 유효한지 명확화.
- **검증 방법**: 4개 상태 전이 테이블 정의 + 잘못된 전이(예: cleared → draft) 차단 단위 테스트.

#### REQ-PCCP-025: workflow_runs Integration

**EARS**: The system SHALL store each PCCP as a `workflow_runs` record with `workflow_type = 'pccp'`, linked to the device's prior 510(k) submission workflow if available.

- **근거**: WORKFLOWS와의 일관성 — PCCP를 별도 추적 체계가 아닌 일반 워크플로우로 통합 관리.
- **검증 방법**: PCCP 생성 시 workflow_runs INSERT 확인; parent_workflow_id가 510(k) workflow_run을 참조하는지 검증.

---

## §4. 수락 기준 (Acceptance Criteria)

본 SPEC의 구현 완료는 다음 12개 기준을 모두 만족해야 한다:

1. **AC-1**: PCCP 빌더 위저드가 4단계(Modification Description → SPS+ACP → Impact Assessment → Performance Testing) 순차 네비게이션을 제공하고, 각 단계 완료 시 "Next" 버튼 활성화
2. **AC-2**: 25개 REQ-PCCP-XXX 모두에 대해 단위 테스트 또는 통합 테스트가 작성되고 통과
3. **AC-3**: PCCP 4개 컴포넌트 완결성 검증(REQ-PCCP-009)에서 section coverage SLO **100%** 달성 — 누락 섹션 0개
4. **AC-4**: DOCINGEST에 원 510(k)가 있는 device의 경우 PCCP 템플릿 사전 채움(REQ-PCCP-008)이 device name + intended use + SPS 3개 항목에 대해 동작
5. **AC-5**: Impact Assessment 5개 차원 중 1개 이상 "Modified — review required" 선택 시 경고 배너(REQ-PCCP-006) 즉시 표시
6. **AC-6**: PCCP DOCX export가 FDA 가이던스(2024-04) 표준 섹션 순서를 준수하고, draft 상태에서는 워터마크 포함
7. **AC-7**: PCCP 생성/컴포넌트 완료/전문가 승인 3개 audit 이벤트(REQ-PCCP-021/022/023)가 21 CFR Part 11 호환 형식으로 audit_logs에 기록
8. **AC-8**: RADAR가 "AI/ML" 또는 "PCCP" tag 업데이트를 감지한 후 PCCP 빌더 페이지 진입 시 배너(REQ-PCCP-014) 렌더링 통합 테스트 통과
9. **AC-9**: 동일 device에 대해 동시에 active=true인 PCCP 버전이 1개를 초과할 수 없음 — DB 제약 또는 application-level lock으로 보장
10. **AC-10**: 재학습 승인 워크플로우(REQ-PCCP-016) 4단계 상태 머신이 단계 건너뛰기를 차단 — 상태 전이 시도 시 422 응답
11. **AC-11**: PCCP 위저드 페이지(`app/(app)/workflows/pccp/page.tsx`)가 a11y 검사(axe-core 또는 동등)에서 critical 이슈 0개
12. **AC-12**: PCCP가 workflow_runs 테이블에 `workflow_type = 'pccp'`로 INSERT되고, 기존 510(k) workflow_run이 있는 경우 parent_workflow_id로 자동 연결

---

## §5. 구현 노트 (Implementation Notes)

### 5.1 핵심 파일 구조

| 파일 경로 | 역할 | 주요 관계 |
|----------|------|----------|
| `lib/pccp/modification-protocol.ts` | PCCP 4-component 생성 로직 (Modification Description / SPS / ACP / Impact Assessment) | REQ-PCCP-001~005, 011~013, 017 |
| `lib/pccp/templates/` | FDA 2024-04 가이던스 매핑 템플릿 디렉토리 (modification-types.ts, metrics-library.ts, sps-template.ts, acp-template.ts) | REQ-PCCP-002, 003, 004, 011 |
| `lib/pccp/validator.ts` | 4개 컴포넌트 완결성 검증 + section coverage SLO 100% | REQ-PCCP-009, 017 |
| `lib/pccp/audit-wiring.ts` | workflow.start / step.complete / pending_review / approve audit 기록 | REQ-PCCP-015, 021, 022, 023 |
| `lib/pccp/version-manager.ts` | PCCP 버전 관리 (draft / submitted / cleared / superseded) | REQ-PCCP-010, 024 |
| `lib/pccp/baseline-snapshot.ts` | 510(k) 승인 시점 baseline 캡처 | REQ-PCCP-018 |
| `lib/pccp/equivalence-gate.ts` | Substantial equivalence 평가 로직 | REQ-PCCP-005, 006 |
| `lib/pccp/radar-integration.ts` | RADAR FDA AI/ML 가이던스 업데이트 감지 | REQ-PCCP-014 |
| `app/(app)/workflows/pccp/page.tsx` | 4단계 위저드 UI + draft preview | REQ-PCCP-001~007, AC-11 |
| `app/(app)/workflows/pccp/[id]/page.tsx` | PCCP 상세 view + version history | REQ-PCCP-010, 024 |
| `app/api/ra/workflows/pccp/route.ts` | PCCP CRUD API | REQ-PCCP-021, 025 |
| `app/api/ra/workflows/pccp/[id]/approve/route.ts` | 전문가 승인 엔드포인트 | REQ-PCCP-016, 023 |
| `app/api/ra/workflows/pccp/[id]/export/route.ts` | DOCX/PDF export (워터마크 포함) | REQ-PCCP-019, 020 |

### 5.2 데이터베이스 스키마 (FOUNDATION + WORKFLOWS 확장)

- `workflow_runs` 테이블에 `workflow_type = 'pccp'` enum 값 추가 (REQ-PCCP-025)
- `pccp_versions` 신규 테이블 — id, device_id, version, status, baseline_snapshot_id, parent_workflow_id, active (REQ-PCCP-010)
- `pccp_components` 신규 테이블 — id, pccp_version_id, component_type (modification_description / sps / acp / impact_assessment / performance_testing), content_jsonb, completed_at (REQ-PCCP-022)
- `audit_logs.action` enum 확장 — `pccp_created`, `pccp_component_completed`, `pccp_expert_approved`, `pccp_algorithm_change_triggered`, `pccp_status_changed`

### 5.3 의존성 주입

- DOCINGEST: `lib/docingest/corpus.ts` 인터페이스를 통해 510(k) 문서 검색 (REQ-PCCP-008)
- RADAR: `lib/radar/classifier.ts`의 분류 결과 구독 (REQ-PCCP-014)
- WORKFLOWS: `lib/workflows/runner.ts`의 workflow_runs 인서트 헬퍼 재사용 (REQ-PCCP-025)
- FOUNDATION: `lib/audit.ts`의 audit log writer 재사용 (REQ-PCCP-021~023)

### 5.4 우선순위 (Priority Ordering, NO time estimates)

- **Priority 1 (필수, 첫 마일스톤)**: REQ-PCCP-001, 002, 005, 009, 021 — PCCP 생성 + 검증 + 감사 기본 골격
- **Priority 2 (핵심, 두 번째 마일스톤)**: REQ-PCCP-003, 004, 011, 012, 017, 018 — SPS/ACP/Performance Testing 완성
- **Priority 3 (통합, 세 번째 마일스톤)**: REQ-PCCP-006, 007, 008, 010, 013, 014, 022, 023, 024, 025 — 게이트/버전/integration
- **Priority 4 (운영, 네 번째 마일스톤)**: REQ-PCCP-015, 016, 019, 020 — 재학습 워크플로우 + export

---

## §6. 위험 요소 (Risks)

| ID | 위험 | 발생 가능성 | 영향도 | 완화 전략 |
|----|------|------------|--------|----------|
| R1 | FDA PCCP 가이던스 변경 — 2024-04 가이던스 후속 개정 또는 보충 가이던스 발표 | Medium | High | RADAR(SPEC-REGULA-RADAR-001) 통합으로 자동 감지(REQ-PCCP-014); 템플릿을 `lib/pccp/templates/` 격리 → 가이던스 변경 시 템플릿만 교체 |
| R2 | AI/ML 모델 재학습 빈도와 PCCP 범위 매핑의 자동화 어려움 — 어느 변경이 PCCP 범위 내인지 자동 판단 불가 | High | Medium | 자동화 시도하지 않음 — REQ-PCCP-005/006의 사용자 입력 + 경고 게이트로 책임 명확화; decision tree(REQ-PCCP-007)로 의사결정 지원 |
| R3 | PCCP가 표준 510(k)와 다른 구조 — Workflow A(510(k) Drafter)와 별도 위저드 필요 | Confirmed | Medium | 별도 라우트(`app/(app)/workflows/pccp/`)와 별도 4-step wizard 구현; workflow_runs 테이블만 공유(REQ-PCCP-025) |
| R4 | Substantial equivalence 판단의 주관성 — Impact Assessment 5개 차원 평가가 사용자 주관에 의존 | Medium | High | 각 차원별 가이던스 텍스트 인라인 표시; "Modified" 선택 시 RA advisor 상담 강제 경고(REQ-PCCP-006); audit log에 평가자 ID 기록 |
| R5 | PCCP 승인 후 장기간 미사용 또는 알고리즘 변경 누락 — 활성 PCCP의 실제 변경 이행 추적 부재 | Low | Medium | REQ-PCCP-024 status tracking + REQ-PCCP-015 algorithm change trigger logging; 향후 SPEC에서 dashboard alerts 검토 |

---

## §7. 의존성 (Dependencies)

### 7.1 SPEC 의존성

- **SPEC-REGULA-FOUNDATION-001** (Required): audit_logs 스키마, 21 CFR Part 11 호환 감사 인프라, workflow_runs 테이블 (REQ-PCCP-021~023, 025)
- **SPEC-REGULA-DOCINGEST-001** (Required): 기존 510(k) 문서 코퍼스 검색 인터페이스 — PCCP 템플릿 사전 채움 기반 (REQ-PCCP-008)
- **SPEC-REGULA-WORKFLOWS-001** (Required): workflow_runs 인서트 헬퍼, 일반 워크플로우 추적 체계 — PCCP를 일반 워크플로우로 통합 관리 (REQ-PCCP-025)
- **SPEC-REGULA-RADAR-001** (Required): FDA AI/ML 가이던스 업데이트 감지 — 가이던스 변경 시 PCCP 빌더 배너 표시 (REQ-PCCP-014, R1 완화)

### 7.2 외부 의존성

- **FDA Guidance**: "Marketing Submission Recommendations for a Predetermined Change Control Plan for AI/ML-Enabled Device Software Functions" (2024-04 Final) — REQ-PCCP-001, 003, 004, 020
- **21 CFR Part 11**: Electronic Records and Electronic Signatures — REQ-PCCP-015, 021~023
- **IMDRF SaMD Framework**: Software as a Medical Device 분류 체계 — Impact Assessment 차원 정의 (REQ-PCCP-005)

### 7.3 기술 스택

- Next.js 15 App Router (`app/(app)/workflows/pccp/`)
- React 19 (4-step wizard with state machine)
- Drizzle ORM + Neon Postgres (`pccp_versions`, `pccp_components` 신규 테이블)
- Auth.js v5 (expert role 기반 approval 권한, REQ-PCCP-023)
- TypeScript strict mode (`lib/pccp/` 전체)
- DOCX/PDF export 라이브러리 (REQ-PCCP-019)

---

## Exclusions (What NOT to Build)

다음 항목들은 본 SPEC의 명시적 범위 외로, 구현되지 않거나 별도 SPEC에서 다룸:

- **Excl-1**: AI/ML 모델 자체의 재학습 자동화 — 본 시스템은 PCCP 문서화 도구이며, 실제 재학습은 제조사의 ML Ops 인프라에서 수행 (NG1)
- **Excl-2**: PCCP의 FDA eSTAR/eCopy 직접 제출 통합 — Wave 3 범위 외 (NG2)
- **Excl-3**: PCCP 외 변경 통제 메커니즘(Change Protocol, Special 510(k) 등) — 본 SPEC은 PCCP에 한정 (NG3)
- **Excl-4**: EU MDR / KFDA / PMDA 등 다국가 규제의 변경 통제 — Wave 4+ 범위 (NG4)
- **Excl-5**: PCCP 승인 후 알고리즘 자동 배포(CI/CD 통합) — 제조사 인프라 책임 (NG5)
- **Excl-6**: 모델 성능 실시간 모니터링 대시보드 — 본 SPEC은 PCCP 작성·검증·감사에 한정; 운영 모니터링은 별도 SPEC 검토
- **Excl-7**: PCCP의 자연어 자동 생성(LLM-based draft generation) — 본 SPEC은 사용자 입력 기반 구조화 위저드; LLM 보조는 향후 별도 SPEC에서 검토
- **Excl-8**: 다중 사용자 동시 편집(collaborative editing) — 단일 RA 사용자 워크플로우 가정; 충돌 시 last-write-wins
