---
id: SPEC-REGULA-CAPA-001
version: 1.0.0
status: completed
phase: wave5
priority: High
created: 2026-06-22
updated: 2026-06-24
author: manager-spec (batch-2026-06-22)
issue_number: 68
depends_on:
  - SPEC-REGULA-FOUNDATION-001
  - SPEC-REGULA-RISK-001
  - SPEC-REGULA-CHANGE-CONTROL-001
  - SPEC-REGULA-ESIG-001
  - SPEC-REGULA-PMS-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/backend
---

# SPEC-REGULA-CAPA-001 — 불만·CAPA 폐루프 관리 (Complaint→Vigilance→Risk→DHF 연결)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | manager-spec (batch) | 초기 작성. Issue #68 기반. |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

#61 Vigilance는 규제 보고 대상 유해사례를 다루지만, 모든 고객 불만·품질 이슈가 즉시 MDR(Medical Device Reporting)/MDV 보고 대상은 아니다. 의료기기 운영에서는 complaint intake, investigation, root cause, CAPA(Corrective and Preventive Action), effectiveness check가 QMS와 DHF, Risk, PMS를 연결하는 핵심 폐루프이다.

본 SPEC은 불만 접수부터 CAPA 완료, 효과성 확인, DHF/Risk/PMS 반영까지 하나의 추적 가능한 워크플로우로 관리한다. complaint intake 구조화 폼, reportability assessment(#61 Vigilance 연결), root cause analysis(5 Whys, Fishbone), corrective/preventive action 분리 관리, CAPA owner·due date·effectiveness check 관리, 반복 불만 trend detection(#53 PMS 연결)을 포함한다.

CAPA 결과는 #46 Risk, #54 Change Control, #64 DHF에 자동 연결되고, QMS 시스템(#57)과 양방향 상태 동기화하며, 모든 단계에 전자서명 및 audit_logs를 기록한다.

### 1.2 규제 근거 (Regulatory Anchor)

- FDA 21 CFR 820.100: Corrective and Preventive Action (CAPA)
- FDA 21 CFR 820.198: Complaint Files
- FDA 21 CFR 803: Medical Device Reporting (reportability)
- EU MDR (2017/745) Article 87-92: Vigilance 및 보고
- ISO 13485:2016 §8.5: 개선 (CAPA)
- ISO 14971: Risk Management 연계
- 21 CFR Part 11: 전자서명·audit trail

### 1.3 본 SPEC의 범위 (In Scope)

- complaint intake 구조화 폼
- reportability assessment 결과를 #61 Vigilance와 연결
- root cause analysis(5 Whys, Fishbone) 작성 지원
- corrective action / preventive action 분리 관리
- CAPA owner, due date, effectiveness check 관리
- 반복 불만 trend detection 및 #53 PMS 연결
- CAPA 결과를 #46 Risk, #54 Change Control, #64 DHF에 자동 연결
- QMS 시스템(#57)과 양방향 상태 동기화
- 모든 단계 전자서명 및 audit_logs 기록

### 1.4 Out of Scope

- 실제 규제기관 MDR/MDV 전자 제출 (#61 Vigilance 범위)
- 외부 QMS 시스템 자체 구현 (상태 동기화 인터페이스만 담당)
- 자동 root cause AI 판정 (작성 지원만, 판단은 사용자/expert)
- complaint 고객 접점 채널(이메일/콜센터) 통합

---

## §2 Requirements (EARS Format)

| ID | EARS Statement | Priority |
|----|---------------|----------|
| REQ-CAPA-001 | THE SYSTEM SHALL complaint intake를 구조화된 폼으로 접수·저장한다 | High |
| REQ-CAPA-002 | WHEN complaint가 접수되면 THE SYSTEM SHALL reportability assessment를 수행하고 결과를 #61 Vigilance와 연결한다 | High |
| REQ-CAPA-003 | WHEN 사용자가 root cause analysis를 수행하면 THE SYSTEM SHALL 5 Whys 및 Fishbone 작성을 지원한다 | High |
| REQ-CAPA-004 | THE SYSTEM SHALL corrective action과 preventive action을 분리하여 관리한다 | High |
| REQ-CAPA-005 | THE SYSTEM SHALL 각 CAPA에 owner, due date, effectiveness check를 할당·추적한다 | High |
| REQ-CAPA-006 | WHEN effectiveness check 기한이 도래하면 THE SYSTEM SHALL 담당자에게 알림을 전송한다 | High |
| REQ-CAPA-007 | WHEN 반복 불만 트렌드가 감지되면 THE SYSTEM SHALL #53 PMS와 연결한다 | High |
| REQ-CAPA-008 | WHEN CAPA가 완료되면 THE SYSTEM SHALL 결과를 #46 Risk, #54 Change Control, #64 DHF에 자동 연결한다 | High |
| REQ-CAPA-009 | THE SYSTEM SHALL QMS 시스템(#57)과 CAPA 상태를 양방향 동기화한다 | High |
| REQ-CAPA-010 | WHEN 각 CAPA 단계가 전환되면 THE SYSTEM SHALL 전자서명을 요구하고 audit_logs에 기록한다 | High |
| REQ-CAPA-011 | IF reportable 사건인데 Vigilance 연결이 누락되면 THEN THE SYSTEM SHALL CAPA close를 차단한다 | High |
| REQ-CAPA-012 | IF 권한 없는 사용자가 CAPA 상태 전이를 시도하면 THEN THE SYSTEM SHALL 접근을 거부한다 | High |

---

## §3 Acceptance Criteria

| AC# | Criterion | Verification |
|-----|-----------|-------------|
| AC-01 | complaint → reportability → CAPA 분기 E2E 통과 | E2E test |
| AC-02 | CAPA effectiveness check 기한 알림 동작 | integration test (스케줄러) |
| AC-03 | CAPA와 risk/DHF/change control 링크 누락 0건 | integration test |
| AC-04 | 전자서명 및 감사 로그 100% 기록 | audit log 검증 |
| AC-05 | QMS export/import 상태 동기화 지원 | integration test |
| AC-06 | 반복 불만 trend detection → PMS 연결 | integration test |
| AC-07 | reportable인데 Vigilance 미연결 시 close 차단 | negative test |
| AC-08 | 권한 없는 상태 전이 거부됨 | RBAC negative test |

---

## §4 Technical Approach

### 4.1 파일 구조

```
app/(app)/capa/                      # CAPA 폐루프 워크벤치 UI
lib/capa/
  intake.ts                          # complaint 구조화 접수
  reportability.ts                   # reportability assessment + Vigilance 연결
  root-cause.ts                      # 5 Whys / Fishbone
  effectiveness.ts                   # effectiveness check 스케줄·알림
  trend-detector.ts                  # 반복 불만 트렌드 → PMS
  qms-sync.ts                        # QMS 양방향 동기화
lib/db/schema/capa.ts
```

### 4.2 DB Schema

- `complaints` 테이블: project_id FK, intake_data, reportability_status, vigilance_ref
- `capa_records` 테이블: complaint_id FK, type(corrective|preventive), owner, due_date, status, effectiveness_status
- `capa_root_causes` 테이블: capa_id FK, method(5whys|fishbone), analysis_data
- `capa_links` 테이블: capa_id FK, target_type(risk|change_control|dhf|pms), target_id
- `audit_logs` 재사용 (전자서명 메타데이터 포함)

### 4.3 API Endpoints

- `POST /api/capa/complaints` — complaint intake
- `POST /api/capa/complaints/[id]/reportability` — assessment + Vigilance 연결
- `POST /api/capa/records` — CAPA 생성 (corrective/preventive)
- `POST /api/capa/records/[id]/root-cause` — RCA 작성
- `POST /api/capa/records/[id]/effectiveness` — effectiveness check
- `POST /api/capa/records/[id]/close` — reportability·링크 검증 후 전자서명
- `GET/POST /api/capa/qms-sync` — QMS 양방향 동기화

### 4.4 의존성

- #46 Risk (CAPA 후 risk 재평가)
- #53 PMS/PMCF (반복 불만 및 postmarket trend 반영)
- #54 Change Control (CAPA 기반 설계 변경 평가)
- #57 QMS Integration (외부 QMS 상태 동기화)
- #61 Vigilance (보고 대상 사건 분기)
- #64 DHF (설계 이력 반영)
- SPEC-REGULA-ESIG-001 (전자서명)

---

## §5 Implementation Notes (2026-06-24)

### 구현 범위
- **Migration 0073**: workflow_type enum +1(`complaint_intake`, 15→16), audit_action enum +7(139→146: complaint_created, reportability_assessed, root_cause_created, capa_created, effectiveness_checked, capa_closed, qms_synced), 테이블 5개(complaints, capa_records, capa_root_causes, capa_links, capa_effectiveness_checks) + RLS
- **lib/capa/** 모듈 10개: intake.ts, reportability.ts, root-cause.ts, records.ts, effectiveness.ts, trend-detector.ts, linkage.ts, close-gate.ts, qms-sync.ts, audit.ts
- **API 7종**: POST /api/capa/complaints, POST /api/capa/complaints/[id]/reportability, POST /api/capa/records, POST /api/capa/records/[id]/root-cause, POST /api/capa/records/[id]/effectiveness, POST /api/capa/records/[id]/close, GET/POST /api/capa/qms-sync
- **UI 워크벤치**: app/(app)/capa/page.tsx (intake 폼 + CAPA 목록 + RCA 작성 + effectiveness check + close 게이트)
- **권한**: capa.*, capa.close, capa.qms_sync (ra-lead 전용)

### 재사용 패턴
- #61 Vigilance assessReportability (REQ-002): reportability assessment 공통 로직 재사용
- #54 Change Control assessChange + #46 Risk risk_items + #64 DHF design_history_files (REQ-008 linkage): CAPA 결과 연결 패턴 재사용
- #53 PMS pms_inputs (REQ-007 trend): 반복 불만 trend detection 재사용
- SPEC-REGULA-ESIG-001 computeAnswerHash (REQ-010): 전자서명 해시 계산 재사용
- Inngest effectiveness cron (REQ-006): effectiveness check 스케줄링 재사용

### 보안 수정 (expert-security 리뷰 머지 차단 결함 fix)
- **C-1 (CRITICAL → RESOLVED)**: vigilance/adverse_events org 스코프 수정 — workflowRunId 기반 anchor 추가, 타 org 접근 차단
- **H-1 (HIGH → RESOLVED)**: ESIG 서명자 해시 binding 수정 — §11.70 서명자 userId 강제 binding
- **H-2 (HIGH → RESOLVED)**: 7 라우트 audit tx 래핑 — db.transaction()으로 상태 전이와 audit log 기록 원자성 보장
- **H-3 (MEDIUM → RESOLVED)**: createdBy userId 검증 — CAPA 생성자 검증 로직 추가
- **evaluator linkage 검증**: getCapaLinkCount count(*) 추가, linkage pms/risk 검증 로직 강화

### 품질 게이트 결과
- **typecheck**: 0 에러
- **biome**: 0 에러
- **test**: 3721 passed | 7 skipped
- **build**: 0 에러

### Acceptance Criteria 완료 상태
- AC-01: complaint → reportability → CAPA 분기 E2E 통과 ✅
- AC-02: CAPA effectiveness check 기한 알림 동작 ✅
- AC-03: CAPA와 risk/DHF/change control 링크 누락 0건 ✅
- AC-04: 전자서명 및 감사 로그 100% 기록 ✅
- AC-05: QMS export/import 상태 동기화 지원 ⏸️ DEFERRED (#57)
- AC-06: 반복 불만 trend detection → PMS 연결 ✅
- AC-07: reportable인데 Vigilance 미연결 시 close 차단 ✅
- AC-08: 권한 없는 상태 전이 거부됨 ✅

---

## §6 Follow-up Issues

- **#57**: QMS 실제 통신 (REQ-009 stub 교체) — AC-05 DEFERRED 해결을 위한 실제 QMS 시스템 연동
