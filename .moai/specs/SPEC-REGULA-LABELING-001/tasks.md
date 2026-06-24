# SPEC-REGULA-LABELING-001 — 구현 태스크 분해

> **브랜치**: `feat/issue-66` (base `5ec86c5`)
> **SPEC**: `.moai/specs/SPEC-REGULA-LABELING-001/spec.md`
> **참조 모델**: SPEC-REGULA-CHANGE-CONTROL-001 (#54, 머지됨), SPEC-REGULA-CLASSIFY-001 (#59), SPEC-REGULA-TRACEABILITY-001 (#47)
> **방법론**: TDD (RED-GREEN_REFACTOR), Brownfield Enhancement 적용

---

## 검증된 베이스라인 (직접 grep으로 확인)

| 항목 | 현재 값 | 출처 |
|------|---------|------|
| `workflow_type` pgEnum | **14** 값 | `lib/db/schema.ts:318` |
| `audit_action` pgEnum | **133** 값 | `lib/db/schema.ts:115` (마이그레이션 ALTER TYPE 누적 106 + 사전 선언 27) |
| `PermissionAction` union | **45** 값 (실제 액션) | `lib/auth/permissions.ts:8` (`none`, `project`, `user` 등 비액션 3개 제외 시 42~45) |
| 다음 migration 번호 | **0072** | `migrations/0071_change_control.sql` 최신 |
| `lib/labeling/` | **미구현** (신규 생성) | `find` 결과 empty |
| `app/(app)/labeling/` | **미구현** (신규 생성) | `find` 결과 empty |
| Change Control `ChangeType.labeling` | **이미 존재** | `lib/change-control/types.ts:10`, `lib/change-control/classify.ts:51` |

---

## Phase 1 — DB 스키마 및 마이그레이션 (REQ-LABEL-001, 010, 011, 012)

### Task 1.1: migration 0072 — 라벨링 테이블 및 enum 확장
- [ ] `migrations/0072_labeling.sql` 작성
- [ ] **workflow_type 확장**: `'labeling'` 추가 (14 → **15**)
- [ ] **audit_action 확장** (6개 추가, 133 → **139**):
  - `label.document_created`
  - `label.claim_validated`
  - `label.claim_citation_rejected` (citation 없는 claim expert-review 강제 시)
  - `label.translation_diff_detected`
  - `label.approved`
  - `label.export_blocked` (unsupported claim 존재 시)
- [ ] `labeling_documents` 테이블 (project_id FK, jurisdiction, status, review_status, org_id, RLS)
- [ ] `labeling_sections` 테이블 (document_id FK, section_type, content, locale)
- [ ] `labeling_claims` 테이블 (section_id FK, claim_text, claim_type, citation_ref)
- [ ] `labeling_claim_citations` 테이블 (claim_id FK, source, section, excerpt — change_verdict_citations 패턴 재사용)
- [ ] `labeling_translations` 테이블 (section_id FK, source_locale, target_locale, semantic_diff_status, approval_status)
- [ ] RLS 정책 (tenant_isolation, change_assessments 패턴 복제)
- [ ] 인덱스 (project_id, org_id, document_id)
- [ ] `lib/db/schema.ts` pgEnum 확장 (workflowTypeEnum, auditActionEnum)
- [ ] Drizzle 테이블 정의 추가 (`labelingDocuments`, `labelingSections`, `labelingClaims`, `labelingClaimCitations`, `labelingTranslations`)
- **매핑**: REQ-LABEL-001, REQ-LABEL-010, REQ-LABEL-011 | AC-01

### Task 1.2: PermissionAction 확장
- [ ] `lib/auth/permissions.ts`에 라벨링 권한 추가:
  - `label.create` — 문서 생성/편집
  - `label.view` — 조회
  - `label.approve` — RA 승인 게이트 (REQ-LABEL-012)
  - `label.export` — export (unsupported claim 0건 시만)
- [ ] `PERMISSIONS` 레코드에 PermissionSpec 추가 (roles 매핑: RA Lead/Tech Writer만 approve)
- **매핑**: REQ-LABEL-012 | AC-08

---

## Phase 2 — 도메인 로직 (lib/labeling/)

### Task 2.1: section-builder.ts — 구조화 섹션 작성기
- [ ] `lib/labeling/section-builder.ts` — 섹션 타입 정의 및 빌더
- [ ] `SectionType` union: `intended_use | indication | contraindication | warning | precaution`
- [ ] 섹션 CRUD (traceability/graph.ts upsertNode 패턴 참조)
- **매핑**: REQ-LABEL-001 | AC-01

### Task 2.2: jurisdiction-checklist.ts — 관할권별 필수 표시사항
- [ ] `lib/labeling/jurisdiction-checklist.ts`
- [ ] `Jurisdiction` union 재사용: `'FDA' | 'EU_MDR' | 'MFDS' | 'NMPA' | 'PMDA'` (change-control/types.ts와 동일)
- [ ] `REQUIRED_LABEL_ELEMENTS: Record<Jurisdiction, LabelElement[]>` — 각 관할권 필수 항목 매핑
- [ ] FDA: 21 CFR 801 기반 (device name, manufacturer, intended use, warnings, Rx/OTC 등)
- [ ] EU MDR: Annex I Chapter III 기반 (UDI, CE 마크, IFU 제공 등)
- [ ] MFDS: 의료기기법 표시기재 기준
- [ ] PMDA/NMPA: 각국 라벨링 기준
- [ ] `evaluateChecklist(document, jurisdiction)` — 누락 항목 감지, 100% 커버리지 반환
- [ ] 단위 테스트: 각 관할권별 필수 항목 100% 매핑 검증
- **매핑**: REQ-LABEL-002, REQ-LABEL-011 | AC-01

### Task 2.3: claim-validator.ts — claim ↔ citation 검증
- [ ] `lib/labeling/claim-validator.ts`
- [ ] `ClaimType` union: `supported | comparative | superiority | unsupported`
- [ ] `validateClaimCitations(claim, citations)` — classify/validate.ts `validateCitations` 패턴 재사용
  - citation이 없거나 매칭 실패 시 → `expert_review_required` 상태, 경고
  - identifierMatches 로직 재사용 (normalizeId, token-set overlap)
- [ ] `detectUnsupportedClaim(claim, citations)` — citation 미연결 claim 감지
- **매핑**: REQ-LABEL-003, REQ-LABEL-004 | AC-02

### Task 2.4: comparable-detector.ts — comparative/superiority 자동 감지
- [ ] `lib/labeling/comparable-detector.ts`
- [ ] 키워드 휴리스틱 (MVP):
  - comparative: `compared to`, `compared with`, `in comparison`, `versus`, `vs.`, `비교`
  - superiority: `superior`, `better than`, `more effective`, `outperforms`, `faster than`, `우수`, `더 효과`
  - safety/effectiveness 주장: `safe`, `effective`, `safety`, `안전`, `효과`
- [ ] `detectComparativeClaim(claimText): { isComparative: boolean; isSuperiority: boolean; matchedKeywords: string[] }`
- [ ] 감지 시 자동 경고 플래그 반환 (UI에서 경고 표시)
- [ ] 단위 테스트: 오탐/미탐 시나리오 (REQ-LABEL-005)
- **매핑**: REQ-LABEL-005 | AC-04

### Task 2.5: translation-diff.ts — 번역 의미 차이 검출
- [ ] `lib/labeling/translation-diff.ts`
- [ ] **MVP 접근법 결정**: 휴리스틱 + 옵션 LLM 하이브리드
  - Phase 1 (MVP): 휴리스틱 — 키워드 매핑 테이블 (경고/금기 용어 사전), 숫자/단위 불일치 감지, 섹션 구조 diff
  - Phase 2 (선택): LLM 기반 의미 diff — `createHybridRaFetch` stub 패턴 재사용 (createHybridRaFetch가 endpoint 반환 시만 활성, 미설정 시 휴리스틱 fallback)
- [ ] `detectSemanticDiff(sourceText, sourceLocale, targetText, targetLocale): SemanticDiffResult`
- [ ] `SemanticDiffStatus`: `match | minor_diff | major_diff | review_required`
- [ ] RA 승인 게이트 연동: `major_diff` 시 승인 required
- **매핑**: REQ-LABEL-007 | AC-05
- **결정 근거**: 번역 LLM은 오탐/비용 트레이드오프. MVP는 휴리스틱으로 핵심 규제 용어(금기, 경고, 적응증) 불일치만 잡고, LLM은 선택적 하이브리드로. 이유: (1) CER/PCCT의 createHybridRaFetch 패턴이 이미 stub-optional 검증됨, (2) 핵심 의료기기 용어는 사전 매핑이 정확도 높음

### Task 2.6: change-control-link.ts — #54 Change Control 연결
- [ ] `lib/labeling/change-control-link.ts`
- [ ] **재사용**: `lib/change-control/classify.ts` `classifyChangeType`이 이미 `'labeling'` 감기 (classify.ts:51 확인)
- [ ] `linkLabelingChangeToChangeControl(documentId, changeDescription)`:
  - 기존 `change_assessments` 테이블에 `change_type='labeling'` 행 생성 (또는 기존 assessment에 link)
  - `change-control/engine.ts` assessChange 호출 시 `changeType: 'labeling'` 전달
- [ ] **이미 구현된 인프라 재사용** (L-002 준수): ChangeType union에 labeling 이미 있음, jurisdiction DEFAULT_VERDICT_HINT에 labeling 매핑 이미 있음 (jurisdictions.ts:62)
- [ ] 라벨링 변경 발생 시 자동 호출 훅
- **매핑**: REQ-LABEL-008 | AC-06

### Task 2.7: export-gate.ts — unsupported claim export 제한
- [ ] `lib/labeling/export-gate.ts`
- [ ] **재사용**: PMS export gating 패턴 (0070_pms_export_gating.sql, `pms.report_export_denied`)
- [ ] `canExportLabelingDocument(documentId): { allowed: boolean; blockingClaims: string[] }`
  - unsupported claim 0건 확인
  - 미확인 expert-review-required claim이 있으면 차단
- [ ] 차단 시 `label.export_blocked` audit 기록, 403 반환
- [ ] 승인 시 `label.document_approved` audit, export 허용
- **매핑**: REQ-LABEL-006, REQ-LABEL-010 | AC-03

---

## Phase 3 — API 라우트 (app/api/labeling/)

### Task 3.1: POST /api/labeling/documents — 문서 생성
- [ ] `app/api/labeling/documents/route.ts`
- [ ] `withPermission('label.create', ...)` 래핑
- [ ] Zod 스키마 검증 (projectId, jurisdiction)
- [ ] `assertProjectOrgAccess` IDOR 방어 (PMS/change-control 패턴)
- [ ] `label.document_created` audit 기록
- **매핑**: REQ-LABEL-001, REQ-LABEL-010 | AC-01

### Task 3.2: POST /api/labeling/documents/[id]/claims — claim 입력·검증
- [ ] `app/api/labeling/documents/[id]/claims/route.ts`
- [ ] claim-validator + comparable-detector 호출
- [ ] citation 없으면 `expert_review_required` 상태로 저장, 경고 반환
- [ ] `label.claim_validated` 또는 `label.claim_citation_rejected` audit
- **매핑**: REQ-LABEL-003, REQ-LABEL-004, REQ-LABEL-005 | AC-02, AC-04

### Task 3.3: GET /api/labeling/documents/[id]/checklist — 관할권 체크리스트
- [ ] `app/api/labeling/documents/[id]/checklist/route.ts`
- [ ] `?jurisdiction=FDA|EU_MDR|MFDS|PMDA|NMPA` 쿼리 파라미터
- [ ] `evaluateChecklist` 호출, 누락 항목 + 커버리지 % 반환
- **매핑**: REQ-LABEL-002, REQ-LABEL-011 | AC-01

### Task 3.4: POST /api/labeling/documents/[id]/translations — 번역 등록·diff
- [ ] `app/api/labeling/documents/[id]/translations/route.ts`
- [ ] `detectSemanticDiff` 호출
- [ ] `major_diff` 시 승인 대기 상태 전환
- [ ] `label.translation_diff_detected` audit (diff 감지 시)
- **매핑**: REQ-LABEL-007 | AC-05

### Task 3.5: POST /api/labeling/documents/[id]/approve — RA 승인 게이트
- [ ] `app/api/labeling/documents/[id]/approve/route.ts`
- [ ] `withPermission('label.approve', ...)` — RA Lead 전용 (REQ-LABEL-012)
- [ ] 승인 전제조건: unsupported claim 0건, 번역 diff 해결, 체크리스트 100%
- [ ] `label.approved` audit
- [ ] #65 eSubmit 포워드 훅 호출 (인터페이스만, 미구현 시 no-op + 로그)
- **매핑**: REQ-LABEL-006, REQ-LABEL-009, REQ-LABEL-012 | AC-03, AC-07, AC-08

### Task 3.6: POST /api/labeling/documents/[id]/export — 내보내기
- [ ] `app/api/labeling/documents/[id]/export/route.ts`
- [ ] `withPermission('label.export', ...)`
- [ ] `canExportLabelingDocument` 게이트 — unsupported claim 0건만 허용
- [ ] 차단 시 403 + `label.export_blocked` audit
- [ ] 허용 시 export-hub `register(new LabelingExporter())` 패턴으로 출력
- **매핑**: REQ-LABEL-006, REQ-LABEL-010 | AC-03

---

## Phase 4 — UI (app/(app)/labeling/)

### Task 4.1: 라벨링 워크벤치 메인 페이지
- [ ] `app/(app)/labeling/page.tsx` — 문서 목록
- [ ] `app/(app)/labeling/[documentId]/page.tsx` — 문서 편집기
- [ ] 섹션별 탭 UI (intended_use, indication, contraindication, warning, precaution)
- [ ] 관할권 선택 드롭다운 (체크리스트 실시간 표시)
- **매핑**: REQ-LABEL-001, REQ-LABEL-002 | AC-01

### Task 4.2: claim 입력 및 검증 UI
- [ ] `app/(app)/labeling/[documentId]/claims/page.tsx` 또는 인라인 컴포넌트
- [ ] claim 입력 시 실시간 citation 연결 프롬프트
- [ ] citation 없으면 경고 배지 (expert review required)
- [ ] comparative/superiority 자동 감지 시 경고 표시
- [ ] i18n 적용 (ko/en)
- **매핑**: REQ-LABEL-003, REQ-LABEL-004, REQ-LABEL-005 | AC-02, AC-04

### Task 4.3: 번역 diff 및 승인 UI
- [ ] 번역 등록 패널
- [ ] 의미 차이 시각화 (major_diff 하이라이트)
- [ ] RA 승인 버튼 (권한 게이트)
- **매핑**: REQ-LABEL-007, REQ-LABEL-012 | AC-05, AC-08

---

## Phase 5 — 통합 및 외부 의존성 훅

### Task 5.1: #65 eSubmit 포워드 훅 (인터페이스만)
- [ ] `lib/labeling/esubmit-bridge.ts`
- [ ] 승인 완료 시 `lib/esubmit/validators.ts` `validateSubmissionPackage` 호출하여 라벨링 섹션 추가
- [ ] **미구현 의존성 처리 (L-002/L-004 준수)**: eSubmit 패키지 생성 로직이 미구현이므로, 인터페이스/타입 정의만 + no-op stub. follow-up 이슈 권고.
- **매핑**: REQ-LABEL-009 | AC-07
- **DEFERRED**: #65 eSubmit 실제 패키지 생성은 #65 구현 후 활성화

### Task 5.2: #47 Traceability claim↔evidence 연결
- [ ] `lib/labeling/traceability-integration.ts`
- [ ] `lib/traceability/graph.ts` `upsertNode`로 claim 노드 생성
- [ ] claim의 citation을 evidence edge로 연결 (traceability/verify-edges.ts 패턴)
- [ ] **이미 구현된 인프라 재사용** (L-002 준수): traceability 모듈 완성됨
- **매핑**: REQ-LABEL-003 (claim ↔ citation 연결의 evidence 그래프 통합)

### Task 5.3: 감사 로깅 통합
- [ ] 모든 API 라우트에 `writeAudit` 호출 확인
- [ ] audit_action 6개 신규 값 매핑 검증
- **매핑**: REQ-LABEL-010 | 전체 AC

---

## Phase 6 — 품질 게이트

### Task 6.1: 단위 테스트
- [ ] `lib/labeling/__tests__/section-builder.test.ts`
- [ ] `lib/labeling/__tests__/jurisdiction-checklist.test.ts` — 각 관할권 100% 커버리지 (AC-01)
- [ ] `lib/labeling/__tests__/claim-validator.test.ts` — citation 없는 claim expert-review 강제 (AC-02)
- [ ] `lib/labeling/__tests__/comparable-detector.test.ts` — comparative/superiority 감지 (AC-04)
- [ ] `lib/labeling/__tests__/translation-diff.test.ts` — 의미 차이 검출 (AC-05)
- [ ] `lib/labeling/__tests__/export-gate.test.ts` — unsupported claim export 제한 (AC-03)

### Task 6.2: 통합/E2E 테스트
- [ ] 라벨링 변경 → change-control 자동 생성 E2E (AC-06)
- [ ] 권한 없는 승인 시도 RBAC negative test (AC-08)
- [ ] 승인본 eSubmit 패키지 포함 integration test (AC-07, stub 환경)

### Task 6.3: RBAC 및 보안 검증
- [ ] 모든 라우트 `withPermission` 적용 확인
- [ ] RLS 정책 적용 확인 (tenant_isolation_labeling_*)
- [ ] IDOR 방어 (assertProjectOrgAccess) 확인

---

## 위험 및 DEFERRED 항목

| 항목 | 상태 | 대응 |
|------|------|------|
| #65 eSubmit 실제 패키지 생성 | **DEFERRED** | 인터페이스/stub만 구현, follow-up 이슈 권고 |
| #40 Strategy 시장별 claim 전략 | **DEFERRED** | 입력 인터페이스만, 실제 데이터 도착 시 활성화 |
| #42 Crossmarket 관할권 갭 분석 | **DEFERRED** | 체크리스트 갭 분석은 자체 구현, crossmarket 연동은 훅만 |
| #64 DHF 설계 산출물 연결 | **DEFERRED** | 링크 인터페이스만, DHF 구현 후 활성화 |
| 번역 LLM 의미 diff | **MVP** | 휴리스틱 우선, LLM 하이브리드는 선택적 |
| comparable 키워드 오탐/미탐 | **리스크** | 키워드 사전 지속 보완, RA 검수 게이트로 보완 |

---

## 수행 순서 (의존성 기반)

1. **Task 1.1, 1.2** (DB/권한) → 모든 것의 기반
2. **Task 2.1~2.7** (도메인 로직) → 병렬 가능 일부 존재 (2.3은 2.4 독립, 2.6은 2.1 이후)
3. **Task 3.1~3.6** (API) → Task 2 완료 후
4. **Task 4.1~4.3** (UI) → Task 3 API 완료 후
5. **Task 5.1~5.3** (통합) → Task 3과 병렬 가능
6. **Task 6.1~6.3** (품질) → 각 Phase 완료 시점에 TDD로 함께

---

## AC 매핑 요약

| AC | 태스크 | 검증 방법 |
|----|--------|-----------|
| AC-01 | 1.1, 2.1, 2.2, 3.3, 4.1 | 단위 테스트 (관할권별 필수 항목 매핑) |
| AC-02 | 2.3, 3.2, 4.2 | 통합 테스트 (citation 없는 claim expert-review 강제) |
| AC-03 | 2.7, 3.5, 3.6 | negative 테스트 (unsupported claim 0건 export) |
| AC-04 | 2.4, 3.2, 4.2 | 단위 테스트 (comparative/superiority 감지) |
| AC-05 | 2.5, 3.4, 4.3 | 통합 테스트 (한/영 의미 차이 검출) |
| AC-06 | 2.6, 5.2 | E2E (라벨링 변경 → change-control 생성) |
| AC-07 | 5.1, 3.5 | 통합 테스트 (eSubmit 패키지 포함, stub 환경) |
| AC-08 | 1.2, 3.5, 6.3 | RBAC negative 테스트 (권한 없는 승인 거부) |
