---
id: SPEC-REGULA-CAPA-001
version: 1.0.0
status: draft
phase: wave5
priority: High
created: 2026-06-24
author: manager-strategy
issue_number: 68
base_branch: feat/issue-68 (from main 7d8bcfe)
depends_on:
  - SPEC-REGULA-FOUNDATION-001   # audit_logs, withPermission, writeAudit (재사용)
  - SPEC-REGULA-RISK-001          # #46 risk_items (REQ-008 재사용)
  - SPEC-REGULA-CHANGE-CONTROL-001 # #54 assessChange (REQ-008 재사용)
  - SPEC-REGULA-ESIG-001          # 전자서명 (REQ-010 재사용)
  - SPEC-REGULA-PMS-001           # #53 PMS (REQ-007 재사용)
  - SPEC-REGULA-VIGILANCE-001     # #61 assessReportability (REQ-002 재사용)
  - SPEC-REGULA-DHF-001           # #64 design_history_files (REQ-008 링크)
deferred:
  - SPEC-REGULA-QMS-001           # #57 미구현 → REQ-009 stub/no-op + follow-up issue
---

# SPEC-REGULA-CAPA-001 — 불만·CAPA 폐루프 관리 Tasks

## §0 베이스라인 (오케스트레이터 직접 grep 검증 — L-007)

