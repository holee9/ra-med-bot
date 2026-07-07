---
id: SPEC-REGULA-CORPUS-LICENSE-001
version: 1.0.0
status: completed
phase: system
priority: High
created: 2026-06-22
updated: 2026-06-22
author: manager-spec (batch-2026-06-22)
issue_number: 72
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RELEASE-001
lifecycle_level: spec-anchored
labels:
  - component/backend
  - component/infra
---

# SPEC-REGULA-CORPUS-LICENSE-001 — 코퍼스 라이선스·사용권 관리 (규제문서·표준·논문 수집 권한 검증)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #72 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

Regula는 규제 문서, 표준, 논문, 사내 SOP를 대규모로 수집한다. #48 Source Governance는 출처 권위도·버전·유효일을 다루지만, 라이선스·구독·사용권·재배포 권한은 별도 통제가 필요하다.

특히 ISO/IEC/ASTM 표준 전문, 유료 DB, 논문 전문은 무단 ingestion 또는 재배포 시 법적 리스크가 크다. 표준 전문을 entitlement 없이 embedding하거나 답변에 재배포하면 라이선스 위반이 된다. 논문도 abstract-only 정책과 전문 사용권을 구분해야 한다.

본 SPEC은 각 source의 수집·embedding·검색·요약·export 사용 권한을 명시하고, 권한 없는 자료는 ingestion과 답변 생성을 차단한다. 사용권 검증 gate는 ingestion 이전 단계에 위치하여 무권한 자료가 corpus에 진입하는 것을 원천 차단한다.

license expiry 또는 entitlement revoke 시에는 해당 source가 corpus search에서 즉시 제외되며, 답변·export 산출물에는 source별 사용 제한 문구가 자동 포함된다. 모든 권한 변경 내역은 audit_logs에 기록되어 #48 Source Governance의 authority/version metadata와 통합된다.

### 1.2 규제 근거 (Regulatory Anchor)

- 저작권법 / 표준 라이선스 (ISO/IEC/ASTM copyright) — 표준 전문의 무단 저장·재배포 금지.
- 데이터베이스 구독 약관 (PubMed/Embase entitlement) — abstract-only vs full-text 사용권 구분.
- 영업비밀 보호 — 사내 SOP/제출 문서의 confidentiality/trade secret 권한 관리.

### 1.3 본 SPEC의 범위 (In Scope)

- source별 license_type, entitlement, permitted_use, expiry_date 저장
- ingestion 전 사용권 검증 gate
- ISO/IEC/ASTM 등 유료 표준 전문 entitlement 없으면 전문 저장 금지
- PubMed/Embase 논문 전문 사용권 및 abstract-only 정책 구분
- 사내 SOP/제출 문서의 confidentiality/trade secret 권한 관리
- 답변·export 시 source별 사용 제한 문구 자동 포함
- license expiry/entitlement revoke 시 corpus search 차단
- #48 Source Governance와 authority/version metadata 통합

### 1.4 Out of Scope

