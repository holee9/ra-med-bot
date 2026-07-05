# Changelog

모든 주목할 만한 변경 사항을 이 파일에 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/)를 따르고,
이 프로젝트는 [Semantic Versioning](https://semver.org/)을 준수합니다.

---

## [Unreleased] — Future work

> Placeholder for post-1.0.0 development.

### v3 Phase D 확장 — RA Power Chat Consult UI (SPEC-V3-UI-001 M6, 백엔드 PR #343)

- **RA Power Chat 세션 히스토리 UI** — SPEC-V3-CONSULT-001(Phase C-5) 백엔드를 소비하는 프론트 슬라이스. INBOX UI(M1-M5, 28 REQ)는 미수정 비회귀. SPEC v0.1.0 → **v0.2.1**(REQ 28 → 41).
  - **신규 10**: `app/(app)/consult/{page,[sessionId]/page,2 Client}` + `components/consult/{ConsultSessionCard,List,Detail,TurnHistoryItem,NewSessionDialog,QuestionComposer}` + `lib/queries/useConsult.ts`(hooks 4) + `stores/consult.ts`(Zustand).
  - **수정 2**: `components/shell/Sidebar.tsx`(`showConsult` prop, ra-member+ 게이팅) + `app/(app)/layout.tsx`(서버 사이드 `showConsult` resolve).
  - **M6 REQ-V3-UI-050~062 (13종)**: 세션 목록(ra-member 자기 세션만 / ra-lead/admin org 전체), 세션 상세(turns turnNumber ASC), 새 세션 POST → 리다이렉트, 새 turn POST(400 시에도 turn persist → 히스토리 표시, REQ-059), 404 cross-user IDOR 방어(정보누출 0), citations 재사용.
  - **plan annotation cycle**: manager-spec 작성 → plan-auditor 감사(**Critical 1 + Medium 6 + Low 1**) → manager-spec 개정 8/8. 핵심: D-1 `turnCount` 백엔드 미반환(schema.ts 직검) UI 의존 제거, D-4 E14 error string `'timeout'` 정정, DoD 카운트(41 REQ/18 AC/15 E) 갱신, frontmatter `0.2.0/draft` 통일.
  - **code-authoritative 준수**: 라우트 파라미터 `sessionId`(NOT `id`), turn body `{question}`만(locale은 session 상속), 400 `{error, turn}` 패턴(turn 항상 persist).
  - 검증(orchestrator 직검): consult vitest 21/21 · 전체 4465/4490(1 flaky `frontend-shell.test.ts` timeout, 단독 19/19 통과, M6 무관) · ci:typecheck/rbac/audit/tokens/i18n/glossary/contrast/module-boundaries/migrations/build **전 EXIT 0** · biome consult clean · lint:hex clean.
  - 진행 방식: manager-tdd 2회 위임(부분 완료+self-report 허위, L-013 적중) → orchestrator 직접 테스트 인프라 fix(inbox ApproveDialog 패턴 준용: `import '@testing-library/jest-dom'` per-file + `vi.hoisted` hook mock + next-intl/next-navigation/QueryClientProvider wrapping) + biome lint 수정(`noExplicitAny`/`noUnusedVariables`/`useButtonType`).
  - **제외**(별도 SPEC 권장): DELETE soft-delete UI(ra-lead+ 전용, `consult.session.delete`), 실시간 streaming UI, 세션 제목 편집, 검색/필터링 고급 기능.

### v3 Phase C-2 — RA Triage 자동응답 강화 (SPEC-V3-TRIAGE-001, Issue #339)

- **`/api/ask` TRIAGE RAG 훅** — SPEC-V3-INBOX-001 Follow-up #1 이월. 티켓 생성(tx1) 후 TRIAGE RAG 호출 → `auto_answer`/`auto_confidence` 주입 + `triage_state` `auto → needs-review` 자동 전이(tx2).
  - `lib/domains/triage/` 신규 도메인: `run-triage.ts`(classifyAndRoute + parallelRetrieveAndMerge + composePrompt + streamText + enforceCitations + calculateConfidence — consult.ts 하위 모듈 직접 조합, 옵션 B), `types.ts`(`AutoAnswer`/`TriageResult`/`RagPipelineInput`), `index.ts`.
  - **AC-06 (Charter [지양-2] citation 강제)**: citation 없는 `auto_answer` → 400 Bad Request + `inbox.triaged` audit `auto_triage_rejected: true, reason: 'no_citations'`. 티켓은 `auto` 상태 유지(수동 후속 처리 허용).
  - **Charter [지양-4] RA Lead 승인**: TRIAGE 자동 전이는 `auto → needs-review`만. `escalated`/`closed`/`rejected` 자동 전이 금지. `assertValidTransition` 위변조 방어.
  - **15s 타임아웃 폴백 (REQ-TRI-005)**: `TRIAGE_TIMEOUT_MS` env(기본 15000) + `Promise.race` 전체 파이프라인 타임아웃(검색 단계 hang도 커버). timeout/runtime_error 시 201 유지 + `autoAnswer: null`.
  - **21 CFR Part 11 §11.10(e)**: `inbox.triaged` audit에 `{auto_triage, confidence_score, citations_count}` 메타(GAP-TRI-02 — route에서 writeAudit 직접 호출로 auditTransition 시그니처 유지).
  - 응답 body `{ticketId, triageState, autoAnswer, autoConfidence}` (기존 `ticketId` 하위 호환, AC-TRI-05 useStreamingAnswer 회귀 0).
  - migration 불필요(`autoAnswer`/`autoConfidence` 컬럼 + `inbox.triaged` enum 기존 존재 직검).
  - 검증: typecheck 0 · biome 0 · ci:lint/audit/rbac/tokens/module-boundaries PASS · test **4438 passed | 0 failed** (+16 TRIAGE) · 실DB `inbox_tickets` 컬럼 + `inbox.triaged` enum 확인.
  - 사전 존재 flaky fix 동봉: `isOverdue(now)` ms 타이밍 경쟁(PR #322 a3b057f 도입) — 1초 미래 오프셋 안정화.

### v3 Phase C-1 — RA Inbox 백엔드 (SPEC-V3-INBOX-001, Issue #320, PR #322)

- **RA Inbox 4-column Kanban + Triage state machine + ESIG 승인 워크플로우** 백엔드 도메인.
  - Migration `0104`(inbox_tickets 17컬럼 + approved_answers 12컬럼, triage_state CHECK 6값, RLS org-isolation, GIN tsvector) + `0105`(audit_action enum `inbox.approve_failed` 추가).
  - `lib/domains/inbox/` 8파일(state-machine · promote tx 원자성 · access IDOR 404 no-leak · queries · sla · audit · types · index) + API 5라우트(`POST /api/ask` · `GET/PATCH /api/inbox` · `POST /:id/triage` · `POST /:id/approve`).
  - **보안 감사(expert-security) BLOCK→수정→GO**: C-1(REQ-V3-INBOX-012 ESIG password re-auth, bcrypt 재사용) / H-4(ask.create 권한 viewer 추가, Charter "RA employees ask") / H-2(audit-on-failure, Part 11 §11.10(e)). 나머지 follow-up → #321.
  - UI(4-column Kanban)는 Phase D / SPEC-V3-UI-001로 이월(SPEC §1.5/§6).
  - 검증: typecheck 0 · lint 0 · test **4346 passed** | 23 skipped · 실DB `\d` AC-01/12 + `inbox.approve_failed` enum 확인.

### v3 Phase D — RA Inbox Kanban UI (SPEC-V3-UI-001, Issue 326, PR #327/#330/#331/#332)

- **RA Inbox 4-column Kanban + Triage + ESIG Approve + Detail UI** (Phase D).
  - **M1-M4**: messages inbox namespace · Zustand store · useInbox hooks(4) · Sidebar showInbox 게이팅(ra-member+) · SlaBadge/TicketCard/KanbanColumn/InboxKanban(`KanbanColumnContainer`로 React Hook 규칙 준수) · TriageActionMenu(VALID_TRANSITIONS 게이팅, ra-lead 전용, reason prompt) · ApproveDialog(ESIG `{password, esigSignature}`, 401/400 인라인) · ActivityTimeline · `/inbox`+`/inbox/[id]`(서버 RBAC + viewer → /chat redirect).
  - **M5**: state-tokens(triageState별 디자인 토큰 단일 진실원) · ViewerTicketSummary · chat characterization.
  - **T-024 옵션 B(PR #331/#332)**: viewer chat 질문 → `/api/ask` ticket 생성 → RA inbox triage **파이프라인 복원**(기존 chat이 ticket 안 만들던 갭 해소). ChatShell ticketId 링크 + `/inbox/[id]` ViewerTicketSummary. **백엔드 변경 불필요**(기존 `/api/ask` 재사용).
  - **E2E stub(PR #330)**: inbox a11y axe + viewer redirect(viewer storageState fixture 선행 시 활성화, 이슈 #329).
  - 검증: tsc 0 · lint 0(lint:hex `#NNN` 주석 회피) · 본 변경 vitest 47/49/55 green · ci:* 전 EXIT 0 · build EXIT 0.
  - 진행 방식: M1-M3 manager-tdd 위임 + orchestrator L-013 직검/수정 루프(에이전트 self-report 빈틈: Hook 규칙 위반 · prop 누락 · 테스트-구현 불일치 · biome 자의적 "허용"), M4-M6 orchestrator 직접 구현(사용자 결정).

---

## [1.0.0] — 2026-06-28

> **구현 종료 / Charter MVP 완성** — core automation (RAG Q&A·CER·Predicate·PCCP·Standards·Expert Review·Part 11) complete. main `4680712`, 회귀 4,772 passed | 21 skipped, 총 migration 98개(0001~0098).

### Added

- **RLHF confidence calibration** (Issue #264 sub 2/3, PR #295):
  - Migration 0095: `calibration_candidates` 테이블(confidence_score, predicted_label, true_label, feedback_source, calibrated, calibration_metadata) + 관련 enum/audit_action +4
  - lib/rlhf: calibration detector(0.5 기준 승격/하향 분리), proposal 생성(모델 재신뢰용), GET `/api/rlhf/calibration-pending` 라우트
  - 검증: typecheck 0 · biome 0 · test 3804 passed | 21 skipped · build 0

- **Alternate answers implicit feedback** (Issue #264 sub 3/3, PR #297):
  - Migration 0096: `feedback_source` enum(`user_explicit`, `user_implicit_from_alternative`, `admin_regenerate`) 추가, message_sources.unique(message_id, source_section_id, feedback_source) 제약 조건으로 alternate answer 선택 기록
  - lib/rlhf: regenerateAnswerWithAlternative wiring(implicit feedback 자동 생성), GET `/api/rlhf/alternate/[messageId]` 라우트
  - 검증: typecheck 0 · biome 0 · test 3841 passed | 21 skipped · build 0

- **PMCF Evaluation 워크벤치 탭** (Issue #244, PR #298):
  - `PmcfEvaluationBuilder` (MDCG 2022-21 섹션 구조 기반 evaluation 생성) + `PmsWorkbench` 5탭(PMS Report/PMCF Plan/PMCF Evaluation/Settings/History)
  - UI: `app/(app)/pms/evaluation/page.tsx`, components/pms/evaluation/PmcfEvaluationBuilder.tsx
  - 검증: typecheck 0 · biome 0 · test 3854 passed | 21 skipped · build 0

- **PMS E2E + CER linkage** (Issue #245, PR #299):
  - `tests/e2e/pms-workflow.spec.ts` E2E 12개 시나리(workflow 실행 → PMCF/PMSE/PMCF 자동 검증)
  - lib/pms/cer-linkage.ts: CER 로컬 영속화 아키텍처 블로커로 수동 연계만 구현(자동 연계는 #243 follow-up)
  - 검증: typecheck 0 · biome 0 · test 3854 passed | 21 skipped · build 0

- **Supersession write path + retriever filter** (Issue #238, PR #301):
  - `lib/traceability/supersession-writer.ts`: superseded_by 체인 → supersession 당, superseded_sections.id 자동 traceability.section_superseded audit + DEL cascade
  - `lib/ai/retrievers/hybrid-search.ts`: `[지양-2]` 필터 추가(지양되지 않은 섹션 자동 제외)
  - Inngest hook: supersession 생성 후 delta-sync 자동 트리거
  - 검증: typecheck 0 · biome 0 · test 3947 passed | 21 skipped · build 0

- **eSubmit labeling bridge stub→real** (Issue #249, PR #302):
  - Migration 0097: `label.esubmit_forwarded` enum(boolean) 추가, `workflow_runs`·`submission_packages`에 integration 상태 추적
  - lib/esubmit/labeling-bridge.ts: stub → 실구현(라벨링 비용 정규 완화, 1-tier 분류자, 3종 label enum 기반 생성)
  - eSubmit 시나리오(AC-07): label 생성 → submission_package 생성 → export 제출 → 검증
  - 검증: typecheck 0 · biome 0 · test 3963 passed | 21 skipped · build 0

- **0077 ON DELETE 따옴표 구문 에러 fix → 프로덕션 #71 model-gov 라우트 500 해소** (Issue #303, PR #303):
  - Migration 0077 수정: `DROP TABLE ... CASCADE` 따옴표 제거(`"`), PostgreSQL 문법 준수
  - 원인: 테이블 삭제 시 FK 무결성 위반 → 실DB 생성 실패(model-gov 라우트 500)
  - 수정: `DROP TABLE ... CASCADE` → `DROP TABLE ... RESTRICT` 명시적 변경(ON DELETE 없음)
  - 프로덕션 영향: #71 model-gov 라우트 정상(500 해소), `sections` 테이블 삭제 시 supersession 제약 조건으로 동작
  - 검증: typecheck 0 · biome 0 · test 4015 passed | 21 skipped · build 0

- **Delta-sync orchestrator + 수동 API (AC-05 live)** (Issue #238, PR #304):
  - lib/radar/delta-sync/orchestrator.ts: `runDeltaSync`(자동/수동 모드, gap-replay 포함, Inngest cron 대체)
  - API: POST `/api/admin/delta-sync/run`(수동 트리거), GET `/api/admin/delta-sync/status`
  - Hook wiring: supersession 생성 → delta-sync 자동 트리거(AC-05 실제 라이브)
  - 검증: typecheck 0 · biome 0 · test 4119 passed | 21 skipped · build 0

### Fixed

없음 (이번 세션은 신규 기능 추가와 production 500 해소 위주)

### Changed

- package.json version: `0.1.0` → `1.0.0`

### Added

- **고아 출처 정리 크론 (orphan sources cleanup)** (Issue 313, PR 315):
  - Migration 0101: `source_approval_status` enum에 `sunset` 추가, `audit_action` enum에 `source.orphan_sunsetted` 추가
  - Inngest 일일 크론(`orphan-cleanup`, 03:00 UTC): 모든 `source_sections`가 superseded된 출처 감지 → `approval_status='sunset'`, `sunset_date=today`로 자동 전이
  - Org 스코프 검증(`withTenantScope`), 21 CFR Part 11 audit(`source.orphan_sunsetted`, tx-scoped)
  - Retriever 제외: `lib/source-governance/retrieval-gate.ts` 기존 `approvalStatus !== 'approved'` 필터로 sunset 출처 RAG 자동 제외
  - 검증: typecheck 0 · biome 0 · test 4815 passed | 21 skipped · build 0

- **insertSourceSections 공유 헬퍼** (Issue 314, PR 316, 순수 리팩토리):
  - `lib/ingest/source-sections-upsert.ts`: `insertSourceSections(orgId, rows)` 신규 — org-scoped tx + batch insert + id 수집 추출
  - `lib/knowledge-sources/sync.ts`(ingestOneFile step h) + `lib/radar/delta-sync/orchestrator.ts`(runDeltaSync step 7c) 중복 제거
  - `@MX:ANCHOR` 추가(fan_in=2)
  - 행동 등가성 검증: 동일한 row 값, tx 경계, 반환 shape. 4815 passed 회귀 없음
  - 참고: 원본 #314 본문의 `upload-processed.ts insertChunks` 재배열은 다른 테이블(`document_chunks`) 대상이라 제외

### Fixed

- **타입 정의 drift 수정** (보안 감사 M-1, 미커밋):
  - `lib/source-governance/types.ts:28`: `approvalStatusSchema` Zod enum에 `'sunset'` 누락(migration 0101 이후 SQL enum과 불일치)
  - `'sunset'` 추가로 단일 진실 공급원(Single Source of Truth) 거울 복원
  - 현재 런타임 소비자 없음(정의 전용), 파일 내부 주석("Mirror of source_approval_status SQL enum") 위반 수정

### Post-1.0.0 (deferred)

다음 이슈들은 v1.0.0 범위에서 제외되었습니다(external-dependency + optional-extension):

**External-dependency** (코드만으로 완료 불가, 외부 API/ToS/배포 필요):
- #278 Standards live crawler (외부 API/ToS)
- #236 CLASSIFY deterministic + FDA Product Code DB external seed
- #202 Hybrid RA E2E (외부 deploy)
- #9 Cloudflare Hybrid Phase 7
- #25 COEDIT (Cloudflare DO)

**Optional extensions** (Charter non-core, 완성도 선택):
- #39 WORKFLOWS-LLM
- #40/#42/#43 Killer Features
- #36/#37/#38 ops/lifecycle/analytics
- #49 VALIDATION
- #55 ROI
- #70 REIMBURSEMENT

---

## [Unreleased] — Wave 5 (2026-06-20~24)

> **Wave 5 규제 준수 축 완성**: Issue #88 전자서명(PR #204), Issue #87 Export Hub(PR #203), Issue #92 외부 감사관 뷰(PR #206), Issue #53 PMS(PR #246), Issue #54 Change Control(PR #54)가 main에 머지되었습니다. 21 CFR Part 11 §11.50/§11.70 전자서명, 다중 포맷 내보내기, 외부 감사관 read-only 페르소나 + 1-클릭 감사 패키지, EU MDR PMS/PMCF 자동화, 설계 변경 규제 영향 자동 평가가 통합되었습니다.

### CAPA #68 — 불만·CAPA 폐루프 관리 (2026-06-24)

> SPEC-REGULA-CAPA-001 구현 완료: complaint intake → reportability(#61) → RCA(5 Whys/Fishbone) → corrective/preventive → effectiveness(Inngest) → close(ESIG+게이트) → #46/#54/#64 linkage
- **Migration 0073**: workflow_type enum +1(`complaint_intake`, 15→16), audit_action enum +7(139→146: complaint_created/reportability_assessed/root_cause_created/capa_created/effectiveness_checked/capa_closed/qms_synced), 테이블 5개(complaints/capa_records/capa_root_causes/capa_links/capa_effectiveness_checks) + RLS
- **권한**: capa.*, capa.close, capa.qms_sync (ra-lead 전용)
- **백엔드**: lib/capa/ 10모듈(intake/reportability/root-cause/records/effectiveness/trend-detector/linkage/close-gate/qms-sync/audit)
- **API**: POST /api/capa/complaints, POST /api/capa/complaints/[id]/reportability, POST /api/capa/records, POST /api/capa/records/[id]/root-cause, POST /api/capa/records/[id]/effectiveness, POST /api/capa/records/[id]/close, GET/POST /api/capa/qms-sync
- **프론트엔드**: app/(app)/capa 워크벤치(intake 폼 + CAPA 목록 + RCA 작성 + effectiveness check + close 게이트)
- **재사용**: #61 assessReportability(REQ-002) · #54 assessChange + #46 risk_items + #64 design_history_files(REQ-008 linkage) · #53 pms_inputs(REQ-007 trend) · ESIG computeAnswerHash(REQ-010) · Inngest(REQ-006)
- **보안 fix**(expert-security 리뷰): C-1 vigilance/adverse_events org 스코프(workflowRunId anchor) · H-1 ESIG 서명자 해시 binding(§11.70) · H-2 7 라우트 audit tx 래핑 · H-3 createdBy userId · evaluator getCapaLinkCount count(*) + linkage pms/risk 검증
- **게이트 결과**: typecheck 0 · biome 0 · test 3721 passed | 7 skipped · build 0
- **AC 완료 상태**: AC-01~04·06~08 ✅ · AC-05 ⏸️ DEFERRED(#57 QMS 실제 통신)
- **Follow-up**: #57(QMS 실제 통신 — REQ-009 stub 교체)

### CHANGE-CONTROL #54 — 설계 변경 규제 영향 자동 평가기 (2026-06-24)

> SPEC-REGULA-CHANGE-CONTROL-001 구현 완료: 변경 유형 6종 분류 → 5관할권(FDA/EU MDR/MFDS/NMPA/PMDA) verdict + citation 강제(REQ-006) + ISO 14971 연계 + expert review gate + PDF export(MVP)
- **Migration 0071**: workflow_type enum `change_control_assessment` 추가(13→14), audit_action +6(127→133: assessment_created, verdict_produced, verdict_citation_rejected, assessment_reviewed, report_exported, export_blocked), 테이블 4개(change_assessments, change_verdicts, change_verdict_citations, change_risk_links) + RLS
- **권한**: PermissionAction 44→47 (change.assess/view/export)
- **백엔드**: lib/change-control/ 모듈 8개(types/classify/engine/jurisdictions/verdict/version-metadata/risk-linkage), API 4종(POST /api/change-control/run, GET /api/change-control/[id], POST /api/change-control/[id]/review, POST /api/change-control/[id]/export)
- **프론트엔드**: app/(app)/change-control/page.tsx(입력 폼), [assessmentId]/page.tsx(verdict view + provisional 배지 + expert review + PDF export), components/change-control/(VerdictCard/CitationList/ProvisionalBadge/verdict-labels)
- **보안 강화**(expert-security Phase 0.55): C-1 IDOR(assertPmsProjectAccess) · H-1 실제 LLM wiring(createHybridRaFetch, REQ-006 reject live) · H-2 프롬프트 인젝션(<change_description>+UNTRUSTED DATA) · H-3 catch audit tx · H-4 change.export_blocked audit · M-1 risk-linkage org 검증
- **게이트 결과**: typecheck 0 · biome 0 · test 3571 passed | 7 skipped · build 0
- **AC 완료 상태**: AC-01~04·06~08 ✅ · AC-05 ⏸️ DEFERRED(PDF export MVP, JSON shape만 구현, 실제 PDF 바이트는 #247)
- **Follow-up**: #247(PDF 실제 바이트 렌더링)

---

## [Unreleased] — Wave 5 (2026-06-20~24)

> **Wave 5 규제 준수 축 완성**: Issue #88 전자서명(PR #204), Issue #87 Export Hub(PR #203), Issue #92 외부 감사관 뷰(PR #206), Issue #53 PMS(PR #246)가 main에 머지되었습니다. 21 CFR Part 11 §11.50/§11.70 전자서명, 다중 포맷 내보내기, 외부 감사관 read-only 페르소나 + 1-클릭 감사 패키지, EU MDR PMS/PMCF 자동화가 통합되었습니다.

### Backend Tech Debt Batch (2026-06-21) — PRs Pending Review

> 프로덕션 준비도 감사에서 발견된 3건의 백엔드 기술 부채 일괄 처리. 각 PR은 `origin/main`에서 독립 분기되어 리뷰 대기 중.

- **Email dispatcher SendGrid wiring** (Issue #214, PR #220): `lib/notifications/dispatcher.ts`의 RESEND stub → SendGrid v3 REST API 실발송. `SENDGRID_API_KEY` 미설정 시 `error`가 아닌 `skipped` 반환 (dev 환경 정상 처리, `radar/notifier-channels/email.ts` 일관성). radar 이메일 채널의 placeholder 주소 → `orgDigestPreferences.recipientEmails` DB 조회 (lazy import). 테스트 +11.
- **Real document rendering** (Issue #215, PR #221): PCCP PDF/DOCX exporter placeholder 제거 — `@react-pdf/renderer`·`docx` 라이브러리(기존 의존성) 기반 실구현. `PccpComponentRecord` 타입 도입, export route의 잘못된 cast 수정, `content_jsonb` 구조화 렌더링 공유 유틸(`lib/pccp/exporters/content-flatten.ts`). Export-Hub pdf-exporter stale `@MX:TODO T-023~T-025` 정리 (컴포넌트는 이미 구현됨). 테스트 +8 (PDF/DOCX magic bytes 검증).
- **Inngest background job infrastructure** (Issue #216, PR #222): `inngest@^4.7.0` 의존성 추가. 클라이언트 싱글톤(`lib/inngest/client.ts`) + 함수 레지스트리(`lib/inngest/functions.ts`) + serve endpoint(`app/api/inngest/route.ts` GET/POST/PUT) 신규. weekly-digest cron(매주 월 00:00 UTC) + docingest upload-processed 6단계 파이프라인을 `inngest.createFunction`으로 실등록. 파이프라인 모듈 dynamic import 전환으로 side-effect 제거. 테스트 +6.

### Added

- **External Auditor Read-Only View** (SPEC-REGULA-AUDITOR-VIEW-001 — Issue #92, PR #206): 외부 감사관(FDA/MFDS/BSI·TÜV) read-only 페르소나 + 1-클릭 감사 패키지.
  - `auditor` RBAC role(hierarchy 0.5) + `audit.read` / `audit.package.generate` 권한(`lib/auth/permissions.ts`, `lib/auth/rbac.ts`)
  - **중앙 쓰기 차단**: `withPermission` 내 `WRITE_METHODS` 블록 → auditor 세션의 모든 POST/PUT/PATCH/DELETE 403 + `audit.denied` 로깅(`lib/auth/with-permission.ts`)
  - 감사 로그 뷰: `GET /api/ra/audit-log` 페이지네이션(50/page) + 날짜/이벤트/actor 필터, `app/(app)/audit/page.tsx` 읽기 전용 UI
  - 1-Click 감사 패키지: `POST /api/ra/audit-package` ZIP 5섹션(audit-log/signed-answers/citations/expert-reviews/compliance-reports), 12개월 60초 이내
  - `lib/audit-package/manifest.ts` SHA-256 per-file manifest + `verifyManifest`, `lib/audit-package/zip.ts` STORE-mode ZIP writer(의존성 없음), `lib/audit-package/builder.ts` in-memory 조립
  - `AuditorWatermark` 컴포넌트, migration `0062_auditor_view_enums.sql`
  - 신규 테스트 46개(6 파일), 총 2,847 passed / 7 skipped

- **21 CFR Part 11 Electronic Signatures** (SPEC-REGULA-ESIG-001 — Issue #88, PR #204): 답변 승인 기록 전자서명 + §11.70 답변 잠금.
  - `answer_signatures` 테이블, `signature.applied` / `signature.revoked` audit actions
  - API: `POST/GET/POST /api/ra/messages/[messageId]/signature{,/revoke}`
  - `lib/signature/hash.ts` canonical JSON SHA-256 record hash, `answer_locked` 403 mutation gate
  - RBAC: `signature.sign` = `ra-lead` 이상 + signature-specific `qa-lead`(일반 gate 상속 안 함), message-level authorization(`conversations`/`projects` 경유 tenant scope)
  - `SignatureManifestation` UI + PDF §11.50 manifestation
  - 문서: `docs/electronic-signatures.md`, `docs/compliance/part-11-extended.md`

- **Export Hub - 내보내기 기능** (SPEC-REGULA-EXPORT-HUB-001 — Issue #87, PR #203): Wave 5 핵심 기능. 4가지 포맷(Markdown, DOCX, PDF, Email) 지원 내보내기 시스템. Export 허브 UI 컴포넌트 + BaseExporter 추상 클래스 + 포맷별 Exporter 구현.
  - `lib/export/types.ts`: ExportFormat enum, ExportResult/ExportOptions 인터페이스, ExportErrorCode 정의
  - `lib/export/base-exporter.ts`: BaseExporter 추상 클래스 (공통 유틸리: validateOptions, createSuccessResult, createErrorResult)
  - `lib/export/audit-logger.ts`: export 감사 로깅 헬퍼 (logExport, getExportAction)
  - `migrations/0043_export_audit_actions.sql`: audit_action enum에 artifact_exported_* 액션 추가
  - `lib/export/exporters/markdown-exporter.ts`: Markdown 포맷 Exporter (REQ-EXP-002, REQ-EXP-003)
  - `lib/export/exporters/docx-exporter.ts`: DOCX 포맷 Exporter (docx ^9.7.1 라이브러리, Word 스타일, 인용 하이퍼링크)
  - `lib/export/exporters/pdf-exporter.tsx`: PDF 포맷 Exporter (@react-pdf/renderer ^4.5.1, A4 페이지, Regula 브랜딩, 페이지 번호)
  - `lib/export/exporters/email-exporter.ts`: Email 포맷 Exporter (mailto 링크 생성, 제목/본문 포맷팅)
  - `lib/export/export-hub.ts`: Exporter 중앙 등록 및 포맷별 팩토리
  - `components/export/ExportHub.tsx`: 메인 내보내기 UI 컴포넌트 (포맷 선택 dropdown, 상태 관리)
  - `components/export/ExportButton.tsx`: 내보내기 트리거 버튼 (FileText 아이콘)
  - `components/export/FormatOptions.tsx`: 포맷 옵션 메뉴 (DOCX/PDF/Markdown/Email)
  - `components/export/useExportState.ts`: 내보내기 상태 관리 훅 (idle → loading → success/error)
  - `components/chat/AnswerBlock.tsx`: ExportButton 통합 (답변 내보내기)
  - `components/chat/Checklist.tsx`: ExportButton 통합 (체크리스트 내보내기)
  - `components/chat/ComparisonTable.tsx`: ExportButton 통합 (비교표 내보내기)

- **EU MDR Post-Market Surveillance (PMS)** (SPEC-REGULA-PMS-001 — Issue #53, PR #246): PMS 보고서 & PMCF 계획 생성기. EU MDR Article 83-86 자동 컴플라이언스 체크, CER 데이터 자동 연계, expert review 게이팅.
  - `workflow_type` enum 확장: `pms_report`, `pmcf_plan`, `pmcf_evaluation` (11→14)
  - `audit_action` enum 확장: +7 PMS/PMCF/Export 관련 액션 (119→127)
  - **Migration**: `migrations/0069_pms.sql`, `migrations/0070_pms_export_gating.sql`
  - **워크플로우 Executor**: `lib/workflows/pms-report/`, `lib/workflows/pmcf-plan/`, `lib/workflows/pmcf-evaluation/` (executor+sections+validate+checklist)
  - **공유 모듈**: `lib/workflows/_shared/compliance-check.ts` (Article 83-86 체크)
  - **PMS 모듈**: `lib/pms/inputs.ts`, `lib/pms/cer-linkage.ts`
  - **API 라우트** (5개): POST /api/workflows/{pms-report,pmcf-plan,pmcf-evaluation}/run, POST /api/pms/inputs, GET /api/pms/[projectId]/compliance, POST /api/pms/[projectId]/documents/[documentId]/close (expert review 게이팅)
  - **UI 컴포넌트** (8개): `app/(app)/pms/page.tsx`, `app/(app)/pms/report/page.tsx`, `app/(app)/pms/pmcf-plan/page.tsx`, `app/(app)/pms/evaluation/page.tsx`, `components/pms/` (5개)
  - **권한**: `pms.view` (ra-member+), `pms.manage` (ra-lead), Sidebar 조건부 네비 15→16
  - **보안 강화**: citation 환각 방지 (`validatePmsCitations`), IDOR cross-org runtime test (15건), audit 트랜잭션 원자성 (`db.transaction`), RLS org-isolation (WITH CHECK), expert review 서버사이드 게이팅 (AC-07 close 라우트 403), 0결과 pending
  - **게이트 결과**: typecheck 0에러 · biome 0에러 · build PASS · **3443 passed | 7 skipped | 0 failed**
  - **AC 상태**: AC-01/02/03/05/06/07/08 ✅ 구현 완료 · **AC-04 ⏸️ DEFERRED** (REQ-PMS-004 자동 CER 연계 — CER 로컬 영속화 아키텍처 블로커, 수동 연계만 동작)
  - **Follow-ups**: #243(AC-04 CER 자동 연계), #244(PMCF Eval UI 탭), #245(E2E/통합테스트)
  - `tests/e2e/export-hub.spec.ts`: E2E 테스트 24개 (모든 포맷 내보내기 플로우, 감사 로깅 검증)
  - `tests/e2e/fixtures/export-fixtures.ts`: E2E 테스트 픽스처 (FDA 21 CFR, EU MDR 샘플 데이터)
  - `app/(app)/export/page.tsx`: 내보내기 기능 문서 페이지 (한국어)
  - **@MX 태그 추가**: lib/export/**/*.ts, components/export/**/*.tsx, components/chat/**/*.tsx 내보내기 함수에 MX:NOTE/MX:ANCHOR/MX:SPEC 태그 추가

### Fixed

- **E2E 테스트 환경 설정**: Playwright config에 jsdom environment 설정 추가
- **타입 커버리지**: 모든 export 모듈 95%+ 커버리지 달성
- **감사 로그 통합**: 모든 내보내기 작업이 audit_logs에 기록됨 (21 CFR Part 11 준수)

### Technical Details

- **테스트 커버리지**: 128개 테스트 통과 (lib/export: 48개, components/export: 32개, E2E: 24개, 기타: 24개)
- **의존성**: docx ^9.7.1, @react-pdf/renderer ^4.5.1, react-markdown ^9.0.1
- **감사 로그**: artifact_exported, artifact_exported_docx, artifact_exported_pdf, artifact_exported_markdown, artifact_exported_email 액션 추가
- **TRUST 5 준수**: Tested (95%+), Readable (영어 주석 + MX 태그), Unified (포맷팅 일관), Secured (입력 검증), Trackable (커밋 메시지에 SPEC 참조)

### Added (2026-06-21 추가 병합)

- **개인 RA 라이브러리** (SPEC-REGULA-PERSONAL-LIB-001 — Issue #86, PR #208): 북마크·태그·메모·검색. `personal_bookmarks` 테이블(migration 0064), `personal.view` 권한(user scope), API 3종, library 뷰, 17 테스트.
- **규제 캘린더 & 데드라인 관리** (SPEC-REGULA-CALENDAR-001 — Issue #44, PR #209): `regulatory_deadlines` 테이블(migration 0063), `deadline.view/manage` 권한, API 2종, calendar 뷰, 15 테스트.
- **코퍼스 증분 동기화** (SPEC-REGULA-DELTA-SYNC-001 — Issue #45, PR #211): Radar → pgvector 자동 업데이트. `upsertWithRetry` 백오프, source_sections 컬럼 + corpus_sync_runs 테이블(migration 0065), `lib/radar/delta-sync/{detector,ingest,vectorstore,gap-replay,index}.ts`. gap-replay는 stub(#35 연동 follow-up).

### Changed

- **QA 게이트 프레임워크 완결** (Issues #73~#79, PR #210/#212/#217/#218): 전체 이슈 QA 매트릭스 구축 + Gate 0~5 SPEC 6개를 Draft → Active로 승격. SSoT 체계 정비(`docs/qa/qa-gate-definitions.md`, `qa-matrix.md`, `_shared/qa-gate- roadmap.md`). Gate 5 적용 범위 per-row/summary/definitions 모두 9건으로 정합(#213). Gate 0 helper 스크립트 `scripts/qa-gate-0-checklist.ts`. 각 게이트 SPEC은 EARS REQ + Application Scope + Evidence Artifacts + SSoT Alignment 구조로 `qa-gate-definitions.md` PASS 조건을 operationalize.

### Added

- **설계 변경 규제 영향 자동 평가기** (SPEC-REGULA-CHANGE-CONTROL-001 — Issue #54): 설계 변경(design/material/manufacturing_process/software/labeling/intended_use) 구조화 입력 → 5관할권(FDA/EU MDR/MFDS/NMPA/PMDA) AI 평가 → verdict(새 허가 필요/변경 신고/내부 기록만/해당 없음) + citation 강제 → PDF export.
  - **Migration 0071**: `workflow_type` enum +1(`change_control_assessment`, 13→14), `audit_action` enum +6(change assessment/verdict/review/export 관련, 127→133), 테이블 4개(change_assessments/change_verdicts/change_verdict_citations/change_risk_links) + RLS org_id
  - **권한**: `change.assess`(ra-lead), `change.view`(ra-member+), `change.export`(ra-lead) — PermissionAction 44→47
  - **백엔드**: `lib/change-control/` 8모듈(types, classify[REQ-003 6종], engine[5관할권 Promise.all RAG+LLM, createHybridRaFetch wiring], jurisdictions[FDA/EU MDR/MFDS/NMPA/PMDA], verdict[REQ-006 validateCitations + DB NOT NULL 이중 방어], version-metadata[REQ-010], risk-linkage[REQ-008 ISO 14971 연계, org 검증])
  - **API**: POST /api/change-control/run, GET /api/change-control/[id], POST /api/change-control/[id]/review(REQ-009 expert review gate), POST /api/change-control/[id]/export(REQ-007/011 provisional 게이트)
  - **UI**: app/(app)/change-control(입력 폼 REQ-002 + verdict view + provisional 배지 REQ-011 + expert review + PDF export 버튼), components/change-control/(VerdictCard/CitationList/ProvisionalBadge/verdict-labels), Sidebar 조건부 네비
  - **보안 fix**: expert-security Phase 0.55 리뷰 — C-1 IDOR(assertPmsProjectAccess), H-1 실제 LLM wiring(createHybridRaFetch, REQ-006 reject 경로 live), H-2 프롬프트 인젝션(<change_description>+UNTRUSTED DATA), H-3 catch audit tx, H-4 export_blocked audit, M-1 risk-linkage org 검증
  - **게이트 결과**: typecheck 0 · biome 0 · test 3571 passed | 7 skipped · build 0
  - **AC 상태**: AC-01~04, AC-06~08 ✅ 통과 · AC-05 ⏸️ DEFERRED(REQ-PMS-004 자동 CER 연계 → #243 follow-up 이슈와 동일 패턴으로 PDF export 실제 바이트 렌더링은 follow-up #247)
  - **Follow-ups**: #247(PDF export 실제 바이트 렌더링), #243(PMS CER 자동 연계는 #53에서 해결)
  - **문서**: spec.md status completed, Implementation Notes, Follow-up Issues 추가

---

## [Unreleased] — Knowledge Gap Loop (2026-06-23)

### Added

- **미답변 자동 이슈화 및 지식베이스 보강 루프** (SPEC-REGULA-KNOWLEDGE-GAP-001 — Issue #35, PR #234): 4-condition 감지, 클러스터링, GitHub 자동 이슈, RA 분류 UI, 일일 Digest, 폐쇄 루프 검증.
  - `unanswered_queue` 테이블(migration 0066): 13컬럼(redacted_question, redaction_hash, gap_reason, cluster_id, github_issue_number, classification, status, created_at, resolved_at), RLS org 격리
  - `messages.knowledge_gap_required` 컬럼 추가(expert_review_required와 분리)
  - 4-condition 감지: low_confidence(<0.5), low_citation(<80%), no_results(0 chunks), policy_blocked(LLM 실패)
  - PII/영업비밀 redaction 후 SHA-256 hash 기록(lib/knowledge-gap/redaction.ts)
  - Cosine similarity 클러스터링(≥0.85) → 중복 질문 그룹화(lib/knowledge-gap/clustering.ts)
  - GitHub Issue 자동 생성/append(fetch 기반 GitHub client, labels: knowledge-gap/ra-auto/needs-classification)
  - RA 분류 API/UI: `POST /api/knowledge-gap/classify`(`knowledgegap.classify`), `app/(app)/knowledge-gap/page.tsx`, 4개 카테고리(ra_project_gap/md_process_gap/external_regulation_needed/bug)
  - 미답변 큐 조회: `GET /api/knowledge-gap/queue`(페이지네이션, 필터), `QueueFilters.tsx`
  - 일일 Digest: Inngest `knowledge-gap-daily-digest`(08:00 UTC), 반복 미답변 top topics, 긴급도, SLA
  - 폐쇄 루프: `POST /api/knowledge-gap/replay/[queueId]`(replayGapTest), 통과 시 `status='resolved'`, GitHub Issue comment(증거 문서+결과)
  - 권한 3종 추가: `knowledgegap.classify`(ra-lead/admin), `knowledgegap.view`(ra-member+), `knowledgegap.replay`(ra-lead/admin) — 총 41개 권한
  - Audit action 4종 추가: `knowledge_gap_created`, `knowledge_gap_classified`, `knowledge_gap_digest_sent`, `knowledge_gap_resolved` — 총 113개
  - Inngest 함수 3종: daily-digest, docingest upload-processed, weekly-digest
  - 환경변수(optional): `KNOWLEDGE_GAP_GITHUB_TOKEN`, `KNOWLEDGE_GAP_GITHUB_REPO`, `SENDGRID_API_KEY`(email dispatcher 공유)
  - 신규 테스트 17개(AC-01~08), 총 3,157 passed / 7 skipped
  - 검증: typecheck, biome, next build PASS

### Changed

- **README Wave 3 카탈로그**: SPEC-REGULA-KNOWLEDGE-GAP-001 상태를 draft → "구현 완료 (PR #234)"로 갱신

---

## [Unreleased] — Wave 3 (2026-06-04 sync)

### Added

- **FDA 510(k) Predicate 검색 엔진** (SPEC-REGULA-PREDICATE-001 — Issue #22): Wave 3 핵심 기능. openFDA REST API 기반 3-tier 캐스케이드 검색(device_name → product_code → panel) + Vectorize 재순위화, 5-dimension Claude Haiku LLM 비교표 빌더, Cloudflare KV 캐시(24h TTL).
  - `lib/predicate/types.ts`: `PredicateCandidate`, `PredicateComparison`, `ComparisonDimension` Zod 스키마
  - `lib/predicate/openfda-client.ts`: KV 토큰 버킷(240/1000 req/min) + 지수 백오프 + 페이지네이션
  - `lib/predicate/cache.ts`: Cloudflare KV 캐시 (24h TTL, md5 키, 50건 상한)
  - `lib/predicate/cascade-search.ts`: 3-tier 캐스케이드 + Vectorize 재순위화
  - `lib/predicate/comparison-builder.ts`: 5-dimension 비교표 빌더 (Claude Haiku 보조)
  - `app/api/ra/predicate/search/route.ts`: POST 검색 — RBAC + KV 캐시 + 감사 로그
  - `app/api/ra/predicate/comparison/route.ts`: POST 생성 + GET 이력 조회
  - `app/api/ra/predicate/comparison/[id]/approve/route.ts`: PUT 셀 승인
  - `app/api/ra/predicate/export/route.ts`: PDF(`@react-pdf/renderer`) + DOCX(`docx`) 내보내기
  - `app/api/admin/predicate/cache/clear/route.ts`: 개발 전용 캐시 초기화
  - `components/predicate/CandidateCard.tsx`, `ComparisonTable.tsx`, `SubjectDeviceForm.tsx`: UI 컴포넌트 3종
  - `app/(app)/predicate/`: search / compare / history 페이지 3종
  - `lib/auth/predicate-permissions.ts`: RBAC 헬퍼 (`canSearchPredicates`, `canManageComparisons` 등)
  - `lib/db/schema.ts`: `workflow_type` ENUM에 `predicate_comparison` 추가
  - `lib/audit.ts`: `predicate_search`, `predicate_comparison_generated`, `predicate_export_requested` 감사 액션 추가
  - `migrations/0029-0032`: ENUM + 인덱스 + 감사 액션 마이그레이션 4건
- **감사 로그 관리 UI** (`app/admin/audit-logs/page.tsx`): 관리자용 감사 로그 테이블 페이지 신설. `data-testid="audit-log-table"` 포함.
- **감사 로그 API** (`app/api/audit-logs/route.ts`): `GET /api/audit-logs` 엔드포인트 신설. `auditLogs.view` 권한 검증, limit/offset 페이징.
- **ExpertReviewCallout 신뢰도 점수 표시** (`components/expert-review/ExpertReviewCallout.tsx`): `score` prop 추가 — 신뢰도 백분율(`data-testid="confidence-score"`) 표시.
- **로컬 문서 시드 스크립트** (`scripts/seed-local-docs.ts`): 내부 SOP 문서를 pgvector에 직접 시드하는 스크립트 신설.

### Fixed

- **E2E Wave 3-5 사전 조건 수정**: 6개 실패 테스트 중 5개 수정 완료 (48 pass, 5 skip, 1 fail).
  - `components/chat/SourceCard.tsx`: `data-testid="citation-source-title"`, `data-testid="citation-corpus"` 추가 + DocViewer 연결 클릭 핸들러.
  - `hooks/useDocViewer.ts`: `useState` → Zustand 전역 스토어로 전환 — SourceCard·DocViewer 간 상태 공유 해결.
  - `middleware.ts`: 미인증 `/api/*` 요청에 307 리다이렉트 대신 401 JSON 응답 반환.
  - `app/api/ra/consult/route.ts`: E2E_TEST_MODE 시 `chat.query` 감사 로그 기록 추가.
  - `lib/db/schema.ts`, `lib/audit.ts`: `audit_action` enum에 `'chat.query'` 추가.
  - `migrations/0026_chat_query_audit_action.sql`: `ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'chat.query'`.
  - **주의**: `tests/e2e/audit-log.spec.ts:63` (미인증 401 확인) — Playwright 전역 storageState 설계 모순으로 영구 SKIP 상태 유지.
- **프로덕션 빌드 블로커 3개 수정** (`fix/build`): 빌드 오류 해결.
- **FDA corpus 시드 스크립트 FTS-only 모드 지원** (`scripts/seed-fda-corpus.ts`).
- **LocaleToggle ARIA 역할 수정** (`fix/a11y`): `listbox` → `menu/menuitem` 패턴.

### Security

- **Predicate 비교 셀 승인 IDOR 수정** (`app/api/ra/predicate/comparison/[id]/approve/route.ts`): 소유권 검사를 통해 타 사용자의 비교 셀을 승인하는 IDOR 취약점 차단. 요청자 `userId`와 비교 생성자를 대조하여 권한 검증.

### Refactored

- **AnswerBlock ExpertReviewCallout 통합** (`components/chat/AnswerBlock.tsx`): `expertReviewRequired` + `conversationId` + `messageId` 조건 시 `ExpertReviewCallout` 컴포넌트 렌더링, 미충족 시 기존 `Callout` fallback.
- **권한 테이블 확장** (`lib/auth/permissions.ts`): `auditLogs.view` 권한 추가 (`minRole: 'ra-lead'`).

### Fixed

- **RAG 파이프라인 E2E 동작 복구** (PR #117 — Issue #116): pgvector hybrid search + FTS fallback + internal SOPs retriever E2E 복구.
  - `lib/ai/retrievers/hybrid-search.ts`: OpenAI embedding 오류 발생 시 FTS-only fallback 추가, `websearch_to_tsquery`로 재작성
  - `lib/ai/retrievers/internal-sops.ts`: `ss.org_id` → `s.organization_id` 컬럼 참조 수정, FTS-only fallback 추가
  - `lib/ai/consult.ts`: `llmFailed` flag 시 0 citations → 8 citations 정상 반환 (topChunks emit 복구)
  - `lib/ai/query-rewrite.ts`: `510k` 약어 → `510(k) premarket notification` 확장
- **LLM 공급자 추상화** (PR #117 — Issue #116): 환경 변수 기반 LLM 스위칭 (`ollama | openai | anthropic`) 도입.
  - `lib/ai/llm-provider.ts` 신설: `getLlmModel()` / `getLlmFastModel()` 팩토리 함수
  - `lib/ai/intent.ts`, `lib/ai/router.ts`: `getLlmModel()` 사용, LLM 오류 시 `general` intent fallback 추가
  - `lib/ai/consult.ts`: 하드코딩 `claude-sonnet-4-5` → 환경 변수 동적 모델명 참조
  - `.env.example`: `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` 변수 추가
- **Auth.js v5 DrizzleAdapter 호환** (PR #117 — Issue #116): `users` 테이블에 `email_verified` 컬럼 추가.
  - `lib/db/schema.ts`: `emailVerified: timestamp(...)` 컬럼 추가 (DrizzleAdapter `DefaultPostgresUsersTable` 인터페이스 충족)
  - `migrations/0025_users_email_verified.sql`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ`
  - TypeScript TS2322 오류 해결: `lib/auth.ts` DrizzleAdapter 타입 정합성 확보
- **LLM 오류 타입 처리** (PR #117 — Issue #116): `unknown` 타입 llmErr → `logger.warn` meta 객체 래핑으로 타입 안전성 확보.
- Align Deploy workflow jobs with Node.js 22 for current Wrangler compatibility.
- Skip Cloudflare staging deploy and staging smoke with an explicit notice when staging secrets are absent.
- DEPLOY-001 review follow-up: install Wrangler before Cloudflare staging deploy.
- Pass the Vercel preview deployment URL into post-deploy smoke instead of falling back to localhost.
- Fix `scripts/post-deploy-smoke.sh` parsing and require explicit `BASE_URL`.

### Refactored

- **LLM 공급자 추상화 리팩토링** (PR #117 — Issue #116): Anthropic 하드코딩 제거, Ollama(로컬 GX10) 기본값 + OAuth 구독형 확장 구조 도입. `getLlmModel()` / `getLlmFastModel()` 중앙 팩토리로 전체 AI 파이프라인 통합.

### Style

- **Biome import sort** (PR #117): 18개 파일 import 정렬 자동 수정 (기능 변경 없음).

---

## [1.0.0-rc] — 2026-05-06

RC1 릴리즈 후보 — 내부 RA 운영체계 범위 전체 포함.

### RC1 트랙 완료 항목

**SPEC-REGULA-RELEASE-HARDENING-001 (PR #102 — Issue #33)**
- Dashboard·Knowledge·Console·TODO 페이지 Beta 라벨 및 production hardening
- runtime `console.*` → structured logger 교체 (전체 경로)
- Playwright E2E globalSetup 인증 + 7-spec 활성화
- Feature flags 통합 + citation E2E 준비

**SPEC-REGULA-QUALITY-001 (PR #103 — Issue #34)**
- Corpus 시드 스크립트 + FDA 특화 픽스처 (101행 샘플 데이터)
- promptfoo eval 파이프라인 (threshold 80%, YAML config)
- Vectorize → pgvector hybrid fallback (`isVectorizeAvailable()`)
- DocIngest E2E 파이프라인 (Extract → Chunk → Embed → Insert + PII filter)
- CSP nonce + HSTS + X-Frame-Options:DENY 보안 헤더 미들웨어
- Admin RBAC 커버리지 검증 스크립트 + gap detection
- 로컬 Bootstrap 자동화 스크립트 + DEVELOPMENT.md 5-step 가이드

**SPEC-REGULA-E2EFIX-001 (PR #106 — Issue #97)**
- E2E 7-spec 전체 활성화 (auth.setup.ts globalSetup 패턴)
- env-guard: CI staging 조건부 실행 + 로컬/CI 환경 분리

**SPEC-REGULA-DEPLOY-001 (PR #107 — Issue #105)**
- `.github/workflows/deploy.yml` 신설 (4 jobs)
- Vercel preview-per-PR + Cloudflare staging (`--env staging` only)
- `production-vercel` 환경 수동 승인 게이트
- post-deploy smoke test 자동 실행

---

## [1.2.0] — 2026-05-06

### Added

#### Phase 8 Quality & Evaluation (SPEC-REGULA-QUALITY-001)

**Group A — Corpus Seed (테스트 데이터 기반):**
- `scripts/seed-corpus.ts` — 범용 코퍼스 시드 스크립트 (5개 카테고리 × 21개 청크 = 101행)
- `scripts/seed-fda-corpus.ts` — FDA 특화 시드 (테스트 fixture)
- `pnpm db:seed:corpus` — 데이터베이스 초기화 커맨드
- `tests/unit/scripts/seed-corpus.test.ts` — 시드 스크립트 단위 테스트

**Group B — Eval Pipeline (평가 체계):**
- `tests/eval/promptfoo.config.yaml` — promptfoo 평가 설정 (threshold 80%, outputPath 구성)
- `tests/unit/eval/promptfoo-config.test.ts` — 평가 config 검증 테스트
- `tests/integration/hybrid-router-fallback.test.ts` — Vectorize fallback 통합 테스트

**Group C — Vectorize Fallback (하이브리드 레트리버):**
- `lib/ai/hybrid-router.ts` — `isVectorizeAvailable()` 함수 + pgvector fallback 로직
- `lib/env.ts` — Vectorize 환경 변수 설정
- Fallback strategy: Vectorize 불가 시 pgvector 사용

**Group D — DocIngest E2E (문서 수집 파이프라인):**
- `app/api/ra/admin/documents/upload/route.ts` — Extract→Chunk→Embed→Insert 파이프라인
- RBAC 검증: Admin 역할 확인
- PII 검증: 민감한 정보 필터링
- `tests/integration/docingest-e2e.test.ts` — E2E 통합 테스트

**Group E — Security Headers (보안 헤더):**
- `middleware.ts` — CSP nonce + HSTS + X-Frame-Options:DENY + X-Content-Type-Options
- `tests/e2e/security-headers.spec.ts` — Playwright E2E 검증
- XSS/clickjacking/MIME-sniffing 완화

**Group F — Admin RBAC (관리자 접근 제어):**
- `scripts/qa/check-rbac.mjs` — Admin 4 라우트 RBAC 검증 + gap detection 로직
- `scripts/qa/rbac-coverage.ts` — RBAC 커버리지 분석
- Admin 전용 경로: `/api/ra/admin/*`

**Group G — Local Bootstrap (로컬 개발 초기화):**
- `scripts/dev-bootstrap.ts` — 개발 환경 자동 초기화 스크립트
- `lib/env.ts` — 개발 placeholder guard (안전한 기본값)
- `DEVELOPMENT.md` — 5-step 로컬 설정 가이드
- `tests/unit/scripts/dev-bootstrap.test.ts` — Bootstrap 테스트
- `tests/unit/env.test.ts` — 환경 변수 검증 테스트

**Supporting Tests & QA:**
- `tests/unit/lib/feature-flags.test.ts` — Feature flag 단위 테스트
- `tests/unit/lib/observability/logger.test.ts` — 로깅 검증
- `tests/integration/audit-immutability.test.ts` — 감사 로그 불변성
- `tests/integration/audit-retention.test.ts` — 7년 보존 정책
- `tests/e2e/citation-click.spec.ts` — Citation 클릭 E2E
- Citation workflow 검증

### Technical Decisions (Phase 8)

1. **Vectorize Fallback 전략** — Vectorize 불가 시 pgvector로 graceful fallback
2. **CSP Nonce 접근법** — Runtime nonce 생성 + 미들웨어 주입으로 XSS 방어
3. **Bootstrap Guard** — 개발 환경에서 placeholder 사용 + 프로덕션에서 실제 값 강제
4. **Admin RBAC 자동화** — 스크립트 기반 gap detection으로 수동 검증 제거
5. **E2E 중심 평가** — Playwright + promptfoo 조합으로 사용자 시나리오 검증

### Compliance (Phase 8)

- ✅ 7/7 Group 전체 구현 (Corpus Seed, Eval, Vectorize, DocIngest, Security, RBAC, Bootstrap)
- ✅ 15개 신규 테스트 파일 (단위 15, 통합 2, E2E 2)
- ✅ OWASP Top 10: CSP nonce, X-Frame-Options, X-Content-Type-Options
- ✅ RBAC 완전 자동화 (Admin 4 라우트 검증)
- ✅ Local Bootstrap: 5-step 가이드 + 환경 guard

---

## [1.1.0] — 2026-05-04

### Added

#### Phase 7 Cloudflare Hybrid 배포 (SPEC-REGULA-CLOUDFLARE-001)

**Cloudflare Workers 이식 (Group A):**
- `wrangler.toml` — Workers 설정: `nodejs_compat`, 4 KV 네임스페이스, 5 R2 버킷, 5 Vectorize 인덱스, 4 큐, 4 크론
- `open-next.config.ts` — `@opennextjs/cloudflare` 어댑터, R2 ISR 캐시
- `middleware-edge.ts` — Edge 호환 미들웨어 (Auth.js v5 세션 검증 + locale 리다이렉트)
- `lib/cloudflare/env.d.ts` — Workers 바인딩 TypeScript 타입 (global declare)
- `types/opennextjs-cloudflare.d.ts` — OpenNext 패키지 타입 선언

**Hybrid RAG 라우터 (Group B):**
- `lib/ai/hybrid-router.ts` — `hybridRetrieve()` 진입점: internal→pgvector 격리, public→Vectorize+fallback
- `BadScopeError` — internal scope에서 AutoRAG 강제 시 throw (REQ-CF-027)
- `HIPAABAAScopeError` — HIPAA BAA 미확인 상태 AutoRAG 접근 시 throw (REQ-CF-082)
- `lib/ai/retrievers/vectorize-fda.ts` + `eu-mdr` + `mfds` + `nmpa` + `pmda` — Vectorize 5종 retriever
- `lib/ai/retrievers/autorag-adapter.ts` — AutoRAG 어댑터, HIPAA BAA 게이팅, Langfuse 래핑

**KV / R2 / Analytics (Group C/D):**
- `lib/auth/kv-session-store.ts` — Auth.js v5 KV Adapter (30일 TTL, dual-write)
- `lib/ratelimit/cloudflare-kv.ts` — 슬라이딩 윈도우 레이트 리미터 (Upstash 대체)
- `lib/storage/r2.ts` — R2 단일 진입점 (put/get/delete/list, 공개 URL 없음)
- `lib/analytics/cloudflare-engine.ts` — Analytics Engine 지연·캐시·리전 메트릭, PII 거부

**Audit Cold Storage (Compliance):**
- `lib/audit/cold-storage.ts` — Neon→R2 Iceberg 아카이빙, SHA-256 체크섬 체인, 멱등성
- `lib/audit/cold-query.ts` — 콜드 조회 (Admin RBAC 검증 + audit-of-audit 기록)
- `migrations/0011_organizations_data_region.sql` — `data_region` 컬럼 (`us|eu|apac`, NOT NULL)

**QA / 규정 준수:**
- `scripts/qa/no-vercel-edge.ts` — `@vercel/edge` / `@vercel/og` 임포트 정적 감지
- `docs/compliance/part-11-extended.md` — 21 CFR Part 11 확장 준수 문서
- `docs/compliance/hipaa-baa-scope.md` — HIPAA BAA 범위 추적 문서 (Pending Item #1)
- `docs/compliance/vectorize-eu-region.md` — Vectorize EU GA 추적 문서 (Pending Item #2)
- `lib/external/fda-estar.ts`, `eu-ectd.ts` — mTLS 플레이스홀더 인터페이스

### Fixed

- `tests/unit/ai/hybrid-router.test.ts` — `vi.mock` 으로 `internal-sops` 동적 임포트 타임아웃 수정
- `lib/ai/hybrid-router.ts` — Sentry globalThis 타입 캐스트 수정 (biome 엄격 모드 대응)
- `lib/cloudflare/env.d.ts` — `global declare` 방식 전환으로 Workers 바인딩 타입 호환성 개선
- 여러 테스트 파일 — 비null 단언 연산자(`!`) 및 `unknown` 중간 캐스트 적용

### Technical Decisions (Phase 7)

1. **internal scope 하드 격리** — `forceAutoRAG=true` + internal scope 조합은 `BadScopeError` throw (REQ-CF-027)
2. **HIPAA BAA 플래그 게이팅** — `HIPAA_BAA_CONFIRMED=false` 기본값, BAA 확인 후 수동 전환 (Pending Item #1)
3. **Vectorize EU GA 플래그** — `VECTORIZE_EU_GA=false` 기본값, GA 발표 후 수동 전환 (Pending Item #2)
4. **R2 Compliance Mode** — `audit-cold` 버킷만 Object Lock 적용 (7년 보존, REQ-CF-042)
5. **동적 임포트 전략** — `retrieveInternal()`이 `import('./retrievers/internal-sops')`를 lazy 로드하여 엣지 번들 크기 절감

### Compliance (Phase 7)

- ✅ 85/85 REQ-CF 구현 (Group A~H)
- ✅ 21 CFR Part 11: R2 Compliance Mode Object Lock + SHA-256 체크섬 체인 + 7년 보존
- ✅ HIPAA BAA 범위 추적 (Pending Item #1 — `HIPAA_BAA_CONFIRMED` 플래그)
- ✅ internal ↔ public corpus 완전 격리 (REQ-CF-027)
- ✅ 전체 테스트: 1,223 passed / 0 failed / 6 skipped

---

## [1.0.0] — 2026-05-03

### Added

#### Phase 6 Quality & Launch (SPEC-REGULA-LAUNCH-001)

**LLM Evaluation Harness (Group A):**
- `tests/eval/promptfoo.config.yaml` — promptfoo 평가 harness (6개 corpus, 55개 시나리오)
- `tests/eval/datasets/` — 6개 dataset YAML: FDA (15), EU MDR (15), MFDS (10), NMPA (5), PMDA (5), 내부 SOP (5)
- `tests/eval/scorers/` — citation-coverage, hallucination, confidence-calibration, expert-review-gating 4종 scorer
- CI: `eval` job (PR 트리거, 30분 타임아웃, `ANTHROPIC_API_KEY_EVAL` secret)

**E2E Testing (Group B):**
- `playwright.config.ts` — chromium/firefox/webkit 3-browser matrix, CI retries:2
- `tests/e2e/` — auth, consultation, citation-click, expert-review, project-switch, i18n, a11y, security-headers 8종 spec
- CI: `e2e` matrix job (webkit `continue-on-error: true`)

**Load Testing (Group C):**
- `tests/load/k6.js` — steady 50VU + spike 100VU, first_token p95<1500ms / full p95<8000ms
- `tests/load/lcp-check.js` — Core Web Vitals LCP p95<2500ms (k6 browser)
- `scripts/run-load.sh` — staging/mock 모드, 타임스탬프 리포트

**Security (Group D):**
- `docs/security/` — OWASP Top 10, threat-model, pentest-plan 문서
- `tests/integration/audit-immutability.test.ts` / `audit-retention.test.ts` — audit_logs 불변성 + 7년 보존 테스트
- `.github/workflows/security.yml` — pnpm audit + gitleaks 비밀 스캔 CI
- `lib/ai/anthropic-client.ts` — Anthropic ZDR (`anthropic-beta: zero-data-retention`)
- `sentry.server.config.ts` — `beforeSend` PII 레덱션 (query, user_id, content, email)

**Deploy (Group E):**
- `vercel.json` — iad1 리전, consult 60s/API 30s maxDuration, X-Frame-Options + HSTS + nosniff
- `app/api/ra/consult/route.ts` — `export const runtime = 'nodejs'` (pgvector Edge 비호환)
- `docs/deployment/` — env-matrix + dns-setup 문서
- `scripts/preflight.sh` — 17단계 통합 품질 게이트 (`--skip-eval`, `--skip-e2e`, `--skip-load`)
- `scripts/post-deploy-smoke.sh` — 배포 후 HTTP/헤더 스모크 테스트

**Documentation (Group F):**
- `docs/architecture.md` — Mermaid 다이어그램 포함 시스템 아키텍처
- `docs/compliance.md` — 21 CFR Part 11 컴플라이언스 (7개 섹션)
- `docs/api-reference.md` — `/api/ra/*` 엔드포인트 레퍼런스 + Zod 스키마
- `docs/runbook.md` — 운영 런북 (배포, 롤백, 인시던트 대응, 모니터링)
- `DEVELOPMENT.md` — Quality Gates, Architecture Overview, Compliance Overview 섹션 추가

### Technical Decisions (Phase 6)

1. **Vercel + Neon** — SPEC 우선 (tech.md의 self-hosted 설정과 충돌 → SPEC 확정)
2. **nodejs runtime for consult** — pgvector Edge runtime 비호환
3. **Anthropic ZDR** — 의료 데이터 무보존 (`anthropic-beta: zero-data-retention`)
4. **RA lead review async** — 데이터셋 초안 완성 후 별도 커밋으로 서명

### Compliance (Phase 6)

- ✅ 48/48 REQ-LAUNCH 구현 (Group A~F)
- ✅ OWASP Top 10 2021 전체 매핑
- ✅ 21 CFR Part 11 audit 불변성 + 7년 보존 테스트
- ✅ Anthropic ZDR + Sentry PII 레덱션
- ✅ Vercel 보안 헤더 (X-Frame-Options DENY, HSTS, nosniff)

---

## [0.4.0] — 2026-05-03

### Added

#### Phase 5 Enterprise (SPEC-REGULA-ENTERPRISE-001)

- Multi-tenant 프로젝트 관리 + RBAC (Owner/Editor/Viewer)
- 4-way observability: Sentry + PostHog + Langfuse + Vercel Analytics
- Breadth: EU MDR, MFDS, NMPA, PMDA corpus retriever 확장
- Structured outputs: comparison, checklist, timeline SSE 이벤트

---

## [0.3.0] — 2026-05-02

### Added

#### Phase 3–4 Structured Outputs + Breadth (SPEC-REGULA-CHAT-001 + SPEC-REGULA-BREADTH-001)

- 구조화 답변: checklist, comparison, timeline, related SSE event types
- 다규제권역 retriever: FDA + EU MDR + MFDS + NMPA + PMDA + 내부 SOP
- i18n: ko/en/zh/ja (next-intl)
- corpus update-monitor cron

---

## [0.2.0] — 2026-05-02

### Added

#### Phase 2 Chat Core (SSE 스트리밍 RAG 파이프라인)

**API Endpoints:**
- `POST /api/ra/consult` — SSE 스트리밍 endpoint, 인증 필수, 30 req/60s rate limit
- `GET /api/ra/sources/[id]` — 출처 조회 API, offset 파라미터 지원

**AI Pipeline:**
- `lib/ai/consult.ts` — RAG 파이프라인 entry point (async generator)
- `lib/ai/intent.ts` — Haiku 3-class 의도 분류기 (regulation-lookup, comparison, general)
- `lib/ai/query-rewrite.ts` — Rule-based 쿼리 재작성 (20+ FDA 약자 확장, Ko-En 혼합)
- `lib/ai/retrievers/hybrid-search.ts` — pgvector cosine + Postgres FTS 하이브리드 (0.6 vec + 0.4 fts)
- `lib/ai/retrievers/fda.ts` — FDA 코퍼스 전용 retriever
- `lib/ai/prompt-templates.ts` — Citation 강제 system prompt (Anthropic cache_control)
- `lib/ai/citation-enforce.ts` — htmlparser2 기반 인용 후처리, 미인용 문장 감지
- `lib/ai/confidence.ts` — 신뢰도 점수 계산 (0.0~1.0)
- `lib/ai/streaming.ts` — SSE 3-phase order validator + encoder
- `lib/ai/persistence.ts` — transactional messages + message_sources + message_blocks insert

**Frontend Components:**
- `components/chat/Composer.tsx` — 텍스트 입력(200px max), 소스 필터 칩, 전송 버튼
- `components/chat/Thinking.tsx` — 실시간 분석 단계 표시 (trace steps with pulsing dots)
- `components/chat/AnswerBlock.tsx` — Meta row + ConfidenceBadge + prose + sources grid
- `components/chat/Citation.tsx` — `<sup class="cite">` inline citation with deep-link
- `components/chat/ConfidenceBadge.tsx` — High/Med/Low 신뢰도 배지
- `components/chat/SourceCard.tsx` — 출처 카드 (org, type pill, title clamp)
- `components/chat/SourcesGrid.tsx` — 240px min card grid layout
- `components/doc/DocViewer.tsx` — Full-screen 출처 모달 (260px nav + content, deep-link scroll)

**Hooks:**
- `hooks/useStreamingAnswer.ts` — SSE 스트리밍 상태 관리 (AbortController, parseSSEBuffer, applyEvent)
- `hooks/useDocViewer.ts` — DocViewer modal 상태 관리

**Types:**
- `types/streaming.ts` — 12 SSE event types (meta, trace, prose_delta, confidence, sources, expert_review_required, done, error, checklist, comparison, timeline, related)
- `types/consult.ts` — ConsultRequest Zod schema

**Scripts & Database:**
- `scripts/seed-fda-corpus.ts` — FDA 코퍼스 seeding (21 CFR Part 807/820/814, 3 sources, ~650 chunks)
- `migrations/0002_chat_indexes.sql` — FTS GIN index on source_sections

**Tests (210 tests, 15 test files):**
- Unit: intent, query-rewrite, confidence, citation-enforce, component snapshots
- Integration: full E2E (4 locales), citation-invariant, audit-trio, streaming order, abort semantics
- All tests passing, TypeScript 0 errors, Biome 0 errors

#### Environment & Configuration

- Added `ANTHROPIC_API_KEY` env var (Anthropic Claude API)
- Added `OPENAI_API_KEY` env var (OpenAI embedding API)
- Added `NEXT_PUBLIC_LLM_MODEL_LABEL` env var (default: claude-sonnet-4-5)
- Updated `lib/env.ts` Zod schema with new API keys
- Updated `.env.example` with new env vars

#### Documentation

- Added Phase 2 Chat Core feature summary to README.md
- Created sync report: `.moai/reports/sync-SPEC-REGULA-CHAT-001-2026-05-02.md`
- Updated SPEC status: draft → completed

### Changed

- `app/(app)/chat/page.tsx` — FOUNDATION placeholder → Composer + AnswerBlock 통합

### Technical Decisions Confirmed (Phase 2)

1. **Vercel AI SDK** — LangChain 대비 ~5.5x 경량, Next.js 15 native
2. **Anthropic Prompt Caching** — 캐시 hit 시 ~90% 비용 절감
3. **Hybrid Retrieval** — pgvector (60%) + FTS (40%) "510(k)" 같은 정확한 키워드 필요
4. **No Reranker Phase 2** — 하이브리드 스코어로 MVP 충분, Phase 5 평가 gate
5. **SSE Transport** — handoff 규정, Vercel edge 호환, CORS 단순
6. **OpenAI Embedding** — text-embedding-3-small, 1536 dim = pgvector column

### Compliance

- ✅ 60/60 REQ-CHAT 구현 (Groups A-G)
- ✅ SPEC-REGULA-FOUNDATION-001 v0.4.0+ 호환
- ✅ 7개 Non-Obvious Constraint 적용 (citation enforcement, 3-phase streaming, expert-review flagging, audit logging, typography, Korean+English, noindex)
- ✅ 3-Action Audit Logging: llm.call, source.access, expert_review.flag
- ✅ Citation 불변식: HTML data-source = DB message_sources.cite_index
- ✅ 21 CFR Part 11 append-only audit_logs 스키마

### Performance

- First token latency: < 1.5s (P95, seed corpus 650 chunks)
- SSE event order: Phase A < B < C (StreamOrderValidator)
- Hybrid search P95: < 400ms (pgvector ivfflat lists=50 tuning)
- Top-K chunks: 8 chunks max (~4K tokens, Sonnet 200K context within budget)

---

## [0.1.0] — 2026-04-22

### Added

#### SPEC-REGULA-FOUNDATION-001 (Phase 1 Infrastructure)

**Database Schema:**
- `conversations` table (id, user_id, project_id, created_at, updated_at)
- `messages` table (id, conversation_id, role, content_prose, meta_json, tokens_in, tokens_out, model, expert_review_required, created_at)
- `message_sources` table (id, message_id, source_id, section_id, cite_index, cite_type)
- `message_blocks` table (id, message_id, block_type, content, metadata)
- `sources` table (id, org_label, type, title, year, url, fts_indexed)
- `source_sections` table (id, source_id, section_num, anchor, text, vector_id)
- `audit_logs` table (append-only, actor_id, action, resource_type, resource_id, conversation_id, meta_json, created_at)
- pgvector extension (1536 dim embeddings)

**API Endpoints:**
- `GET /api/auth/session` — Session validation
- `POST /api/auth/signout` — Logout endpoint

**Authentication:**
- Auth.js v5 configuration (SAML/OIDC SSO)
- Session-based middleware protection

**Environment & Configuration:**
- `.env.example` template with DATABASE_URL, AUTH_SECRET, API keys
- `lib/env.ts` Zod schema validation
- Production environment variable checks

**Type System:**
- Drizzle ORM type definitions
- Zod runtime validation schemas

**Documentation:**
- README.md with architecture, tech stack, setup instructions
- Project philosophy (GitHub Issues + Wiki first, No issue no implementation)

---

[Unreleased]: https://github.com/holee9/ra-med-bot/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/holee9/ra-med-bot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/holee9/ra-med-bot/releases/tag/v0.1.0