| 항목 | 현재값 | 출처 |
|------|--------|------|
| workflow_type enum | 15값 → 16값 ('complaint' 추가) | lib/db/schema.ts:328-344 (직검 일치) |
| audit_action enum | **139값 → 146값** (7개 추가) | lib/db/schema.ts auditActionEnum — **오케스트레이터 직검: grep 카운트 139** (manager-strategy 보고 166과 상이; tasks.md 단언 테스트가 최종 검증) |
| PermissionAction | **26 union member → 33** (7개 추가) | lib/auth/permissions.ts:8+ — **오케스트레이터 직검: union type 정규식 카운트 26** (manager-strategy 보고 51은 union + PERMISSIONS map 키를 합산한 오류; tasks.md 단언 테스트가 최종 검증) |
| migration | 0072 (최신) → 0073 (신규) | migrations/0072_labeling.sql |
| QMS (#57) | 미구현 (stub/no-op) | `find lib app -path '*qms*'` 결과 없음 |
| DHF (#64) | 구현됨 (재사용) | lib/dhf/, design_history_files 테이블 |
| Vigilance (#61) | 구현됨 (재사용) | lib/vigilance/reportability-engine.ts |

---

## Phase 1 — DB Schema & Migration (REQ-001, REQ-004, REQ-005, REQ-010)

### Task 1.1: migration 0073 작성
- **파일**: `migrations/0073_capa.sql`
- **매핑**: REQ-001, REQ-004, REQ-005, REQ-010
- **AC**: AC-03 (링크 무결성), AC-04 (감사 로그)
- **내용**:
  1. `ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'complaint'` (15→16)
  2. `ALTER TYPE audit_action ADD VALUE` 7개:
     - `complaint.intake_created`
     - `complaint.reportability_assessed`
     - `capa.record_created`
     - `capa.root_cause_documented`
     - `capa.effectiveness_scheduled`
     - `capa.closed`
     - `capa.close_blocked_vigilance_missing`
  3. 5개 테이블 생성 (RLS `app.current_org_id` 패턴, 0067-0072 상속):
     - `complaints`: project_id FK, intake_data jsonb, reportability_status, vigilance_ref
     - `capa_records`: complaint_id FK, type(corrective|preventive), owner, due_date, status, effectiveness_status
     - `capa_root_causes`: capa_id FK, method(5whys|fishbone), analysis_data jsonb
     - `capa_links`: capa_id FK, target_type(risk|change_control|dhf|pms), target_id
     - `capa_effectiveness_checks`: capa_id FK, due_date, checked_at, result, notes
- **의존성**: 없음 (첫 작업)
- **완료 기준**: `drizzle-kit generate` 통과, RLS CHECK 제약 포함

### Task 1.2: schema.ts Drizzle 정의
- **파일**: `lib/db/schema.ts` (edit, ~1520라인 근처 labeling 뒤 추가)
- **매핑**: Task 1.1 동일
- **내용**:
  1. workflowTypeEnum에 'complaint' 추가
  2. auditActionEnum에 7개 추가
  3. 5개 pgTable 정의 (complaints, capaRecords, capaRootCauses, capaLinks, capaEffectivenessChecks)
  4. 인덱스: org_id, project_id, complaint_id, capa_id, status
- **완료 기준**: `tsc --noEmit` 통과, 기존 스키마 호환성 유지

---

## Phase 2 — Domain Library (lib/capa/)

### Task 2.1: types.ts + intake.ts (REQ-001)
- **파일**: `lib/capa/types.ts`, `lib/capa/intake.ts`
- **매핑**: REQ-001 (complaint intake 구조화 폼)
- **AC**: AC-01 (E2E 분기)
- **내용**:
  1. ComplaintInput, ComplaintRecord, CapaRecord, CapaType, RootCauseMethod 타입 정의
  2. `createComplaint(input, orgId, userId)` — 구조화 폼 검증 + DB insert + audit(`complaint.intake_created`)
- **의존성**: Task 1.2
- **재사용**: `writeAudit` (lib/audit.ts)

### Task 2.2: reportability.ts — #61 Vigilance 연결 (REQ-002)
- **파일**: `lib/capa/reportability.ts`
- **매핑**: REQ-002 (reportability + Vigilance 연결)
- **AC**: AC-01, AC-07 (close 차단 기반)
- **내용**:
  1. `assessComplaintReportability(complaintId)` — lib/vigilance/reportability-engine.ts의 `assessReportability(AdverseEventInput)` 호출 (직접 재사용)
  2. complaint → AdverseEventInput 매핑 래퍼
  3. 결과를 complaints.reportability_status에 저장
  4. reportable=true인 경우 vigilance_reports 테이블에 레코드 생성 + complaints.vigilance_ref 설정
  5. audit(`complaint.reportability_assessed`)
- **의존성**: Task 2.1
- **재사용 증거**: `lib/vigilance/reportability-engine.ts:53 assessReportability()` — REQ-VIG-001~010 결정 엔진
- **완료 기준**: reportable 불만이 vigilance_reports와 연결되고 vigilance_ref 채워짐

### Task 2.3: root-cause.ts (REQ-003)
- **파일**: `lib/capa/root-cause.ts`
- **매핑**: REQ-003 (5 Whys + Fishbone)
- **AC**: AC-01
- **내용**:
  1. FiveWhysInput(why1~why5 순차 작성) / FishboneInput(6M 카테고리: Man/Machine/Material/Method/Measurement/Environment)
  2. `documentRootCause(capaId, method, data)` — capa_root_causes insert + audit(`capa.root_cause_documented`)
  3. 순수 데이터 저장 (AI 판정 아님 — Out of Scope)
- **의존성**: Task 1.2

### Task 2.4: capa-records.ts (REQ-004, REQ-005)
- **파일**: `lib/capa/records.ts`
- **매핑**: REQ-004 (corrective/preventive 분리), REQ-005 (owner/due/effectiveness)
- **AC**: AC-03
- **내용**:
  1. `createCapaRecord(complaintId, type, owner, dueDate)` — capa_records insert + audit(`capa.record_created`)
  2. type은 'corrective' | 'preventive' 분리 (별도 레코드)
  3. owner(사용자 FK), due_date, effectiveness_status 필드

### Task 2.5: effectiveness.ts + Inngest 알림 (REQ-006)
- **파일**: `lib/capa/effectiveness.ts`, `lib/inngest/capa/effectiveness-due-reminder.ts`
- **매핑**: REQ-006 (effectiveness 기한 알림)
- **AC**: AC-02 (스케줄러 통합 테스트)
- **내용**:
  1. `scheduleEffectivenessCheck(capaId, dueDate)` — capa_effectiveness_checks insert + audit(`capa.effectiveness_scheduled`)
  2. Inngest function `capa-effectiveness-due-reminder` (cron `0 9 * * *` daily) — due_date 도래 건 조회 후 담당자 알림
  3. lib/inngest/functions.ts `functions` 배열에 등록 (단일 진실 소스)
  4. INNGEST_EVENTS에 `CAPA_EFFECTIVENESS_DUE` 추가
- **의존성**: Task 2.4
- **재사용 증거**: `lib/inngest/functions.ts` (weeklyDigestFn, knowledgeGapDailyDigestFn 등록 패턴), `lib/inngest/client.ts:23 INNGEST_EVENTS`
- **완료 기준**: cron이 due_date 도래 건을 감지하고 audit 로그 남김

### Task 2.6: trend-detector.ts — #53 PMS 연결 (REQ-007)
- **파일**: `lib/capa/trend-detector.ts`
- **매핑**: REQ-007 (반복 불만 trend → PMS)
- **AC**: AC-06
- **내용**:
  1. `detectRepeatComplaintTrend(projectId, windowDays=90, threshold=3)` — 동일 product/issue category 반복 불만 집계
  2. 임계값 초과 시 capa_links에 target_type='pms' 링크 생성
  3. PMS 입력 신호로 pms_inputs 테이블 활용 (재사용)
- **재사용 증거**: `lib/db/schema.ts:1810 pms_inputs` 테이블, `lib/pms/inputs.ts`

### Task 2.7: linkage.ts — #46 Risk / #54 Change Control / #64 DHF 자동 연결 (REQ-008)
- **파일**: `lib/capa/linkage.ts`
- **매핑**: REQ-008 (CAPA 완료 → risk/change/DHF 자동 연결)
- **AC**: AC-03 (링크 누락 0건)
- **내용**:
  1. `linkCapaToDownstream(capaId)` — CAPA 완료 시 호출:
     - risk_items에 재평가 플래그 업데이트 (target_type='risk')
     - `assessChange()` 호출하여 change_assessments 레코드 생성 (target_type='change_control')
     - design_history_files에 업데이트 링크 (target_type='dhf')
  2. 모든 링크를 capa_links에 기록 (무결성 보장)
- **재사용 증거**:
  - `lib/change-control/engine.ts:83 assessChange(input, options)` — ChangeInput/AntessmentOutput 타입
  - `lib/db/schema.ts:1535 risk_items` (SPEC-REGULA-RISK-001)
  - `lib/db/schema.ts:1362 design_history_files` (SPEC-REGULA-DHF-001, #64)
- **완료 기준**: CAPA close 시 3개 링크가 capa_links에 존재 (누락 0건)

### Task 2.8: qms-sync.ts — #57 QMS stub (REQ-009, DEFERRED)
- **파일**: `lib/capa/qms-sync.ts`
- **매핑**: REQ-009 (QMS 양방향 동기화 — **stub만**, L-004 준수)
- **AC**: AC-05 (통합 테스트 — stub 레벨)
- **내용**:
  1. `exportQmsPayload(capaId)` — CAPA 상태를 JSON payload로 직렬화 (export 인터페이스)
  2. `importQmsStatus(payload)` — 외부 QMS에서 수신한 상태 적용 (no-op + 로그, 실제 통신 X)
  3. `@MX:TODO` 태그로 #57 구현 대기 표시
  4. follow-up issue: "SPEC-REGULA-QMS-001 (#57) 구현 시 qms-sync.ts 실제 통신 연결"
- **제약**: L-004 — #57 미구현이므로 인터페이스/no-op만. 직접 구현 금지.
- **의존성**: Task 2.4

### Task 2.9: close-gate.ts — reportable + Vigilance 검증 (REQ-011)
- **파일**: `lib/capa/close-gate.ts`
- **매핑**: REQ-011 (reportable인데 Vigilance 미연결 시 close 차단)
- **AC**: AC-07 (negative test)
- **내용**:
  1. `canCloseCapa(capaId, orgId)` — 서버 사이드 게이트:
     - complaint.reportability_status === 'reportable' && vigilance_ref IS NULL → `{ allowed: false, reason: 'vigilance_missing' }`
     - 링크 무결성 검증 (risk/change_control/dhf 링크 존재)
  2. 차단 시 audit(`capa.close_blocked_vigilance_missing`)
  3. 통과 시 audit(`capa.closed`) + 전자서명 요구
- **재사용 패턴**: `lib/labeling/export-gate.ts:25 canExportLabelingDocument()` — 동일한 gate + blockingReason 패턴
- **완료 기준**: reportable + 미연결 시 403 반환 (서버 게이트, 우회 불가)

### Task 2.10: audit.ts — CAPA 감사 래퍼 (REQ-010)
- **파일**: `lib/capa/audit.ts`
- **매핑**: REQ-010 (각 단계 audit_logs)
- **AC**: AC-04 (감사 로그 100%)
- **내용**:
  1. 7개 감사 헬퍼 함수 (각 audit_action에 대응)
  2. lib/vigilance/audit.ts 패턴 준용 (writeAudit 래퍼)
- **재사용 증거**: `lib/vigilance/audit.ts` (auditVigilanceEventCreated 등 4개 래퍼 패턴)

---

## Phase 3 — API Route Handlers (7 endpoints)

### Task 3.1: complaint intake API (REQ-001)
- **파일**: `app/api/ra/capa/complaints/route.ts`
- **매핑**: REQ-001, REQ-012 (RBAC)
- **내용**: `POST /api/ra/capa/complaints` — withPermission 래핑, createComplaint 호출

### Task 3.2: reportability API (REQ-002)
- **파일**: `app/api/ra/capa/complaints/[id]/reportability/route.ts`
- **매핑**: REQ-002
- **내용**: `POST .../reportability` — assessComplaintReportability 호출

### Task 3.3: CAPA records API (REQ-004, REQ-005)
- **파일**: `app/api/ra/capa/records/route.ts`
- **매핑**: REQ-004, REQ-005
- **내용**: `POST /api/ra/capa/records` — createCapaRecord (corrective/preventive 분리)

### Task 3.4: root-cause API (REQ-003)
- **파일**: `app/api/ra/capa/records/[id]/root-cause/route.ts`
- **매핑**: REQ-003

### Task 3.5: effectiveness API (REQ-006)
- **파일**: `app/api/ra/capa/records/[id]/effectiveness/route.ts`
- **매핑**: REQ-006

### Task 3.6: close API — gate + ESIG (REQ-010, REQ-011, REQ-012)
- **파일**: `app/api/ra/capa/records/[id]/close/route.ts`
- **매핑**: REQ-010, REQ-011, REQ-012
- **AC**: AC-07, AC-08
- **내용**:
  1. canCloseCapa() 게이트 통과 (REQ-011)
  2. ESIG 전자서명 요구 (lib/signature/ 재사용)
  3. linkCapaToDownstream() 호출 (REQ-008)
  4. withPermission으로 RBAC 강제 (REQ-012)
- **재사용**: `lib/signature/` (hash, authorization, lock), `lib/auth/with-permission.ts:46 withPermission()`

### Task 3.7: QMS sync API (REQ-009, stub)
- **파일**: `app/api/ra/capa/qms-sync/route.ts`
- **매핑**: REQ-009
- **내용**: `GET/POST /api/ra/capa/qms-sync` — stub export/import (Task 2.8 호출)

---

## Phase 4 — Permissions (REQ-012)

### Task 4.1: PermissionAction 7개 추가
- **파일**: `lib/auth/permissions.ts` (edit)
- **매핑**: REQ-012 (RBAC)
- **내용**: 51개 → 58개 PermissionAction 추가:
  - `complaint.create`, `complaint.assess_reportability`
  - `capa.create`, `capa.root_cause`, `capa.effectiveness`, `capa.close`
  - `capa.qms_sync`
  - 각각 PERMISSIONS 맵에 PermissionSpec(resourceType, scope, allowedRoles) 정의
- **의존성**: Task 1.2 (enum 동기화)
- **완료 기준**: withPermission이 모든 신규 액션에 대해 RBAC 강제

---

## Phase 5 — UI (app/(app)/capa/)

### Task 5.1: CAPA 워크벤치 메인 페이지
- **파일**: `app/(app)/capa/page.tsx`, `app/(app)/capa/[id]/page.tsx`
- **내용**: 불만 목록, CAPA 상세 보기, 상태 전이 워크플로우 UI
- **재사용**: 기존 워크벤치 레이아웃 패턴 (app/(app)/workflows/)

### Task 5.2: complaint intake 폼 + reportability 분기
- **파일**: `app/(app)/capa/new/page.tsx`
- **내용**: 구조화 입력 폼, reportability 결과 표시, Vigilance 연결 버튼

### Task 5.3: root cause 편집기 (5 Whys / Fishbone)
- **파일**: `app/(app)/capa/[id]/root-cause/page.tsx`
- **내용**: 5 Whys 순차 입력, Fishbone 6M 카테고리 입력

---

## Phase 6 — E2E & 통합 테스트

### Task 6.1: E2E — complaint → CAPA 분기 (AC-01)
- **매핑**: AC-01
- **내용**: complaint 접수 → reportability → CAPA 생성 전체 흐름

### Task 6.2: 통합 — effectiveness 알림 (AC-02)
- **매핑**: AC-02
- **내용**: Inngest 스케줄러 due_date 도래 알림

### Task 6.3: 통합 — 링크 무결성 (AC-03)
- **매핑**: AC-03
- **내용**: CAPA close 시 risk/change/DHF 링크 누락 0건

### Task 6.4: 통합 — 감사 로그 100% (AC-04)
- **매핑**: AC-04

### Task 6.5: 통합 — QMS stub 동기화 (AC-05)
- **매핑**: AC-05

### Task 6.6: 통합 — trend → PMS (AC-06)
- **매핑**: AC-06

### Task 6.7: negative — close 차단 (AC-07)
- **매핑**: AC-07
- **내용**: reportable + Vigilance 미연결 시 403

### Task 6.8: negative — RBAC 거부 (AC-08)
- **매핑**: AC-08

---

## DEFERRED (follow-up issues)

1. **#57 QMS 실제 통신**: SPEC-REGULA-QMS-001 구현 후 qms-sync.ts stub을 실제 외부 QMS 통신으로 교체 (L-004 준수, 현재는 no-op)

## 위험

| 위험 | 완화 |
|------|------|
| assessChange 호출 시 RAG 의존성 | 테스트에서 stubVerdict 패턴 재사용 (fetchFn 생략) |
| Inngest cron 등록 누락 | lib/inngest/functions.ts 배열 편집 필수 (단일 진실 소스) |
| reportability false negative | assessReportability 직접 호출 (랩퍼만 작성, 로직 수정 X) |