- 라이선스 자동 구매/갱신 결제 처리
- 외부 라이선스 제공자 API 직접 연동 (수동 entitlement 입력 우선)
- DRM(Digital Rights Management) 기술적 암호화

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CORPUSLIC-001 | THE SYSTEM SHALL 각 source에 license_type, entitlement, permitted_use, expiry_date를 저장해야 한다 | High |
| REQ-CORPUSLIC-002 | WHEN 문서 ingestion이 요청되면 THE SYSTEM SHALL ingestion 이전에 사용권 검증 gate를 실행해야 한다 | High |
| REQ-CORPUSLIC-003 | IF license metadata가 없는 source가 ingestion되려 하면 THEN THE SYSTEM SHALL ingestion을 차단해야 한다 | High |
| REQ-CORPUSLIC-004 | IF ISO/IEC/ASTM 유료 표준 전문이 entitlement 없이 저장되려 하면 THEN THE SYSTEM SHALL 전문 저장 및 embedding을 차단해야 한다 | High |
| REQ-CORPUSLIC-005 | THE SYSTEM SHALL PubMed/Embase 논문에 대해 full-text 사용권과 abstract-only 정책을 구분하여 적용해야 한다 | High |
| REQ-CORPUSLIC-006 | THE SYSTEM SHALL 사내 SOP/제출 문서의 confidentiality 및 trade secret 권한을 관리해야 한다 | High |
| REQ-CORPUSLIC-007 | WHEN 답변 또는 export가 생성되면 THE SYSTEM SHALL source별 사용 제한 문구를 자동 포함해야 한다 | High |
| REQ-CORPUSLIC-008 | IF source의 license가 만료되거나 entitlement가 revoke되면 THEN THE SYSTEM SHALL 해당 source를 corpus search 결과에서 제외해야 한다 | High |
| REQ-CORPUSLIC-009 | THE SYSTEM SHALL source license/entitlement 정보를 #48 Source Governance의 authority/version metadata와 통합해야 한다 | High |
| REQ-CORPUSLIC-010 | WHEN 권한 정보가 변경되면 THE SYSTEM SHALL 변경 내역을 audit_logs에 기록해야 한다 | High |
| REQ-CORPUSLIC-011 | WHEN export 패키지가 생성되면 THE SYSTEM SHALL 포함된 모든 source의 export 권한을 검증해야 한다 | High |
| REQ-CORPUSLIC-012 | IF 권한 없는 사용자가 license 설정을 변경하려 하면 THEN THE SYSTEM SHALL 거부하고 audit_logs에 기록해야 한다 | High |
| REQ-CORPUSLIC-013 | WHILE source가 abstract-only 정책일 동안 THE SYSTEM SHALL 전문 검색/요약을 차단하고 abstract만 노출해야 한다 | High |
| REQ-CORPUSLIC-014 | THE SYSTEM SHALL license expiry 임박 source에 대해 관리자에게 사전 경고를 제공해야 한다 | Medium |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | license metadata 없는 source의 ingestion이 차단됨 | Integration: metadata 누락 source ingestion 시도 시 거부 |
| AC-02 | 유료 표준 전문의 무권한 저장·embedding이 차단됨 | Integration: ISO 표준 entitlement 없이 ingestion 시 block |
| AC-03 | source expiry 시 검색 결과에서 제외됨 | Integration: expiry 설정 후 corpus search에서 미노출 |
| AC-04 | export 산출물에 사용권 제한 문구가 포함됨 | E2E: export 생성 후 제한 문구 텍스트 검증 |
| AC-05 | 권한 변경 내역이 audit_logs에 100% 기록됨 | DB 조회: 모든 license 변경에 대응하는 audit row |
| AC-06 | abstract-only source가 전문 검색/요약을 차단함 | Integration: abstract-only source 전문 요청 시 abstract만 반환 |
| AC-07 | 권한 없는 사용자의 license 설정 변경이 차단됨 | E2E: 무권한 계정 license 수정 시 403 + audit row |

---

## §4 Technical Approach

### 4.1 파일 구조

```
src/
  app/api/corpus-license/
    source-license/route.ts        # license metadata CRUD
    ingestion-gate/route.ts        # ingestion 전 사용권 검증
    entitlement/route.ts           # entitlement 관리/revoke
  lib/corpus-license/
    license-gate.ts                # ingestion 사용권 검증 게이트
    permitted-use.ts               # permitted_use 정책 평가
    usage-notice.ts                # 답변/export 사용 제한 문구 생성
    expiry-checker.ts              # expiry/revoke 시 search 제외
  lib/ingest/                      # #10 DocIngest 연동 지점
  db/schema/
    source-license.ts
    entitlement.ts
```

### 4.2 DB Schema

- `source_license`: id, source_id (FK to source governance), license_type (enum: standard_paid/journal/internal_sop/open), entitlement_ref, permitted_use (jsonb: ingest/embed/search/summarize/export), full_text_allowed (boolean), abstract_only (boolean), confidentiality_level (enum: public/internal/trade_secret), expiry_date (date, nullable), created_at
- `entitlement`: id, source_license_id (FK), status (enum: active/revoked/expired), granted_by (FK), granted_at, revoked_at (nullable)
- `audit_logs` (기존): license/entitlement 변경, 차단 이벤트 기록

### 4.3 API Endpoints

- `POST/GET/PUT /api/corpus-license/source-license` — license metadata 관리 (RBAC gate)
- `POST /api/corpus-license/ingestion-gate` — ingestion 전 사용권 검증 (#10 연동)
- `POST /api/corpus-license/entitlement` — entitlement grant/revoke
- corpus search/answer/export 경로에 license-gate 및 usage-notice 미들웨어 적용

### 4.4 의존성

- 선행: SPEC-REGULA-FOUNDATION-001 (auth/RBAC/audit), SPEC-REGULA-RELEASE-001
- 연계: #10 DocIngest (수집 전 권한 검증), #48 Source Governance (메타데이터 통합), #60 Clinical Literature (논문 사용권), #62 Standards (ISO/IEC/ASTM entitlement), #65 eSubmit (export 권한)
- 기술: Next.js 15, Drizzle ORM, PostgreSQL + pgvector (embedding gate), ingestion pipeline 연동
