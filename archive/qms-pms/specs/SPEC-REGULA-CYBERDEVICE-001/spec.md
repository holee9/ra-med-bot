---
id: SPEC-REGULA-CYBERDEVICE-001
version: 1.0.0
status: draft
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 67
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RELEASE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/security
  - component/infra
---

# SPEC-REGULA-CYBERDEVICE-001 — 의료기기 사이버보안·SBOM 제출 증거 (FDA Cybersecurity·EU MDR GSPR 대응)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #67 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula 자체 보안과 배포 보안은 기존 Release/Cloudflare/Validation 이슈가 다루지만, 고객 의료기기 제품의 사이버보안 제출 증거는 별도 영역이다. Regula가 생성/관리하는 것은 Regula의 보안이 아니라 고객 의료기기 제품의 제출용 사이버보안 증거 패키지다.

연결형 의료기기(connected device)와 SaMD(Software as a Medical Device)는 FDA Premarket Cybersecurity Guidance, EU MDR GSPR, IEC 81001-5-1, SBOM 요구사항을 제출 자료에 포함해야 한다. 이 증거는 제품 아키텍처, threat model, SBOM, 취약점 관리, 보안 업데이트 계획을 구조화하여 제출 가능한 형태로 묶여야 한다.

본 SPEC은 제품별 사이버보안 위험을 구조화하고, SBOM을 입력/검증/버전 관리하며, CVE 영향 분석과 secure update 계획을 생성하고, 이를 SaMD(#63)/DHF(#64)/Submission(#65) 산출물과 연결한다.

보안 취약점 변경은 #54 Change Control 및 #46 Risk 재평가와 연계하여 residual cybersecurity risk를 ISO 14971 risk item으로 연결한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA Premarket Cybersecurity Guidance (2023) — threat model, SBOM, vulnerability management, secure update 제출 요구.
- EU MDR GSPR Annex I §17.2 / §17.4 — IT 환경 보안 및 최소 보안 요구사항.
- IEC 81001-5-1 — health software 보안 lifecycle.
- ISO 14971 — cybersecurity residual risk를 risk management item으로 연결.

### 1.3 본 SPEC의 범위 (In Scope)

- 제품 아키텍처 기반 threat model 생성 및 FDA cybersecurity section 체크리스트 자동 작성
- SBOM 입력/검증/버전 관리 및 버전 diff
- known exploited vulnerabilities 및 CVE 영향 분석
- secure update / patch / end-of-support 계획 생성
- EU MDR GSPR 17.2/17.4 및 IEC 81001-5-1 매핑
- penetration test, vulnerability scan, residual risk evidence 연결
- SaMD(#63)/DHF(#64)/Submission(#65) 산출물 연결, #54/#46 재평가 연계

### 1.4 Out of Scope

- Regula 플랫폼 자체 인프라 보안 (기존 Release/Cloudflare 이슈 담당)
- 실제 penetration test 수행 (외부 결과 evidence 연결만 담당)
- 고객 의료기기 firmware 직접 분석

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CYBERDEVICE-001 | THE SYSTEM SHALL 제품 아키텍처 입력을 기반으로 threat model을 생성해야 한다 | High |
| REQ-CYBERDEVICE-002 | THE SYSTEM SHALL FDA cybersecurity section 체크리스트를 자동 생성하고 커버리지를 추적해야 한다 | High |
| REQ-CYBERDEVICE-003 | WHEN SBOM이 입력되면 THE SYSTEM SHALL 형식(SPDX/CycloneDX)을 검증하고 저장해야 한다 | High |
| REQ-CYBERDEVICE-004 | THE SYSTEM SHALL SBOM 버전 간 diff를 제공하여 구성요소 변경을 추적해야 한다 | High |
| REQ-CYBERDEVICE-005 | THE SYSTEM SHALL known exploited vulnerabilities(KEV) 및 CVE 영향 분석을 수행해야 한다 | High |
| REQ-CYBERDEVICE-006 | WHEN CVE가 식별되면 THE SYSTEM SHALL 해당 CVE를 영향받는 제품 구성요소와 연결해야 한다 | High |
| REQ-CYBERDEVICE-007 | THE SYSTEM SHALL secure update, patch, end-of-support 계획을 생성하고 관리해야 한다 | High |
| REQ-CYBERDEVICE-008 | THE SYSTEM SHALL threat model 항목을 EU MDR GSPR 17.2/17.4 및 IEC 81001-5-1 요구사항에 매핑해야 한다 | High |
| REQ-CYBERDEVICE-009 | THE SYSTEM SHALL penetration test, vulnerability scan, residual risk evidence를 연결해야 한다 | Medium |
| REQ-CYBERDEVICE-010 | THE SYSTEM SHALL residual cybersecurity risk를 ISO 14971 risk item(#46)으로 연결해야 한다 | High |
| REQ-CYBERDEVICE-011 | WHEN 보안 취약점이 변경되면 THE SYSTEM SHALL #54 Change Control 및 #46 Risk 재평가를 트리거해야 한다 | High |
| REQ-CYBERDEVICE-012 | THE SYSTEM SHALL cybersecurity evidence bundle을 SaMD(#63)/DHF(#64)/Submission(#65) 산출물과 연결해야 한다 | High |
| REQ-CYBERDEVICE-013 | IF entitlement 없는 사용자가 cybersecurity evidence에 접근하면 THEN THE SYSTEM SHALL 접근을 차단하고 audit_logs에 기록해야 한다 | High |
| REQ-CYBERDEVICE-014 | WHEN 제출 패키지가 생성되면 THE SYSTEM SHALL cybersecurity evidence bundle을 포함해야 한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | SBOM import/export 및 버전 diff가 동작함 | Integration: SBOM 2개 버전 입력 후 diff 결과 검증 |
| AC-02 | FDA cybersecurity checklist 100% 항목이 커버됨 | checklist 커버리지 리포트 확인 |
| AC-03 | CVE 영향 분석 결과가 제품 구성요소와 연결됨 | Integration: CVE 입력 후 영향 구성요소 매핑 검증 |
| AC-04 | residual cybersecurity risk가 ISO 14971 risk item으로 연결됨 | DB 조회: cybersecurity risk → risk_item FK 검증 |
| AC-05 | 제출 패키지에 cybersecurity evidence bundle이 포함됨 | E2E: submission export 후 bundle 포함 확인 |
| AC-06 | threat model이 GSPR 17.2/17.4 및 IEC 81001-5-1에 매핑됨 | 매핑 테이블 완전성 검증 |
| AC-07 | 권한 없는 evidence 접근이 차단되고 audit에 기록됨 | E2E: 무권한 계정 접근 시 403 + audit row |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/api/cyberdevice/
    threat-model/route.ts
    sbom/route.ts
    sbom/diff/route.ts
    cve-analysis/route.ts
    update-plan/route.ts
    evidence-bundle/route.ts
  lib/cyberdevice/
    threat-model-generator.ts
    sbom-parser.ts          # SPDX/CycloneDX 파싱·검증
    cve-mapper.ts           # CVE/KEV → 구성요소 연결
    gspr-mapping.ts         # GSPR 17.2/17.4, IEC 81001-5-1 매핑
    checklist.ts            # FDA cybersecurity checklist
  db/schema/
    threat-model.ts
    sbom.ts
    cve-impact.ts
    cyber-evidence.ts
```

### 4.2 DB Schema

- `threat_model`: id, product_id, architecture_input (jsonb), threats (jsonb), gspr_mapping (jsonb), created_at
- `sbom`: id, product_id, format (enum: spdx/cyclonedx), version, components (jsonb), validated (boolean), created_at
- `cve_impact`: id, cve_id, kev_flag (boolean), affected_component_id (FK to sbom component), severity, mitigation (text), risk_item_id (FK, nullable), created_at
- `cyber_evidence_bundle`: id, product_id, threat_model_id (FK), sbom_id (FK), pentest_artifact_path, update_plan (jsonb), linked_samd_id (FK), linked_dhf_id (FK), linked_submission_id (FK), created_at
- `audit_logs` (기존): evidence 접근 기록

### 4.3 API Endpoints

- `POST /api/cyberdevice/threat-model` — 아키텍처 기반 threat model 생성
- `POST/GET /api/cyberdevice/sbom`, `GET /api/cyberdevice/sbom/diff` — SBOM 관리/diff
- `POST /api/cyberdevice/cve-analysis` — CVE/KEV 영향 분석
- `POST /api/cyberdevice/update-plan` — secure update/end-of-support 계획
- `POST /api/cyberdevice/evidence-bundle` — 제출용 evidence bundle 생성

### 4.4 의존성

- 선행: SPEC-REGULA-FOUNDATION-001 (auth/RBAC/audit), SPEC-REGULA-RELEASE-001
- 연계: #46 Risk (ISO 14971 residual risk), #49 Validation, #54 Change Control, #63 SaMD, #64 DHF, #65 eSubmit
- 기술: Next.js 15, Drizzle ORM, PostgreSQL, SPDX/CycloneDX SBOM 파서, CVE/KEV 데이터 소스 연동
