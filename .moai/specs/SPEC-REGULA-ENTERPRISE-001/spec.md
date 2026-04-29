---
id: SPEC-REGULA-ENTERPRISE-001
title: Regula Phase 5 Enterprise Hardening — Expert Review · RBAC · Audit 완전성 · 다크 모드 · i18n · 접근성 · 관측성
status: draft
created: 2026-04-22
updated: 2026-04-23
author: manager-spec
phase: 5
skill: regula
version: 0.2.0
priority: High
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft. 73 REQ-ENTERPRISE across 7 groups (A Expert Review / B RBAC /
      C Audit Completeness / D Dark Mode Runtime / E i18n Runtime / F Accessibility /
      G Observability). 6 technical decisions captured in research.md. Depends on
      FOUNDATION-001 v0.3.0, CHAT-001, STRUCTURED-001, BREADTH-001.
  - version: 0.2.0
    date: 2026-04-23
    author: manager-spec (iteration via cross-spec-audit Critical patch)
    notes: |
      Applied cross-spec-audit Critical findings C1, C3, C6:
      * C1 — expert_reviews enqueue 오너십 명확화: REQ-ENTERPRISE-009가 CHAT
        이벤트 수신 루트에서 row INSERT를 전담함을 spec 레벨에서 확정.
        `consult.expert_review_auto_flag` audit action이 enum inventory에 포함됨을
        재확인 (FOUNDATION v0.4.0 REQ-FND-049 table에 선언됨).
      * C3 — REQ-ENTERPRISE-028 enum 확장 목록 보강: `checklist.toggle`
        (STRUCTURED 이월), `consult.expert_review_auto_flag` (REQ-009 참조),
        `project.switch` (BREADTH wiring) 추가. 기존 10개 + 신규 3개 = 13개 값.
        FOUNDATION v0.4.0 REQ-FND-049 inventory table과 정합.
      * C6 — audit_logs.action pgEnum 통일: R1 risk 문구 유지(pgEnum 확장
        패턴 ALTER TYPE ADD VALUE 정합). 본 SPEC은 BREADTH 10개 값 + Phase 5
        신규 값을 단일 migration `00XX_enterprise_audit_actions.sql`에서 처리.
      신규 REQ 없음 (REQ-ENTERPRISE-028 내용 확장만). 재배치 없음.
related_handoff_sections:
  - "§6"
  - "§9.3"
  - "§9.5"
  - "§9.7"
  - "§11.8"
  - "§14"
  - "§16"
  - "§18"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-CHAT-001 (v0.2.0+)
  - SPEC-REGULA-STRUCTURED-001 (v0.2.0+)
  - SPEC-REGULA-BREADTH-001 (v0.2.0+)
---

# SPEC-REGULA-ENTERPRISE-001 — Regula Phase 5 Enterprise Hardening

## 목적 (Purpose)

의료기기 RA 전문가용 RAG 챗봇 `Regula`의 **엔터프라이즈 강화 단계**로, Phase 1~4에서 확립된 기반 프리미티브(append-only audit_logs, expert_reviews 테이블, locale/theme_pref pgEnum, `[data-theme="dark"]` CSS 오버라이드, confidence 계산 파이프라인, Callout 컴포넌트)를 **프로덕션 배포 수준으로 강화**한다. 본 Phase는 다음 7개 축을 완결한다:

1. **Expert Review 워크플로우 완성** (handoff §9.3 자동 + 수동, §11.8 `/api/ra/expert-review`) — 자동 게이팅(confidence < 0.7 OR 정책 키워드) SSE event 발행, 전문가 큐 페이지, 상태 전이(`pending → in_review → resolved`), 게이팅 우회 금지 원칙 enforcement
2. **RBAC (Role-Based Access Control)** (handoff §16) — `admin`/`ra-lead`/`ra-member`/`viewer` 4-role + Organization/Project scope 2-tier, 모든 Write Route Handler에 permission guard 적용
3. **audit_logs 완전성** (handoff §16, regula-audit-compliance 스킬) — 모든 `/api/ra/*` Write Handler writeAudit 호출 보증, 정적 분석 CI gate, enum 확장(`auth.login`/`auth.logout`/`session.invalidate`/`expert_review.resolve`)
4. **다크 모드 런타임** (handoff §6, §9.5) — localStorage + `users.theme_pref` 양방향 동기화, `prefers-color-scheme` 초기 존중, FOUT 방지 inline script
5. **i18n 런타임** (handoff §6, regula-i18n 스킬) — next-intl 기반 ko/en dictionary, Topbar locale 스위처, 대화 상태 보존 전환, `<html lang>` 동적 업데이트, 규제 용어 glossary
6. **접근성 (WCAG 2.1 AA)** (handoff §14) — axe-core CI gate 0 violations, 색 대비 검증, prefers-reduced-motion 존중, 키보드 내비게이션 전체 경로
7. **관측성** (handoff §18) — Sentry(error) + PostHog(product analytics, privacy-first) + Langfuse(LLM trace) + Vercel Analytics(Web Vitals) 4-way, audit_logs와 **엄격 분리**

본 Phase 완료 후 Phase 6 (Quality & Launch)에서 E2E 전체 스위트, LLM eval harness(promptfoo), 부하 테스트, VPAT 작성, feature flag, rollback runbook을 수행한다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Expert Review API | `app/api/ra/expert-review/route.ts` (POST 생성), `app/api/ra/expert-review/[id]/route.ts` (GET 조회, PATCH 상태 전이), Zod 스키마 `lib/schemas/expert-review.ts` |
| Expert Review Gating 로직 | `lib/ai/expert-review-gating.ts` (confidence < 0.7 OR 정책 키워드 → 자동 트리거), `lib/ai/policy-keywords.ts` (한/영 키워드 사전), `lib/ai/consult.ts` Phase C에 `expert_review_required` SSE event 발행 및 `enqueueExpertReview` 연결 |
| Expert Review UI | `app/(app)/expert-review/page.tsx` (큐 페이지 — admin/ra-lead 전용), `components/expert-review/QueueList.tsx`, `components/expert-review/ReviewCard.tsx`, `components/chat/ExpertReviewCallout.tsx` (Callout 컴포넌트 재사용, amber variant), Topbar "전문가 검토" 버튼 → 수동 플래그 |
| RBAC 기반 | `lib/auth/rbac.ts` (role enum + hierarchy), `lib/auth/acl.ts` (organization/project scope 검증), `lib/auth/with-permission.ts` (Route Handler 미들웨어), `migrations/00XX_rbac.sql` (`users.role` NOT NULL + `admin`/`ra-lead`/`ra-member`/`viewer` pgEnum) |
| RBAC 적용 | 모든 기존 Route Handler (CHAT-001의 `/api/ra/consult`, BREADTH-001의 `/api/ra/dashboard`·`/conversations`·`/projects`·`/sources`·`/templates`·`/updates`)에 `withPermission(action)` 래핑 |
| Audit 완전성 | `audit_logs.action` enum 확장: `auth.login`, `auth.logout`, `session.invalidate`, `expert_review.create`, `expert_review.assign`, `expert_review.resolve`, `rbac.permission_deny` — `lib/audit.ts` `AuditAction` type 업데이트, Auth.js callback에서 login/logout writeAudit 호출 |
| Audit 정적 분석 | `scripts/qa/audit-completeness.ts` (ts-morph 기반 — 모든 POST/PATCH/DELETE/PUT Route Handler에 writeAudit 호출 존재 검증 + writeAudit meta에 금지 키(`question`/`answer`/`email`/`phone`) 부재 검증), CI workflow (`.github/workflows/ci.yml`) 내 `pnpm audit:check` 단계 |
| Dark Mode Runtime | `stores/ui.ts` Zustand store에 `theme` 추가 (Phase 1에서 placeholder), `components/shell/ThemeToggle.tsx` (Topbar 버튼), `app/layout.tsx` head 내 FOUT 방지 inline `<script>`, `PATCH /api/ra/profile` theme_pref 동기화 |
| i18n Runtime | `next-intl` 의존성 추가, `lib/i18n/dictionaries/ko.ts` + `en.ts` (전체 UI 문자열 dictionary), `lib/i18n/index.ts` (훅 `useI18n`, 서버 사이드 `getTranslations`), `lib/i18n/regulatory-glossary.ts` (UNTRANSLATABLE + CONTROLLED_TRANSLATIONS), `components/shell/LocaleToggle.tsx` (Topbar 스위처), `ConsultRequest.locale` 런타임 반영 |
| i18n 검증 | `scripts/qa/i18n-completeness.ts` (ko 키 == en 키 정적 검증), CI 단계 추가 |
| Accessibility | `@axe-core/playwright` 또는 `vitest-axe` 통합 (테스트 환경), `scripts/qa/a11y-check.ts` (CI gate), Storybook `@storybook/addon-a11y` 설치, `components/shared/SkipToContent.tsx` (스킵 링크), 모든 interactive component의 ARIA 속성 완비, `prefers-reduced-motion` CSS 미디어 쿼리 적용 |
| Observability | `@sentry/nextjs` 설정 (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`), `posthog-js` 클라이언트 설정 (`lib/analytics/posthog.ts`, EU 리전 호스트), `langfuse` 서버 SDK 설정 (`lib/ai/langfuse.ts`, RAG 파이프라인 generation trace), Vercel Analytics `@vercel/analytics` 설치, `.env.example` 갱신 (4개 벤더 키) |
| 관측성 분리 정책 | `lib/audit.ts`와 `lib/analytics/posthog.ts`를 별도 모듈로 유지, audit_logs write는 Sentry/PostHog/Langfuse에 **미전송** 명시, PII-free 보장 |

### Out of Scope

다음 항목은 Phase 6 (Quality & Launch) 또는 Post-launch에서 처리한다.

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| LLM eval harness (promptfoo 또는 custom) | Phase 6 | handoff §17 — 50+ RA 질문 회귀 셋은 별도 데이터셋 큐레이션 필요 |
| Playwright E2E 전체 스위트 | Phase 6 | 본 SPEC은 a11y smoke test만 포함, 핵심 플로우 E2E는 Phase 6 |
| 부하 테스트 (k6 / Artillery) | Phase 6 | production-like 환경 및 LLM API quota 조정 필요 |
| VPAT 공식 문서 | Phase 6 | 본 SPEC은 감사 기반 상태 확보까지, 공식 문서화는 Phase 6 |
| Feature flag 시스템 (Statsig / Vercel Flags) | Phase 6 | handoff §18 "gradual rollout" — production release 전 도입 |
| Rollback runbook + migration down script | Phase 6 | 운영 절차 문서화 |
| Sentry production alert threshold 튜닝 | Phase 6+ | production 트래픽 데이터 필요 |
| 이메일 notification (expert review queue) | Post-launch | 3rd-party 벤더 선정 + preference UI 추가, Phase 5는 `users.notification_pref` 컬럼만 선행 도입 |
| Slack / Teams integration | Post-launch | handoff §19 Suggested Additional Features |
| 21 CFR Part 11 **전자 서명** | Post-launch | GxP 워크플로우 대상 여부 미확정 |
| PostHog session replay | Post-launch | privacy 리뷰 완료 후 opt-in |
| DB-level RLS (Row-Level Security) | Post-launch | 본 SPEC은 애플리케이션 레이어 RBAC로 한정. Supabase 이관 시 RLS 추가 검토 |
| ABAC (attribute-based access control) | 미결정 | 현 RBAC로 충분, 필요 시 Post-launch |
| 동적 정책 키워드 DB 관리 UI | Phase 7+ | 현 Phase는 `lib/ai/policy-keywords.ts` 하드코딩 list 유지 (regula-expert-review-gating 스킬 L155–157) |

---

## 기술 결정 (Technical Decisions)

research.md에서 상세 근거를 기록했고, 본 섹션은 결정 결과만 요약한다.

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | i18n 라이브러리 | **next-intl** | react-intl | Next.js 15 App Router + RSC 네이티브 통합, dictionary TS 타이핑, SSR 안전 locale 전환 | RTL 언어(아랍어/히브리어) 지원 필요 시 |
| 2 | RBAC 모델 | **Role + Organization/Project scope 2-tier** | ABAC (OPA 등) | 요구사항 단순, 읽기 성능 1 쿼리, 테스트 용이, 조합 폭발 회피 | Project-level role 세분화 필요 시 (현재 참여 여부만 확인) |
| 3 | Notification 채널 | **In-app polling 5s** (Phase 5) + email opt-in (Post-launch) | Slack webhook / 즉시 email | 초기 복잡도 감소, Phase 5 범위 관리, preference UI는 Post-launch | 고객 요청 집중 시 Post-launch 1-2주 내 이메일 도입 |
| 4 | Theme persistence | **localStorage + users.theme_pref DB 양방향** | localStorage only / DB only | Cross-device 일관성, 로그인 전 flash 방지, FOUT 회피 | — (안정적 패턴) |
| 5 | Observability 구성 | **Sentry + PostHog + Langfuse + Vercel Analytics (4-way)** | Datadog / New Relic 통합 플랫폼 | 각 도구 강점 + LLM-specific Langfuse 대체 불가 + 비용 효율 | 월 $500 초과 시 통합 검토 |
| 6 | Expert review notification trigger | **애플리케이션 레이어 (Route Handler)** | DB trigger | 테스트 용이, Sentry/Langfuse trace 포함, 다중 채널 확장 용이 | notification miss가 규제 이슈로 격상될 경우 Post-launch에 DB trigger 추가 |

---

## EARS 요구사항 (EARS Requirements)

본 SPEC은 **73개 REQ-ENTERPRISE**를 7개 그룹으로 조직한다. 각 REQ는 EARS 패턴(Ubiquitous / Event-Driven / State-Driven / Unwanted / Optional) 중 하나를 명시한다.

- **Group A — Expert Review API 및 UI** (REQ-ENTERPRISE-001 ~ REQ-ENTERPRISE-015): 15개
- **Group B — RBAC** (REQ-ENTERPRISE-016 ~ REQ-ENTERPRISE-027): 12개
- **Group C — Audit 완전성** (REQ-ENTERPRISE-028 ~ REQ-ENTERPRISE-038): 11개
- **Group D — 다크 모드 런타임** (REQ-ENTERPRISE-039 ~ REQ-ENTERPRISE-045): 7개
- **Group E — i18n 런타임** (REQ-ENTERPRISE-046 ~ REQ-ENTERPRISE-055): 10개
- **Group F — 접근성 (WCAG 2.1 AA)** (REQ-ENTERPRISE-056 ~ REQ-ENTERPRISE-065): 10개
- **Group G — 관측성** (REQ-ENTERPRISE-066 ~ REQ-ENTERPRISE-073): 8개

---

### Group A: Expert Review API 및 UI (REQ-ENTERPRISE-001 ~ REQ-ENTERPRISE-015)

regula-expert-review-gating 스킬의 **게이팅 우회 금지 원칙**을 Phase 5의 모든 구현이 준수해야 한다. 자동 플래그는 해제 불가(스킬 L188), resolved 상태 전이만 허용.

#### REQ-ENTERPRISE-001 (Ubiquitous)
**요구사항:** The system SHALL provide `app/api/ra/expert-review/route.ts` with a POST handler that creates a new expert review entry in `expert_reviews` table.
**근거:** handoff §11.8 `POST /api/ra/expert-review` + regula-expert-review-gating 스킬 L60–63.
**검증 방법:** `curl -X POST /api/ra/expert-review` with valid session returns `201 { id, status: 'pending' }`. `expert_reviews` row inserted.

#### REQ-ENTERPRISE-002 (Ubiquitous)
**요구사항:** The POST `/api/ra/expert-review` request body SHALL be validated by Zod schema `lib/schemas/expert-review.ts` with these exact fields:
```ts
{
  conversationId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).optional(),  // 특정 message(들) 플래그. 없으면 conversation 전체.
  reason: z.enum(['user_manual', 'auto_confidence', 'auto_policy_keyword']),
  notes: z.string().max(2000).optional(),
}
```
**근거:** regula-expert-review-gating 스킬 L60–63 + handoff §11 "Requests typed via Zod".
**검증 방법:** Invalid body returns 400 with Zod error detail. Valid minimal `{ conversationId }` succeeds.

#### REQ-ENTERPRISE-003 (Ubiquitous)
**요구사항:** The system SHALL provide `app/api/ra/expert-review/[id]/route.ts` with GET (single review detail) and PATCH (status transition, assignment) handlers.
**근거:** handoff §11.8 + Phase 5 workflow "pending → in_review → resolved".
**검증 방법:** `GET /api/ra/expert-review/{id}` returns full record with joined user info. `PATCH` updates allowed fields.

#### REQ-ENTERPRISE-004 (State-Driven)
**요구사항:** IF the current `expert_reviews.status` is `pending` OR `in_review`, THEN the PATCH handler SHALL allow status transitions to `in_review` (from `pending`) OR `resolved` (from `in_review`) with optional `assignedTo` and `notes` fields.
**근거:** regula-expert-review-gating 스킬 L188–190 "관리자도 자동 플래그를 해제할 수 없음 (resolved 상태로 이동만 가능)" — 상태 머신 정의.
**검증 방법:** PATCH `{ status: 'in_review' }` on pending row succeeds. PATCH `{ status: 'pending' }` on resolved row returns 409 Conflict.

#### REQ-ENTERPRISE-005 (Unwanted)
**요구사항:** The system SHALL NOT allow DELETE on any `expert_reviews` row via any Route Handler. IF a DELETE request arrives at `/api/ra/expert-review/[id]`, THEN return 405 Method Not Allowed.
**근거:** regula-expert-review-gating 스킬 게이팅 우회 금지 원칙 + handoff §16 immutable audit requirement confluence.
**검증 방법:** `curl -X DELETE /api/ra/expert-review/{id}` returns 405. `app/api/ra/expert-review/[id]/route.ts`에 `export async function DELETE` 부재를 정적 확인.

#### REQ-ENTERPRISE-006 (Unwanted)
**요구사항:** The PATCH `/api/ra/expert-review/[id]` handler SHALL NOT allow modification of these fields regardless of caller role: `id`, `conversation_id`, `message_id`, `requested_by`, `reason`, `created_at`. Only `status`, `assigned_to`, `notes`, `resolved_at` are mutable.
**근거:** 감사 무결성 — 최초 플래그 기록의 who/why/when은 불변.
**검증 방법:** PATCH body containing `requested_by: '<other-user-id>'` returns 400 with Zod reject. PATCH body containing only allowed fields succeeds.

#### REQ-ENTERPRISE-007 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/ai/expert-review-gating.ts` exporting `shouldAutoFlag(confidence: ConfidenceResult, question: string, prose: string): { flag: boolean; reason: string | null }` function implementing the two auto-flagging conditions: `confidence.score < 0.7` OR `detectPolicyKeyword(question, prose) !== null`.
**근거:** regula-expert-review-gating 스킬 L13–54.
**검증 방법:** Unit test in `tests/unit/expert-review-gating.test.ts`: confidence 0.6 returns `{ flag: true, reason: 'confidence 0.60 < 0.7' }`. "임상시험 면제" in question returns `{ flag: true, reason: /policy keyword:.*임상시험 면제/ }`. confidence 0.9 + safe keyword returns `{ flag: false, reason: null }`.

#### REQ-ENTERPRISE-008 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/ai/policy-keywords.ts` exporting `POLICY_BLOCKED_KEYWORDS` as a frozen array containing at minimum these Korean/English keywords:
- Korean: "임상시험 면제", "임상시험 생략", "IDE 면제", "응급", "판매 허가 없이", "신고 없이 판매", "리콜 회피"
- English: "emergency use authorization", "humanitarian", "off-label marketing", "recall avoidance"

and `detectPolicyKeyword(question: string, prose: string): string | null` function that returns the matched keyword (case-insensitive) or null.
**근거:** regula-expert-review-gating 스킬 L28–54.
**검증 방법:** Unit test: `detectPolicyKeyword("응급 상황에서 임상시험 면제 가능한가?", "")` returns `"응급"` or `"임상시험 면제"` (first match). Empty inputs return `null`.

#### REQ-ENTERPRISE-009 (Event-Driven) [v0.2.0 C1 오너십 명확화]
**요구사항:** WHEN `lib/ai/consult.ts` Phase C computes confidence AND `shouldAutoFlag()` returns `{ flag: true, ... }`, THEN the generator SHALL (a) yield an SSE event `{ type: 'expert_review_required', reason: string }` **before** the `done` event, (b) call `writeAudit({ action: 'consult.expert_review_auto_flag', ... })`, AND (c) call `enqueueExpertReview({ conversationId, messageId, reason, requestedBy: SYSTEM_USER_UUID })` which inserts into `expert_reviews` (idempotent: uses `ON CONFLICT (conversation_id, message_id) DO NOTHING` to handle retry safely).

**v0.2.0 C1 오너십 구조 (cross-spec-audit):**
- **Phase 2 CHAT 담당**: (a) SSE event 방출 + (b) `writeAudit(action:'expert_review.flag')` — 이미 CHAT REQ-CHAT-055 v0.2.0에서 구현.
- **Phase 5 ENTERPRISE 담당 (이 REQ)**: (c) `enqueueExpertReview` row INSERT + 추가 audit `consult.expert_review_auto_flag` (별도 의도 추적용 — `expert_review.flag`는 "게이트 발동" 이벤트, `consult.expert_review_auto_flag`는 "큐 등록 실행" 이벤트로 구분).

**스코프 영향:** Phase 5 구현 시 Phase 2의 `consult.ts` 파일에 추가 call-site를 삽입한다(Phase 2 소유 파일 modification). 이는 BREADTH REQ-BREADTH-047의 "Phase 2 consult.ts 확장" 패턴과 동일 방식. FOUNDATION v0.4.0 REQ-FND-049 inventory table은 `consult.expert_review_auto_flag`를 Phase 5 신규 enum 값으로 선제 선언하여 REQ-ENTERPRISE-028과 정합.

**근거:** regula-expert-review-gating 스킬 L68–97 + cross-spec-audit C1 (CHAT은 event+audit, ENTERPRISE는 row INSERT — double-insert race 방지) + FOUNDATION v0.4.0 REQ-FND-049 (audit_action enum inventory).
**검증 방법:** Integration test: simulate consult with forced low confidence → (1) `expert_review_required` SSE event 방출 확인, (2) `audit_logs`에 `expert_review.flag` + `consult.expert_review_auto_flag` 2건 row 확인 (CHAT call-site + ENTERPRISE call-site), (3) `expert_reviews` row 존재 확인 (`requested_by = SYSTEM_USER_UUID`, `reason` matches), (4) 동일 requestId 재시도 시 `ON CONFLICT DO NOTHING` 동작 확인 (expert_reviews 중복 row 없음).

#### REQ-ENTERPRISE-010 (Ubiquitous)
**요구사항:** WHEN `shouldAutoFlag()` fires, the system SHALL also set `messages.expert_review_required = true` on the message row (FOUNDATION-001 schema already includes this column) so that UI can display the badge when viewing historical conversations.
**근거:** regula-expert-review-gating 스킬 L138–139.
**검증 방법:** After auto-flag fires, `SELECT expert_review_required FROM messages WHERE id = ?` returns `true`.

#### REQ-ENTERPRISE-011 (Ubiquitous)
**요구사항:** The system SHALL provide `components/chat/ExpertReviewCallout.tsx` rendering amber-variant Callout (STRUCTURED-001 dependency) below the prose meta row when `structured.expertReviewRequired` is present. Korean default text: "전문가 검토가 필요합니다 / 이 답변은 자동으로 RA 전문가 검토 큐에 추가되었습니다. 검토 완료까지 이 답변을 의사결정에 사용하지 마십시오. / 사유: {reason}". English text from dictionary.
**근거:** regula-expert-review-gating 스킬 L101–117.
**검증 방법:** Storybook story `ExpertReviewCallout.stories.tsx` renders ko and en variants with reason prop. Visual regression screenshot stable.

#### REQ-ENTERPRISE-012 (Event-Driven)
**요구사항:** WHEN the `useStreamingAnswer` hook receives an `expert_review_required` SSE event, THEN it SHALL (1) display a toast `toast.info(t.chat.expertReviewBanner, { description: ev.reason, duration: 5000 })` AND (2) set `state.structured.expertReviewRequired = { reason: ev.reason }` so `ExpertReviewCallout` renders.
**근거:** regula-expert-review-gating 스킬 L143–152.
**검증 방법:** Vitest+testing-library test: dispatch mock SSE event → toast rendered, Callout rendered in DOM.

#### REQ-ENTERPRISE-013 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/expert-review/page.tsx` as the expert review queue page, rendering a sortable/filterable list of `expert_reviews` rows (joined with `conversations`, `messages`, `users` for requestor and assignee names). The page SHALL be protected by `withPermission('expertReview.view')` and return 403 for users without `admin` or `ra-lead` role.
**근거:** handoff §16 RBAC + regula-expert-review-gating 스킬 workflow + Technical Decision 2 (RBAC 2-tier).
**검증 방법:** `ra-member` session GET `/expert-review` returns 403. `ra-lead` session returns 200 with queue list. Filter by status=pending returns only pending rows.

#### REQ-ENTERPRISE-014 (Event-Driven)
**요구사항:** WHEN the user clicks the Topbar "전문가 검토" button on a conversation view, THEN the UI SHALL POST to `/api/ra/expert-review` with `{ conversationId, reason: 'user_manual' }`, show toast on success, AND invalidate the TanStack Query `useExpertReviews` cache to reflect the new entry immediately if the user navigates to the queue page.
**근거:** handoff §9.3 Manual flag + regula-expert-review-gating 스킬 L57–63.
**검증 방법:** E2E smoke: click button → 201 response → toast appears → queue page shows new entry.

#### REQ-ENTERPRISE-015 (Optional)
**요구사항:** WHERE in-app notification badge is visible in the Topbar, the system SHALL display the count of `expert_reviews` with `status = 'pending' AND assigned_to IS NULL` via polling `GET /api/ra/expert-review?status=pending&unassigned=true` every 5 seconds when the user has `admin` or `ra-lead` role. For `ra-member` and `viewer` roles, the badge SHALL NOT be visible.
**근거:** handoff §18 "expert-queue backlog" alert + Technical Decision 3 (in-app polling 5s).
**검증 방법:** E2E test: `ra-lead` login → badge shows N → create new pending review → badge updates within 10s. `ra-member` login → badge absent (DOM 부재 확인).

---

### Group B: RBAC (REQ-ENTERPRISE-016 ~ REQ-ENTERPRISE-027)

`admin` > `ra-lead` > `ra-member` > `viewer` role hierarchy. Organization/Project scope 2-tier. 모든 Write Route Handler에 permission guard 적용.

#### REQ-ENTERPRISE-016 (Ubiquitous)
**요구사항:** The system SHALL define a Postgres enum `user_role AS ENUM ('admin', 'ra-lead', 'ra-member', 'viewer')` via migration, AND alter `users.role` column to use this enum type with NOT NULL constraint and default value `'ra-member'`.
**근거:** FOUNDATION-001 REQ-FND-032 (users.role text column placeholder) + Phase 5 "RBAC enum 확장 예정" 주석.
**검증 방법:** `SELECT typname, enum_range FROM pg_type WHERE typname = 'user_role'` returns all 4 values. Existing rows migrated to `'ra-member'` default.

#### REQ-ENTERPRISE-017 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/auth/rbac.ts` exporting:
- `type Role = 'admin' | 'ra-lead' | 'ra-member' | 'viewer'`
- `const ROLE_HIERARCHY: Record<Role, number> = { admin: 4, 'ra-lead': 3, 'ra-member': 2, viewer: 1 }`
- `hasRole(userRole: Role, required: Role): boolean` returning `ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]`
**근거:** Technical Decision 2 (2-tier, Role hierarchy monotonic).
**검증 방법:** Unit test: `hasRole('admin', 'ra-member')` true, `hasRole('viewer', 'ra-lead')` false, `hasRole('ra-lead', 'ra-lead')` true.

#### REQ-ENTERPRISE-018 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/auth/acl.ts` exporting `isOrgMember(userId, orgId)` and `isProjectMember(userId, projectId)` functions querying `org_members` and `project_members` tables respectively. Both return `true` only if the membership row exists (no role-level check at project tier).
**근거:** Technical Decision 2 (Organization/Project scope 2-tier). FOUNDATION-001 includes these tables.
**검증 방법:** Unit test with fixture data: user in `org_members` → `isOrgMember` true, user not in → false.

#### REQ-ENTERPRISE-019 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/auth/with-permission.ts` exporting `withPermission(action: PermissionAction)` higher-order function that wraps a Route Handler. `PermissionAction` type defines named permissions (e.g., `'consult.create'`, `'expertReview.view'`, `'expertReview.assign'`, `'dashboard.view'`, `'project.manage'`, `'ingest.corpus'`). The wrapper checks: (1) session exists, (2) user role satisfies action's minimum role, (3) for resource-scoped actions, user is a member of the referenced org/project.
**근거:** regula-audit-compliance 스킬 Route Handler 패턴 + Technical Decision 2.
**검증 방법:** Test suite in `tests/unit/auth/with-permission.test.ts` covering all PermissionAction values with all 4 roles × (member/non-member) matrix.

#### REQ-ENTERPRISE-020 (Ubiquitous)
**요구사항:** The system SHALL define the permission action matrix in `lib/auth/permissions.ts` with at minimum these mappings:

| Action | Min Role | Scope |
|---|---|---|
| `consult.create` | ra-member | project-scoped if `projectId` present |
| `conversation.view` | ra-member | org-scoped (conversation owner's org) |
| `conversation.delete` | ra-lead | org-scoped |
| `dashboard.view` | ra-member | org-scoped |
| `dashboard.team` | ra-lead | org-scoped |
| `expertReview.view` | ra-lead | org-scoped |
| `expertReview.assign` | ra-lead | org-scoped |
| `expertReview.resolve` | ra-lead | org-scoped |
| `project.create` | ra-lead | org-scoped |
| `project.manage` | ra-lead | project-scoped |
| `sources.ingest` | admin | org-scoped |
| `templates.edit` | ra-lead | org-scoped |
| `rbac.manage` | admin | org-scoped |

**근거:** handoff §16 "Org/project-scoped".
**검증 방법:** Static check in `tests/unit/permissions.test.ts` ensures all exported PermissionAction values appear in the matrix.

#### REQ-ENTERPRISE-021 (Ubiquitous)
**요구사항:** All existing Route Handlers from CHAT-001, STRUCTURED-001, and BREADTH-001 SHALL be updated to wrap their handler exports with `withPermission(<action>)`. Specifically: `/api/ra/consult` → `consult.create`, `/api/ra/conversations/[id]` GET → `conversation.view`, `/api/ra/conversations/[id]` DELETE → `conversation.delete`, `/api/ra/dashboard` → `dashboard.view`, `/api/ra/projects` POST → `project.create`, `/api/ra/projects/[id]` PATCH → `project.manage`, `/api/admin/ingest/*` → `sources.ingest`.
**근거:** Phase 5 RBAC 광범위 침투 정의 (research.md 긴장 3).
**검증 방법:** Static grep: `app/api/**/route.ts`의 모든 export(GET/POST/PATCH/DELETE) 중 `withPermission(` 래핑 없는 export 0건. `scripts/qa/rbac-coverage.ts`가 CI에서 검증.

#### REQ-ENTERPRISE-022 (State-Driven)
**요구사항:** IF `withPermission` denies a request due to insufficient role, THEN the handler SHALL return HTTP 403 with body `{ error: 'permission_denied', required: <action>, actual_role: <role> }` AND call `writeAudit({ action: 'rbac.permission_deny', actor: session.user.id, resourceType, resourceId, meta: { required: action, actualRole: role } })`.
**근거:** handoff §16 audit trail + regula-audit-compliance 스킬 전체 이벤트 기록 원칙.
**검증 방법:** E2E: viewer role calls `/api/ra/expert-review` POST → 403 response + `audit_logs` row with `action = 'rbac.permission_deny'`.

#### REQ-ENTERPRISE-023 (State-Driven)
**요구사항:** IF `withPermission` denies due to missing org/project membership (even if role sufficient), THEN the handler SHALL return HTTP 403 with body `{ error: 'not_a_member', resource_type, resource_id }` AND audit log with same `rbac.permission_deny` action and `meta.reason: 'not_a_member'`.
**근거:** Technical Decision 2 2-tier scope enforcement.
**검증 방법:** E2E: admin user in Org A calls `/api/ra/projects/{id}` PATCH for a project in Org B → 403 not_a_member + audit logged.

#### REQ-ENTERPRISE-024 (Unwanted)
**요구사항:** The system SHALL NOT expose any Route Handler that bypasses permission checks. `withPermission(action)` wrapping is mandatory for every handler that mutates data or returns organization/project-scoped data. Public routes (`/api/health`, `/api/auth/*` managed by Auth.js) are explicitly whitelisted in `scripts/qa/rbac-coverage.ts`.
**근거:** research.md 긴장 3 (RBAC 광범위 침투).
**검증 방법:** CI job `pnpm rbac:check` passes only when all non-whitelisted handlers are wrapped. Whitelist changes require PR review.

#### REQ-ENTERPRISE-025 (Ubiquitous)
**요구사항:** The `app/(app)/expert-review/page.tsx` page component SHALL perform a server-side role check via `auth()` + `hasRole(user.role, 'ra-lead')` before rendering. On failure, `redirect('/')` with a toast message via query param `?denied=expert-review`.
**근거:** REQ-ENTERPRISE-013 RBAC enforcement at UI level as defense-in-depth.
**검증 방법:** E2E: ra-member navigates to `/expert-review` → redirected to `/` with toast.

#### REQ-ENTERPRISE-026 (Optional)
**요구사항:** WHERE the Sidebar menu item "전문가 검토" is visible, its visibility SHALL be conditional on `hasRole(user.role, 'ra-lead')`. For `ra-member` and `viewer` roles, the menu item is hidden entirely (not just disabled).
**근거:** handoff §9.3 + UX principle (unreachable navigation should not be shown).
**검증 방법:** Storybook/RTL test: render `<Sidebar user={{ role: 'ra-member' }} />` → "전문가 검토" 링크 부재. `{ role: 'admin' }` → 링크 존재.

#### REQ-ENTERPRISE-027 (Ubiquitous)
**요구사항:** The system SHALL add `users.notification_pref` column via migration with type `jsonb`, default `{}`, nullable false. This column is a placeholder for Post-launch email notification preferences and is NOT read by Phase 5 code. The migration is included in Phase 5 to avoid a separate migration in Post-launch.
**근거:** Technical Decision 3 forward-compatibility.
**검증 방법:** Schema introspection confirms column exists with default `{}`.

---

### Group C: Audit 완전성 (REQ-ENTERPRISE-028 ~ REQ-ENTERPRISE-038)

regula-audit-compliance 스킬의 완전성 세 기둥: (1) 모든 Write Route Handler writeAudit, (2) writeAudit 실패 시 요청 실패, (3) PII 누설 금지.

#### REQ-ENTERPRISE-028 (Ubiquitous) [v0.2.0 C3/C6/H7 확장]
**요구사항:** The `AuditAction` TypeScript union in `lib/audit.ts` AND the Postgres `audit_action` pgEnum (FOUNDATION v0.4.0 REQ-FND-044) SHALL be extended in Phase 5 via single migration `migrations/00XX_enterprise_audit_actions.sql` adding the following 13 values:

**Phase 5 신규 enum 값 (13개):**
1. `'auth.login'`
2. `'auth.logout'`
3. `'auth.mfa_fail'`
4. `'session.invalidate'`
5. `'expert_review.create'`
6. `'expert_review.assign'`
7. `'expert_review.resolve'`
8. `'rbac.permission_deny'`
9. `'profile.theme_update'`
10. `'profile.locale_update'`
11. **`'checklist.toggle'`** (v0.2.0 C3 — STRUCTURED REQ-STRUCT-037에서 이월, Phase 5 writeAudit wiring 추가)
12. **`'consult.expert_review_auto_flag'`** (v0.2.0 C3 — REQ-ENTERPRISE-009에서 참조)
13. **`'project.switch'`** (v0.2.0 C3 — BREADTH REQ-BREADTH-049 Phase 5 wiring)

**누적 enum inventory (v0.2.0 H7 해소):**
- Phase 1 (FOUNDATION): 3개 (`llm.call`, `source.access`, `expert_review.flag`)
- Phase 4 (BREADTH): +10개 (REQ-BREADTH-057: `conversations.list`, `conversation.view`, `message.feedback`, `template.list`, `template.download`, `updates.list`, `dashboard.view`, `projects.list`, `project.create`, `project.update`)
- Phase 5 (이 REQ): +13개
- **누적 합계 = 26 values** (FOUNDATION v0.4.0 REQ-FND-049 inventory table과 정합).

**Enum drift 방지 (v0.2.0 H7):** 이 REQ는 BREADTH의 10개 값을 **삭제하거나 재정의하지 않는다**. Phase 5 migration의 `ALTER TYPE audit_action ADD VALUE '...'` 스크립트는 13개 new value만 추가하며, 기존 Phase 4 값과의 충돌은 Postgres가 "unique name" 제약으로 보장한다. `lib/audit.ts` TS union은 누적 26개 값 모두 포함.

**근거:** FOUNDATION v0.4.0 REQ-FND-049 Phase 5 enum 추가 + regula-audit-compliance 스킬 L62–85 + cross-spec-audit C3 (3개 누락 enum 값 복구) + C6 (pgEnum 통일) + H7 (cumulative inventory declaration).
**검증 방법:** (1) TypeScript compilation: `lib/audit.ts`의 `AuditAction` union이 누적 26개 값 포함, 모든 writeAudit call이 type-check 통과. (2) DB 검증: `SELECT enum_range(NULL::audit_action)` 결과 = 26 elements. (3) Phase 5 신규 13 값 각각에 대해 최소 1개 writeAudit call-site 존재 (static grep: `grep -r "action: '<value>'" lib/ app/`). (4) Unit test asserts enum_range vs TS union 길이 + 내용 동일.

#### REQ-ENTERPRISE-029 (Event-Driven)
**요구사항:** WHEN Auth.js `signIn` callback completes successfully, THEN the system SHALL call `writeAudit({ action: 'auth.login', actor: user.id, resourceType: 'session', resourceId: session.id, meta: { provider: <oauth-provider>, ip: <request.ip> } })`. WHEN `signOut` completes, `writeAudit({ action: 'auth.logout', ... })`.
**근거:** FOUNDATION-001 REQ-FND-049 wire-up (Phase 5 집행) + handoff §16 audit trail.
**검증 방법:** E2E: user logs in → `audit_logs` row with `action = 'auth.login'` exists within 1s. Logout → corresponding row.

#### REQ-ENTERPRISE-030 (Event-Driven)
**요구사항:** WHEN a user updates their profile theme preference via `PATCH /api/ra/profile`, THEN `writeAudit({ action: 'profile.theme_update', actor: userId, resourceType: 'user', resourceId: userId, meta: { from: <old>, to: <new> } })`. Same pattern for `profile.locale_update`.
**근거:** handoff §16 + Groups D/E integration.
**검증 방법:** E2E: theme toggle → DB update → audit row present.

#### REQ-ENTERPRISE-031 (Event-Driven)
**요구사항:** WHEN `expert_reviews` PATCH transitions status to `in_review` (assignment) or `resolved`, THEN `writeAudit({ action: 'expert_review.assign' | 'expert_review.resolve', actor: userId, resourceType: 'expert_review', resourceId: reviewId, meta: { from_status: <old>, to_status: <new>, assigned_to: <userId or null> } })`.
**근거:** handoff §16 + regula-expert-review-gating 스킬 audit requirements.
**검증 방법:** Integration test: PATCH `status: 'resolved'` → audit row with `action = 'expert_review.resolve'`.

#### REQ-ENTERPRISE-032 (Ubiquitous)
**요구사항:** The system SHALL provide `scripts/qa/audit-completeness.ts` using ts-morph to statically analyze all files under `app/api/**/route.ts`. For every exported HTTP handler function of method POST, PATCH, DELETE, or PUT, the script SHALL verify that a `writeAudit(` call exists somewhere in the function body (including nested try/catch blocks). Handlers without writeAudit are reported as violations.
**근거:** regula-audit-compliance 스킬 L139–150 AST-grep 위험 패턴.
**검증 방법:** Running `pnpm audit:check` on a handler with missing writeAudit returns exit code 1 and prints file+function. After fix, exit code 0.

#### REQ-ENTERPRISE-033 (Unwanted)
**요구사항:** The `scripts/qa/audit-completeness.ts` script SHALL detect and fail on these PII leakage patterns in `writeAudit(...)` meta object literals: keys matching `/question|answer|email|phone|ssn|dob/i` OR string values longer than 500 characters.
**근거:** regula-audit-compliance 스킬 L109 (meta PII 금지) + L150.
**검증 방법:** Test fixture with `meta: { question: '...' }` → script exit code 1. Removing key → pass.

#### REQ-ENTERPRISE-034 (Ubiquitous)
**요구사항:** The CI workflow `.github/workflows/ci.yml` SHALL include a step `pnpm audit:check` before build. Failure blocks merge. An override mechanism via `/* audit-check-ignore: <justification> */` comment on the handler line is allowed but requires PR reviewer approval.
**근거:** regula-audit-compliance 스킬 L151 CI block.
**검증 방법:** Branch with non-audited new handler → CI red. After adding writeAudit or justified override comment → CI green.

#### REQ-ENTERPRISE-035 (State-Driven)
**요구사항:** IF `writeAudit(...)` throws at runtime (DB unreachable, trigger violation, etc.), THEN the calling Route Handler SHALL propagate the failure as HTTP 500 with body `{ error: 'audit_write_failed' }` and NOT continue execution. Silently swallowing audit failures is forbidden.
**근거:** regula-audit-compliance 스킬 L110–111 "실패 시 silently swallow 금지. writeAudit가 실패하면 해당 요청을 500 에러로 응답".
**검증 방법:** Mock test: inject DB error into writeAudit → handler returns 500. Assert no side effects persisted (transaction rollback).

#### REQ-ENTERPRISE-036 (Unwanted)
**요구사항:** The system SHALL NOT write any of the following to `audit_logs.meta`: question text, answer prose, user email, user name (first/last), phone number, SSN, date of birth, raw LLM prompt content. Allowed meta fields: resource IDs, action enum values, timestamps, counts, severity levels, locale codes, theme codes, IP address (hashed or truncated /24), provider names.
**근거:** regula-audit-compliance 스킬 PII 누설 금지 + 21 CFR Part 11 data minimization.
**검증 방법:** REQ-ENTERPRISE-033 covers static check. Runtime: sample 100 `audit_logs.meta` rows → zero PII keys.

#### REQ-ENTERPRISE-037 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/db/queries/audit.ts` exporting `getAuditTrail(params: { resourceType?, resourceId?, actorId?, from?, to?, limit?, offset? })` function that is READ-ONLY (Drizzle `select` only, no `insert`/`update`/`delete`) and sorts by `created_at DESC`. This is the sole query entry point for audit trail access during regulatory inspections.
**근거:** regula-audit-compliance 스킬 L156–174.
**검증 방법:** File `lib/db/queries/audit.ts` inspection: zero `db.insert`/`db.update`/`db.delete` references. Unit test returns paginated results.

#### REQ-ENTERPRISE-038 (Unwanted)
**요구사항:** The system SHALL NOT send audit log payloads to Sentry, PostHog, Langfuse, Vercel Analytics, or any third-party observability vendor. Audit logs remain in the application's own Postgres `audit_logs` table for 7-year retention only. Observability vendors receive operational telemetry (errors, metrics, traces) in separate code paths.
**근거:** regula-audit-compliance 스킬 L16 "Observability와 분리" + handoff §16 "immutable append-only audit_logs".
**검증 방법:** Static grep: `Sentry.captureMessage(` / `posthog.capture(` / `langfuse.trace(` invocations do NOT appear within 5 lines of `writeAudit(` call sites. `lib/audit.ts` imports zero observability modules.

---

### Group D: 다크 모드 런타임 (REQ-ENTERPRISE-039 ~ REQ-ENTERPRISE-045)

FOUNDATION-001에서 `[data-theme="dark"]` CSS 오버라이드 블록은 존재 (REQ-FND-027). Phase 5는 런타임 토글 + 영속화 + FOUT 방지.

#### REQ-ENTERPRISE-039 (Ubiquitous)
**요구사항:** The `stores/ui.ts` Zustand store SHALL include `theme: 'light' | 'dark' | 'system'` field AND `setTheme(next: 'light' | 'dark' | 'system'): void` action that updates the store, writes `'regula-theme'` key in localStorage, calls `document.documentElement.setAttribute('data-theme', <resolved>)` where `resolved = next === 'system' ? (prefersDark ? 'dark' : 'light') : next`, and fires a debounced (500ms) `PATCH /api/ra/profile` with `{ theme_pref: next }`.
**근거:** handoff §9.5 + Technical Decision 4 (localStorage + DB 양방향).
**검증 방법:** RTL test: call `setTheme('dark')` → `document.documentElement.getAttribute('data-theme')` is `'dark'`, localStorage `regula-theme` is `'dark'`. After 500ms, fetch mock called with PATCH profile.

#### REQ-ENTERPRISE-040 (Ubiquitous)
**요구사항:** The system SHALL provide `components/shell/ThemeToggle.tsx` rendering a Radix Toggle button with sun/moon/system-auto icons (lucide-react: `Sun`, `Moon`, `Monitor`). The button cycles through `light → dark → system → light` on click, or exposes a dropdown menu for direct selection (implementation choice). Aria-label from dictionary: `t.shell.themeToggle` (default ko: "테마 전환", en: "Toggle theme").
**근거:** handoff §9.5 Topbar theme toggle + §14 aria-label.
**검증 방법:** Storybook story renders all 3 states. Click advances state, updates store.

#### REQ-ENTERPRISE-041 (Ubiquitous)
**요구사항:** The `app/layout.tsx` `<head>` SHALL contain an inline `<script>` block executed before body render that reads `localStorage.getItem('regula-theme')` (or `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'` if localStorage empty) AND calls `document.documentElement.setAttribute('data-theme', <resolved>)`. This prevents FOUT (flash of unstyled theme) during hydration.
**근거:** Technical Decision 4 + Next-themes library pattern.
**검증 방법:** View source of `/` with `regula-theme=dark` localStorage set → inline script present before body → initial paint is dark. No flash visible in Playwright video capture.

#### REQ-ENTERPRISE-042 (Event-Driven)
**요구사항:** WHEN the user first visits the app without `'regula-theme'` in localStorage AND without an authenticated session (`theme_pref` unavailable), THEN the system SHALL resolve the initial theme from `prefers-color-scheme` media query. IF the user later logs in AND `users.theme_pref` differs from the current `data-theme`, THEN the login callback SHALL apply `users.theme_pref` as the new authoritative value and update localStorage accordingly.
**근거:** handoff §9.5 "prefers-color-scheme respected on first visit" + Technical Decision 4.
**검증 방법:** E2E: clear localStorage → OS dark mode → visit `/` → data-theme = dark. Login as user with `theme_pref = 'light'` → data-theme switches to light, localStorage updated.

#### REQ-ENTERPRISE-043 (Event-Driven)
**요구사항:** WHEN `PATCH /api/ra/profile` succeeds with `theme_pref` update, THEN `writeAudit({ action: 'profile.theme_update', ... })` is invoked (per REQ-ENTERPRISE-030). No telemetry event SHALL be sent to PostHog for this action (per REQ-ENTERPRISE-038 separation).
**근거:** Group C audit completeness + Group G observability separation.
**검증 방법:** Network tab: PATCH profile → single DB write + audit row. PostHog `capture` NOT called.

#### REQ-ENTERPRISE-044 (Ubiquitous)
**요구사항:** Dark mode SHALL NOT break the serif typography discipline (FOUNDATION-001 REQ-FND-023, regula-design-tokens 스킬 L87–97). Specifically: H1 (Home hero, empty Chat), DocViewer body, Dashboard stat values, chat user questions, quoted regulatory text, list/template/Updates/Source card titles MUST render with `var(--font-serif)` in both light AND dark modes. Visual regression test MUST verify both themes.
**근거:** Non-Obvious Constraint #5 (Serif/sans 타이포 다크 모드 유지) + regula-design-tokens 스킬.
**검증 방법:** Playwright visual regression: screenshot Home, Chat, DocViewer, Dashboard in light+dark → font stack `computed style` `font-family` includes "Source Serif 4" or "Noto Serif KR" at serif-designated elements.

#### REQ-ENTERPRISE-045 (Unwanted)
**요구사항:** The `[data-theme="dark"]` CSS block in `styles/tokens.css` SHALL NOT introduce new color tokens that do not exist in the `:root` block. Dark mode is a remapping of existing semantic tokens, not a token set extension. Any new semantic color requires adding to BOTH `:root` AND `[data-theme="dark"]` in the same PR.
**근거:** regula-design-tokens 스킬 (tokens.css = 단일 진실원) + FOUNDATION-001 REQ-FND-027.
**검증 방법:** `scripts/qa/tokens-symmetry.ts` parses `styles/tokens.css` and asserts `[data-theme="dark"]` block's CSS variable names are a subset of `:root` block's names. CI gate.

---

### Group E: i18n 런타임 (REQ-ENTERPRISE-046 ~ REQ-ENTERPRISE-055)

regula-i18n 스킬의 ko/en dictionary + 대화 보존 + LLM locale 분기 + 규제 용어 glossary.

#### REQ-ENTERPRISE-046 (Ubiquitous)
**요구사항:** The system SHALL install `next-intl` as a dependency and configure it for App Router via `i18n.ts` at project root (or `lib/i18n/config.ts`) with supported locales `['ko', 'en']` and default locale `'ko'`.
**근거:** Technical Decision 1 (next-intl) + regula-i18n 스킬 원칙 "한국어는 기본 locale".
**검증 방법:** `package.json` includes `next-intl`. `pnpm build` succeeds. `NextIntlClientProvider` renders children without hydration errors.

#### REQ-ENTERPRISE-047 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/i18n/dictionaries/ko.ts` and `lib/i18n/dictionaries/en.ts` with parallel key structure covering at minimum these top-level namespaces: `shell`, `chat`, `citations`, `dashboard`, `history`, `templates`, `knowledge`, `updates`, `expertReview`, `profile`, `errors`, `a11y`. Each dictionary exported as `const ko = { ... } as const` for TypeScript literal inference.
**근거:** regula-i18n 스킬 L78–144 dictionary 구조.
**검증 방법:** TypeScript inference: `typeof ko` === `typeof en` structurally. Vitest test asserts `deepKeys(ko)` equals `deepKeys(en)`.

#### REQ-ENTERPRISE-048 (Ubiquitous)
**요구사항:** The system SHALL provide `scripts/qa/i18n-completeness.ts` that imports both `ko` and `en` dictionaries, recursively collects all leaf paths, and fails CI if the key sets are not identical. Missing keys are reported per-dictionary.
**근거:** regula-i18n 스킬 L231 "en 딕셔너리 키가 ko와 완전 일치" 체크리스트.
**검증 방법:** Removing `en.chat.send` → `pnpm i18n:check` exits 1. Restoring → passes.

#### REQ-ENTERPRISE-049 (Ubiquitous)
**요구사항:** The `stores/ui.ts` Zustand store SHALL include `locale: 'ko' | 'en'` field AND `setLocale(next: 'ko' | 'en'): void` action that updates store, calls `document.documentElement.setAttribute('lang', next)`, AND fires a debounced (500ms) `PATCH /api/ra/profile` with `{ locale: next }`. The action SHALL NOT call `router.refresh()` or reload the page.
**근거:** regula-i18n 스킬 L166–177 (대화 보존: URL 유지, 페이지 새로고침 없음).
**검증 방법:** RTL test: current page `/chat/abc`, locale is `ko`, call `setLocale('en')` → URL unchanged, `document.documentElement.lang` = `'en'`, existing SSE stream continues uninterrupted. HTML lang attribute updated.

#### REQ-ENTERPRISE-050 (Ubiquitous)
**요구사항:** The system SHALL provide `components/shell/LocaleToggle.tsx` as a Topbar component rendering a Radix Select or toggle group with "한국어" / "English" options. Current locale indicated by highlight. On change, calls `useUIStore.setLocale(next)`.
**근거:** regula-i18n 스킬 L168–175.
**검증 방법:** Storybook story + RTL: initial "한국어" selected, click "English" → store updated, DOM text switches to en dictionary.

#### REQ-ENTERPRISE-051 (Event-Driven)
**요구사항:** WHEN the user submits a consult question via Composer, THEN the `ConsultRequest.locale` field SHALL be set to the current `useUIStore.getState().locale` value AND sent to `/api/ra/consult`. The server `consult.ts` pipeline SHALL branch prompt construction via `buildSystemPrompt(locale)` returning the locale-appropriate system prompt template (regula-i18n 스킬 L208–218).
**근거:** handoff §11.1 `locale: 'ko' | 'en'` request field + regula-i18n 스킬.
**검증 방법:** Integration test: submit question with locale `'en'` → LLM response prose is in English AND contains `510(k)`/`MDR` untranslated (per REQ-ENTERPRISE-053).

#### REQ-ENTERPRISE-052 (Ubiquitous)
**요구사항:** Existing LLM-generated messages (prose text) SHALL NOT be retranslated when the UI locale changes. The `messages.content_prose` column stores the original language of generation. When the UI switches locale, chat rendering continues displaying historical messages in their stored language; only new questions go to the backend with the new locale.
**근거:** regula-i18n 스킬 L177 "현재 대화의 prose는 그대로 유지 (LLM이 생성한 원본 언어로 유지)".
**검증 방법:** E2E: consult in ko → prose stored in Korean. Switch UI to en → historical message still Korean. Ask new question → new prose in English.

#### REQ-ENTERPRISE-053 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/i18n/regulatory-glossary.ts` exporting `UNTRANSLATABLE` (frozen array containing at minimum: "510(k)", "MDR", "IVDR", "PMA", "De Novo", "MDSAP", "NB", "CE", "UDI", "IFU", "DHF", "DMR", "DHR", "GMP", "QSR", "QMS", "ISO 13485", "21 CFR Part 820") and `CONTROLLED_TRANSLATIONS` (object mapping Korean terms to canonical English translations: "임상시험" → "clinical investigation", etc.). `buildSystemPrompt(locale)` SHALL inject these into the LLM system prompt to enforce consistency.
**근거:** regula-i18n 스킬 L180–201.
**검증 방법:** Unit test: `UNTRANSLATABLE` contains all listed terms. LLM eval spot-check: en response to "510(k) 절차" contains literal "510(k)" without translation (verified in Phase 6 eval, Phase 5 smoke via snapshot test).

#### REQ-ENTERPRISE-054 (Ubiquitous)
**요구사항:** The root `app/layout.tsx` `<html lang>` attribute SHALL be dynamically bound to the resolved locale. For SSR, the layout reads the user's `users.locale` (authenticated) or `'ko'` (unauthenticated default) and renders `<html lang={locale}>`. For client-side locale changes, REQ-ENTERPRISE-049 updates `document.documentElement.lang`.
**근거:** regula-i18n 스킬 L222 `<html lang={locale}>` 동적 업데이트 + handoff §14 Accessibility screen reader requirement.
**검증 방법:** `curl /` as ko user → HTML `<html lang="ko">`. Click LocaleToggle → inspect element shows `<html lang="en">`.

#### REQ-ENTERPRISE-055 (Unwanted)
**요구사항:** The codebase SHALL NOT contain hardcoded Korean or English UI strings outside of `lib/i18n/dictionaries/*.ts` and user-facing error messages from `lib/errors/`. Exceptions (component-local labels that remain in a single language) require `/* i18n-ignore: <justification> */` comment. A `scripts/qa/i18n-hardcoded.ts` grep tool detects Korean unicode block (가–힣) and common English sentences (regex `/^[A-Z][a-z]+ [a-z]+\.?$/` heuristic) in `components/**/*.tsx` and `app/**/*.tsx`.
**근거:** research.md 긴장 4 "전량 추출" + regula-i18n 스킬 dictionary single source.
**검증 방법:** `pnpm i18n:hardcoded-check` reports violations. Zero violations on Phase 5 completion.

---

### Group F: 접근성 (WCAG 2.1 AA) (REQ-ENTERPRISE-056 ~ REQ-ENTERPRISE-065)

자동화 가능 항목은 CI gate, 수동 샘플링은 체크리스트. "WCAG 2.1 AA 완전 준수" 주장 대신 "감사 기반 컴플라이언스 상태"로 표현.

#### REQ-ENTERPRISE-056 (Ubiquitous)
**요구사항:** The system SHALL install `@axe-core/playwright` (for E2E) AND `vitest-axe` (for component tests). CI workflow SHALL include `pnpm test:a11y` step that runs axe-core against all core pages: `/` (Home), `/chat`, `/chat/<fixture-id>` (with answer rendered), `/history`, `/templates`, `/knowledge`, `/updates`, `/dashboard`, `/expert-review`, `/login`. Target: **0 critical/serious violations** per page.
**근거:** handoff §17 "Axe-core in Playwright | 0 violations on core pages".
**검증 방법:** `pnpm test:a11y` green on CI. Introducing missing alt text on an image → CI red.

#### REQ-ENTERPRISE-057 (Ubiquitous)
**요구사항:** All interactive elements (buttons, links, inputs, selects, toggles, custom widgets) SHALL render a visible focus ring when focused via keyboard. The focus ring uses `outline: 3px solid var(--color-brand-500)` with `outline-offset: 2px`, applied via `:focus-visible` (not `:focus`) to avoid mouse-click rings. Dark mode uses the same brand-500 token, verified against dark background contrast.
**근거:** handoff §14 "visible focus ring (brand-500 3px --ring-focus)".
**검증 방법:** Playwright keyboard navigation: Tab through Home page interactive elements → screenshot-based check for visible focus ring on each. Dark mode equivalent test.

#### REQ-ENTERPRISE-058 (Ubiquitous)
**요구사항:** All citation `<sup>` elements (from CHAT-001) SHALL render with `role="button"`, `aria-label={t.citations.aria(n, title)}` (from dictionary), `tabindex={0}`, AND respond to both Enter and Space keys to open DocViewer (same behavior as mouse click).
**근거:** handoff §14 "Citation `<sup>` → aria-label" + regula-i18n 스킬 L107.
**검증 방법:** RTL test: render answer with 3 citations → Tab focuses first citation → Enter opens DocViewer. Axe-core reports no violations on citation elements.

#### REQ-ENTERPRISE-059 (Ubiquitous)
**요구사항:** The confidence badge component SHALL render `aria-label={t.a11y.confidenceBadge(level, scorePercent)}` (e.g., "Confidence: High, 87 percent"). The confidence level text itself SHALL also be readable (not icon-only).
**근거:** handoff §14 "Confidence badge → aria-label".
**검증 방법:** Storybook a11y addon 0 violations. axe-core via vitest-axe passes.

#### REQ-ENTERPRISE-060 (Ubiquitous)
**요구사항:** The streaming answer UI SHALL wrap the live region in `<div aria-live="polite" aria-atomic="false">` such that screen readers announce significant milestones (e.g., "분석 완료", "답변 생성 중", "전문가 검토 필요") without announcing every prose token. Token-by-token announcements would overwhelm screen reader users.
**근거:** handoff §14 "Streaming — announce milestones via aria-live=polite region".
**검증 방법:** Manual test with NVDA or VoiceOver (QA checklist item). Automated: RTL renders aria-live region, milestones get announced (observable via mutation observer in test).

#### REQ-ENTERPRISE-061 (Ubiquitous)
**요구사항:** All animations defined in `styles/tokens.css` AND component-level transitions SHALL be wrapped in `@media (prefers-reduced-motion: reduce)` blocks that disable or significantly shorten motion. Specifically: trace step fade+translate, message entry, thinking dots, hover elevation transitions. Usage pattern: `motion-safe:transition-all` with Tailwind or explicit media query.
**근거:** handoff §14 + §9.8 "All transitions respect prefers-reduced-motion".
**검증 방법:** Playwright with `Emulate CSS media prefers-reduced-motion: reduce` — trace steps render instantly (no animation). Manual verify via OS setting.

#### REQ-ENTERPRISE-062 (Ubiquitous)
**요구사항:** All form inputs across the app SHALL have associated `<label>` (or `aria-label`), `<div id="x-desc">` description, AND `<div id="x-err">` error message, wired via `aria-describedby="x-desc x-err"`. The Composer input, profile edit form, project create form, and ingest upload form are covered at minimum.
**근거:** handoff §14 "Forms: label + description + error all wired with aria-describedby".
**검증 방법:** axe-core reports no form violations. Manual RTL: query `getByLabelText('규제 질문을 입력하세요')` finds Composer input.

#### REQ-ENTERPRISE-063 (Ubiquitous)
**요구사항:** The system SHALL provide `components/shared/SkipToContent.tsx` rendering an `<a href="#main">{t.a11y.skipToMain}</a>` link that is visually hidden until focused, enabling keyboard users to skip sidebar navigation. The link is the first focusable element in `app/(app)/layout.tsx`.
**근거:** WCAG 2.1 SC 2.4.1 Bypass Blocks.
**검증 방법:** Playwright: Tab once on `/` → focus lands on SkipToContent link, visible. Enter → focus moves to `<main id="main">`.

#### REQ-ENTERPRISE-064 (Ubiquitous)
**요구사항:** All `:root` semantic color pairs used for text-on-background SHALL satisfy WCAG AA contrast ratio 4.5:1 for normal text and 3:1 for large text (≥18pt or 14pt bold). The dark mode variants in `[data-theme="dark"]` SHALL also satisfy the same ratios. Pairs verified: `ink-700 on surface`, `ink-600 on surface-subtle`, `white on brand-800`, `brand-800 on brand-100`, `amber-700 on amber-50`, equivalent dark-mode pairs.
**근거:** handoff §14 "Color contrast: verified in both themes" + §6.
**검증 방법:** `scripts/qa/contrast-check.ts` uses `wcag-contrast` library to compute pairs from `styles/tokens.css` — CI gate ensures all designated pairs meet threshold. Manual spot-check in Chrome DevTools accessibility panel for dynamic combinations.

#### REQ-ENTERPRISE-065 (Optional)
**요구사항:** WHERE Storybook is available, the system SHALL install `@storybook/addon-a11y` and enable per-story axe checks. This is a secondary gate supplementing REQ-ENTERPRISE-056's CI gate, caught during component development before merge.
**근거:** handoff §17 + accessibility maintainer workflow.
**검증 방법:** `pnpm storybook` → a11y panel visible. Introducing bad color contrast in a story → panel flags.

---

### Group G: 관측성 (REQ-ENTERPRISE-066 ~ REQ-ENTERPRISE-073)

Sentry(error) + PostHog(product analytics) + Langfuse(LLM trace) + Vercel Analytics(Web Vitals). audit_logs와 **엄격 분리** (REQ-ENTERPRISE-038 참조).

#### REQ-ENTERPRISE-066 (Ubiquitous)
**요구사항:** The system SHALL install `@sentry/nextjs` and configure `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` with DSN from `process.env.SENTRY_DSN`, release from `process.env.SENTRY_RELEASE`, and environment `process.env.NODE_ENV`. Source maps SHALL be uploaded on production build via `@sentry/webpack-plugin` or Next.js built-in integration.
**근거:** handoff §18 "Sentry + Langfuse dashboard in ops chat; alert on error rate".
**검증 방법:** `pnpm build` uploads sourcemaps. Throwing `new Error('test')` in a client component → Sentry dashboard shows event with stack trace.

#### REQ-ENTERPRISE-067 (Ubiquitous)
**요구사항:** The system SHALL install `posthog-js` and configure `lib/analytics/posthog.ts` to initialize with `process.env.NEXT_PUBLIC_POSTHOG_KEY`, API host `process.env.NEXT_PUBLIC_POSTHOG_HOST` (defaulting to EU region `https://eu.i.posthog.com` for EU data residency), `capture_pageview: true`, `persistence: 'memory'` (no cookies for privacy-first baseline), AND `disable_session_recording: true` (Post-launch decision).
**근거:** handoff §18 + Technical Decision 5 (PostHog privacy-first, EU region).
**검증 방법:** PostHog init call in `app/providers.tsx`. Network tab: `eu.i.posthog.com` requests only. No session replay calls.

#### REQ-ENTERPRISE-068 (Ubiquitous)
**요구사항:** The system SHALL install `langfuse` and configure `lib/ai/langfuse.ts` to initialize with `process.env.LANGFUSE_PUBLIC_KEY` and `process.env.LANGFUSE_SECRET_KEY`. Every LLM call in `lib/ai/consult.ts` SHALL be wrapped in a Langfuse `trace` with nested `generation` spans for retrieval, generation, and citation post-processing phases. Trace metadata SHALL include `conversationId` and `messageId` but NOT question/answer text (PII-free observability).
**근거:** handoff §108 LLM trace + §18 "Langfuse dashboard" + REQ-ENTERPRISE-038 separation principle.
**검증 방법:** Submit consult → Langfuse dashboard shows trace with 3 generation spans. Trace metadata inspected: no question/answer text present.

#### REQ-ENTERPRISE-069 (Ubiquitous)
**요구사항:** The system SHALL install `@vercel/analytics` and add `<Analytics />` to `app/layout.tsx`. This captures Core Web Vitals (LCP, INP, CLS) natively via Next.js instrumentation.
**근거:** handoff §15 Performance targets + §18 Monitoring.
**검증 방법:** Production deployment → Vercel Analytics dashboard shows real user metrics within 24h.

#### REQ-ENTERPRISE-070 (Unwanted)
**요구사항:** The system SHALL NOT send these data categories to any observability vendor (Sentry, PostHog, Langfuse, Vercel Analytics): (1) full question text, (2) full answer prose text, (3) user email or name, (4) phone/SSN/DOB, (5) API keys or secrets, (6) audit_logs rows. Sentry user context is limited to `{ id: userId }`. PostHog identify uses `userId` only. Langfuse trace metadata whitelist: `conversationId`, `messageId`, `projectId`, `model`, `tokenUsage`, `latencyMs`, `confidenceScore`.
**근거:** regula-audit-compliance 스킬 + handoff §16 data minimization + Technical Decision 5.
**검증 방법:** Static grep: `Sentry.setUser(` call sites do NOT include email/name. PostHog `identify` / `capture` call sites inspected for PII. Manual QA: trigger error → Sentry event does not leak question body.

#### REQ-ENTERPRISE-071 (Ubiquitous)
**요구사항:** The `.env.example` file SHALL be updated to include all observability environment variables: `SENTRY_DSN`, `SENTRY_RELEASE`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, with inline comments explaining purpose and EU region guidance. `lib/env.ts` (FOUNDATION-001) SHALL be extended to validate these via Zod with appropriate optional/required flags (required in production, optional in local dev).
**근거:** FOUNDATION-001 REQ-FND-010 env validation pattern + handoff §18.
**검증 방법:** `pnpm dev` without SENTRY_DSN → warning but starts. `NODE_ENV=production pnpm start` without SENTRY_DSN → fail-fast.

#### REQ-ENTERPRISE-072 (Ubiquitous)
**요구사항:** The `lib/audit.ts` module SHALL NOT import from `lib/analytics/posthog.ts`, `@sentry/nextjs`, `langfuse`, or `@vercel/analytics`. Conversely, observability modules SHALL NOT import from `lib/audit.ts` or `lib/db/queries/audit.ts`. This module-level isolation is enforced statically by `scripts/qa/module-boundaries.ts`.
**근거:** regula-audit-compliance 스킬 L16 observability와 audit 분리 원칙.
**검증 방법:** Import graph analysis: no cycles between `lib/audit.ts` and observability modules. CI gate.

#### REQ-ENTERPRISE-073 (State-Driven)
**요구사항:** IF `NODE_ENV !== 'production'`, THEN Sentry sample rate SHALL be 1.0 (all events) AND PostHog `__PREVIEW_MODE__` flag SHALL disable user identify calls. IF `NODE_ENV === 'production'`, THEN Sentry `tracesSampleRate` SHALL be `0.1` (10% of transactions) AND PostHog identify is enabled. These thresholds are revisited in Phase 6 based on production traffic data.
**근거:** Technical Decision 5 budget management + handoff §18 "alert on error rate, LLM cost anomaly".
**검증 방법:** Inspect `sentry.client.config.ts` for conditional sample rate. Dev environment: 100% events. Prod staging: 10%.

---

## 검증 계획 (Acceptance Criteria)

본 SPEC의 완료는 다음 자동화된 게이트 + 수동 체크리스트 통과로 판정한다.

### 자동화 CI Gates (모두 pass 필수)

| Gate | 명령어 | 성공 기준 |
|---|---|---|
| TypeScript | `pnpm tsc --noEmit` | 0 errors |
| Biome lint | `pnpm lint` | 0 errors/warnings |
| Unit tests | `pnpm test:unit` | 100% pass |
| Integration tests | `pnpm test:int` | 100% pass |
| Audit completeness | `pnpm audit:check` | 0 violations (REQ-ENTERPRISE-032/033) |
| RBAC coverage | `pnpm rbac:check` | All handlers wrapped (REQ-ENTERPRISE-021/024) |
| i18n completeness | `pnpm i18n:check` | ko keys == en keys (REQ-ENTERPRISE-048) |
| i18n hardcoded | `pnpm i18n:hardcoded-check` | 0 violations (REQ-ENTERPRISE-055) |
| Tokens symmetry | `pnpm tokens:check` | dark block ⊆ root (REQ-ENTERPRISE-045) |
| Module boundaries | `pnpm modules:check` | audit ↔ observability isolation (REQ-ENTERPRISE-072) |
| Contrast check | `pnpm contrast:check` | WCAG AA ratios (REQ-ENTERPRISE-064) |
| Accessibility (axe-core) | `pnpm test:a11y` | 0 critical/serious (REQ-ENTERPRISE-056) |
| Build | `pnpm build` | succeeds, sourcemaps uploaded |

### 수동 QA 체크리스트 (regula-compliance-qa 책임)

- [ ] Expert review manual flag button (Topbar) 동작 확인 + 토스트 표시
- [ ] Expert review auto-flag E2E: forced low confidence → queue entry + callout + toast
- [ ] Expert review queue page: admin/ra-lead 접근 가능, ra-member/viewer 403
- [ ] RBAC: 4개 role × 주요 Route Handler 접근 매트릭스 샘플 10건 수동 확인
- [ ] audit_logs: 50+ `/api/ra/*` 요청 실행 후 `audit_logs.action` 분포 샘플 검증
- [ ] audit_logs meta PII-free: 랜덤 샘플 100 rows → 금지 키 부재 확인
- [ ] Dark mode toggle: Home → Chat → Dashboard 전환 시 serif 타이포 유지 (시각 확인)
- [ ] Dark mode FOUT: localStorage=dark로 사전 설정 후 hard reload → flash 없음
- [ ] Locale toggle: 대화 중 전환 → URL/대화 prose 유지, neue 질문은 새 locale로 LLM 호출
- [ ] Screen reader: NVDA/VoiceOver로 Home → Chat streaming → citation 클릭 플로우 완주
- [ ] Keyboard-only navigation: Tab/Shift+Tab/Enter/Esc/Space 전체 경로 동작
- [ ] Sentry: 의도적 error 발생 → 대시보드 확인
- [ ] PostHog: 기본 pageview 이벤트 수신 확인 (EU region only)
- [ ] Langfuse: consult 1회 후 trace 표시, metadata PII-free 확인
- [ ] Vercel Analytics: production preview에서 Web Vitals 값 수신

### Phase 5 완료 조건

1. **자동화 13개 gate 전부 green**
2. **수동 QA 14개 체크 전부 완료 + regula-compliance-qa 서명**
3. **73개 REQ-ENTERPRISE 전부 traceable** (`scripts/qa/req-traceability.ts`가 각 REQ ID에 대해 구현 코드/테스트 위치 매핑 출력)
4. **FOUNDATION-001 / CHAT-001 / STRUCTURED-001 / BREADTH-001의 기존 회귀 테스트 green 유지** (특히 FOUNDATION `noindex` 정책, Serif 디시플린, audit trigger append-only)

---

## 위험 및 완화 (Risks and Mitigations)

| # | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | `audit_logs.action` pgEnum 확장이 기존 행에 영향 | Medium | Postgres `ALTER TYPE ... ADD VALUE` 사용, 기존 행 변경 없음, 마이그레이션 `BEGIN; ALTER TYPE ... ADD VALUE ...; COMMIT;` dry-run 후 적용 |
| R2 | RBAC 도입이 Phase 4 BREADTH Route Handler 전부 수정 → 회귀 위험 | **Medium (v0.2.0 C2 downgrade)** | BREADTH v0.2.0 REQ-BREADTH-058이 Phase 4부터 minimum org-scope 필터를 강제하므로, Phase 5는 "no guard → full guard" 전환이 아니라 "minimum filter → role+project guard upgrade"의 점진적 강화가 된다. withPermission 래핑 PR을 handler당 분리, 각 PR에 해당 route E2E 포함. Phase 4 기존 테스트 돌려 회귀 detect. minimum filter(user.orgId)는 defense-in-depth로 유지 |
| R3 | 접근성 감사 미완료 상태로 Phase 6 진행 시 rollback 복잡 | High | Phase 5 완료 조건에 `pnpm test:a11y` 0 violation 포함. Phase 6 진입 전 regula-compliance-qa 게이트 |
| R4 | i18n 도입이 기존 하드코딩 문자열 전량 추출 요구 → 누락 가능 | Medium | `scripts/qa/i18n-hardcoded.ts`가 CI에서 탐지. 한국어 unicode block 정규식 기반 grep. 점진적 추출 시 PR별 커버리지 확인 |
| R5 | next-intl dictionary TS 타이핑이 Server Component SSR과 호환 문제 | Medium | 공식 문서 App Router 예제 따르기. `getTranslations` server-side helper 사용. 문제 발생 시 `react-intl` 대체 후보 (Technical Decision 1 재평가 trigger) |
| R6 | Sentry 비용이 예상 초과 | Low | `tracesSampleRate: 0.1` (REQ-ENTERPRISE-073). Phase 6에서 alert threshold 튜닝 시 재조정 |
| R7 | PostHog session replay를 실수로 활성화 → privacy 위반 | High | REQ-ENTERPRISE-067 `disable_session_recording: true` 명시. `scripts/qa/module-boundaries.ts`가 `autocapture` 설정도 검증 |
| R8 | dark mode FOUT inline script가 CSP nonce 위반 | Medium | Next.js 15 inline script에 nonce 자동 주입 (middleware). 테스트로 검증 |
| R9 | Expert review queue polling 5s가 DB 부하 증가 | Low | 인덱스 `expert_reviews(status, assigned_to)` 추가. 초기 사용자 규모에서 문제 없음. Post-launch WebSocket 고려 |
| R10 | 관측성 벤더 3종 키 관리 복잡 | Low | `.env.example` 문서화 + Vercel Secrets로 일원화. Runbook에 키 로테이션 절차 기록 (Phase 6) |

---

## Non-Obvious Constraints 매트릭스 (Phase 5 집중)

CLAUDE.md와 handoff README의 "Non-Obvious Product Constraints" 중 Phase 5가 직접 책임지는 항목:

| # | 제약 | Phase 5 담당 REQ |
|---|---|---|
| 3 | Expert review 자동 플래그 — **제품 안전 게이트** | REQ-ENTERPRISE-001 ~ 015 (Group A 전량) |
| 4 | 21 CFR Part 11 audit_logs append-only + 7년 retention | REQ-ENTERPRISE-028 ~ 038 (Group C 전량) |
| 5 | Serif/sans 타이포 (다크 모드에서도 유지) | REQ-ENTERPRISE-044 |
| 6 | 한/영 first-class, Noto Serif KR + Pretendard | REQ-ENTERPRISE-046 ~ 055 (Group E 전량) |
| 7 | Auth 뒤 noindex 유지 | FOUNDATION-001 REQ-FND-014/018 회귀 — 본 SPEC 신규 페이지(`/expert-review`)도 상속 확인 |

Constraint #3, #4, #6는 Phase 5에서 **최종 완결**된다.

---

## Phase 6 (Quality & Launch) Handoff 포인트

Phase 5 완료 후 Phase 6가 인수받는 자원:

1. **Expert review 워크플로우 완성** → Phase 6 E2E Playwright 커버 (`low confidence → queue → assign → resolve`)
2. **RBAC permission guard 존재** → Phase 6 부하 테스트가 admin/ra-lead/ra-member 이중 페르소나로 실행
3. **audit_logs 완전성 확립** → Phase 6 규제 감사 시뮬레이션 (getAuditTrail 쿼리 샘플 생성 + meta PII-free 검증)
4. **axe-core CI gate 0 violations** → Phase 6 수동 스크린 리더 QA + VPAT 초안 작성
5. **Sentry/PostHog/Langfuse wired** → Phase 6 production release 후 alert threshold 튜닝 + runbook 작성
6. **i18n dictionary 완성** → Phase 6 LLM eval(promptfoo)는 ko/en 각각 별도 회귀 셋 실행

---

## 의존 SPEC 인터페이스 계약 (Dependency Interface Contracts)

본 SPEC은 4개의 선행 Phase에 의존한다. 각 의존이 본 Phase에 제공하는 **구체적 인터페이스**와, 본 Phase가 그 인터페이스를 **어떻게 확장/변경하지 않는지**를 명시한다.

### 의존 1: SPEC-REGULA-FOUNDATION-001 (v0.3.0)

본 SPEC이 **재사용**하는 자원:

| 자원 | 위치 | 재사용 방식 |
|---|---|---|
| `audit_logs` 테이블 + append-only 트리거 | `lib/db/schema.ts` + `migrations/0001_audit_append_only.sql` | 확장하지 않음. `action` enum만 추가 (REQ-ENTERPRISE-028). 트리거 로직 불변 |
| `writeAudit(params)` 헬퍼 | `lib/audit.ts` | 시그니처 불변. `AuditAction` type만 확장 |
| `expert_reviews` 테이블 | `lib/db/schema.ts` | 스키마 불변. PATCH handler 도입은 REQ-ENTERPRISE-003 |
| `users.locale` pgEnum | `lib/db/schema.ts` | 불변. `PATCH /api/ra/profile`이 이 컬럼을 write |
| `users.theme_pref` pgEnum | `lib/db/schema.ts` | 불변. Theme toggle이 이 컬럼을 write |
| `[data-theme="dark"]` CSS 오버라이드 블록 | `styles/tokens.css` | 불변. Runtime toggle script만 REQ-ENTERPRISE-041에서 추가 |
| `<html lang="ko">` 기본값 | `app/layout.tsx` | 동적 바인딩으로 변경 (REQ-ENTERPRISE-054) |
| `noindex` 전역 정책 | `app/(app)/layout.tsx` metadata | 불변. 본 SPEC 신규 페이지(`/expert-review`)도 상속 |
| `org_members` · `project_members` 테이블 | `lib/db/schema.ts` | 불변. `lib/auth/acl.ts`가 read-only 조회 |
| `lib/env.ts` Zod fail-fast | `lib/env.ts` | 스키마 확장만 (REQ-ENTERPRISE-071) |

본 SPEC이 **확장하는** 스키마 항목:

| 항목 | 변경 |
|---|---|
| `users.role` | text → pgEnum `user_role` 전환 (REQ-ENTERPRISE-016). 기존 `'member'` 값은 `'ra-member'`로 데이터 마이그레이션 |
| `users.notification_pref` | 신규 컬럼 추가 (REQ-ENTERPRISE-027). Post-launch 이메일 설정 선행 확보 |
| `audit_logs.action` enum | 추가 값 **13개** (REQ-ENTERPRISE-028 v0.2.0 C3 — checklist.toggle, consult.expert_review_auto_flag, project.switch 포함) |
| `expert_reviews` 인덱스 | `(status, assigned_to)` 복합 인덱스 추가 (R9 위험 완화) |

### 의존 2: SPEC-REGULA-CHAT-001

본 SPEC이 **재사용**하는 자원:

| 자원 | 역할 |
|---|---|
| `/api/ra/consult` SSE 파이프라인 | REQ-ENTERPRISE-009가 이 파이프라인 Phase C에 `expert_review_required` event 발행 로직 삽입 |
| `confidence.score` 계산 | REQ-ENTERPRISE-007/009의 자동 게이팅 입력값 |
| `useStreamingAnswer` 훅 | REQ-ENTERPRISE-012가 `expert_review_required` case 추가 |
| Composer 컴포넌트 | REQ-ENTERPRISE-051이 `locale` 필드 전송 추가 |
| `messages.expert_review_required` 컬럼 | REQ-ENTERPRISE-010이 auto-flag 시 set |

변경 금지:
- SSE event 순서 (trace → prose → structured → expert_review_required → done)
- Confidence 계산 알고리즘 자체
- Prose 스트리밍 청크 포맷

### 의존 3: SPEC-REGULA-STRUCTURED-001

본 SPEC이 **재사용**하는 자원:

| 자원 | 역할 |
|---|---|
| `Callout` 컴포넌트 (`components/shared/Callout.tsx`) | REQ-ENTERPRISE-011의 `ExpertReviewCallout`이 `variant="expert"` prop으로 사용 |
| 구조화 블록 JSON schema | 불변. `expertReviewRequired` 필드만 추가 |
| DocViewer modal | 접근성 REQ-ENTERPRISE-058이 citation 키보드 조작 확장 |

### 의존 4: SPEC-REGULA-BREADTH-001

본 SPEC이 **확장**하는 영역:

| 자원 | 변경 |
|---|---|
| Dashboard 페이지 | expert review 메트릭 카드 추가 권장 (Optional). 본 SPEC에서는 REQ로 강제하지 않음 — Phase 4의 stat card 레이아웃 활용 |
| `/api/ra/dashboard` handler | REQ-ENTERPRISE-021이 `withPermission('dashboard.view')` 래핑 |
| `/api/ra/conversations/*` · `/projects/*` · `/sources/*` · `/templates/*` · `/updates/*` handlers | 전부 REQ-ENTERPRISE-021에서 permission guard 래핑 |
| History 페이지 RLS | 애플리케이션 레이어 `isOrgMember` 체크로 enforce (REQ-ENTERPRISE-018) |

---

## 구현 지침 (Implementation Hints — 참고용)

본 섹션은 EARS REQ를 만족하는 **하나의 가능한 구현 경로**를 설명한다. 최종 구현자(manager-ddd 또는 manager-tdd)는 본 지침을 참고하되, REQ 자체는 구현 상세를 잠그지 않는다.

### Phase 5 구현 순서 (권장)

| 순번 | 단계 | 주요 산출물 | 근거 REQ |
|---|---|---|---|
| 1 | Migrations 선행 | `user_role` pgEnum, `audit_logs.action` enum 확장, `users.notification_pref` 컬럼, `expert_reviews` 인덱스 | REQ-ENTERPRISE-016, 027, 028 |
| 2 | RBAC 인프라 | `lib/auth/rbac.ts`, `lib/auth/acl.ts`, `lib/auth/with-permission.ts`, `lib/auth/permissions.ts` (매트릭스) | REQ-ENTERPRISE-017 ~ 020 |
| 3 | 기존 Route Handler 래핑 | CHAT/STRUCTURED/BREADTH의 모든 handler에 `withPermission` 추가, E2E 회귀 | REQ-ENTERPRISE-021 ~ 024 |
| 4 | Audit 완전성 | Auth.js callback writeAudit, `scripts/qa/audit-completeness.ts`, CI gate 연결 | REQ-ENTERPRISE-028 ~ 038 |
| 5 | Expert Review 파이프라인 | `lib/ai/policy-keywords.ts`, `lib/ai/expert-review-gating.ts`, `consult.ts` Phase C 통합 | REQ-ENTERPRISE-007 ~ 010 |
| 6 | Expert Review API | `/api/ra/expert-review` POST, `/api/ra/expert-review/[id]` GET/PATCH | REQ-ENTERPRISE-001 ~ 006 |
| 7 | Expert Review UI | Queue page, ExpertReviewCallout, Topbar manual flag button, Sidebar 조건부 링크 | REQ-ENTERPRISE-011 ~ 015, 025, 026 |
| 8 | Dark Mode Runtime | FOUT script, ThemeToggle, Zustand 통합, `PATCH /api/ra/profile` theme_pref | REQ-ENTERPRISE-039 ~ 043 |
| 9 | i18n Runtime | next-intl install, dictionaries, LocaleToggle, regulatory glossary, `consult.ts` locale branching | REQ-ENTERPRISE-046 ~ 055 |
| 10 | Accessibility | axe-core install, SkipToContent, focus ring audit, ARIA label pass, contrast check script | REQ-ENTERPRISE-056 ~ 065 |
| 11 | Observability | Sentry/PostHog/Langfuse/Vercel Analytics wiring, `.env.example`, module boundary check | REQ-ENTERPRISE-066 ~ 073 |
| 12 | Static analysis CI | audit/rbac/i18n/tokens/modules/contrast 전부 CI에 통합 | Group C/E/F 전반 |
| 13 | Final regression | FOUNDATION-001 회귀 테스트 전체 돌림, visual regression (light/dark × ko/en) | 완료 조건 |

순서 이유:
- 1-3 (RBAC + Audit 인프라)를 먼저 확립해야 4-7 (Expert Review)이 올바른 권한 컨텍스트에서 테스트 가능
- 8-9 (UI runtime)는 기존 Route Handler가 인증/권한 context 제공한 후에 안전
- 10 (a11y)은 UI 변경이 모두 끝난 후 일괄 감사가 효율적
- 11 (observability)은 마지막에 추가해야 기존 테스트 환경 오염 최소화

### 주요 구현 세부 (대표 예시)

#### `lib/auth/with-permission.ts` 시그니처 (REQ-ENTERPRISE-019)

```ts
import { auth } from '@/lib/auth';
import { hasRole } from './rbac';
import { isOrgMember, isProjectMember } from './acl';
import { PERMISSIONS, type PermissionAction } from './permissions';
import { writeAudit } from '@/lib/audit';

export function withPermission<Ctx extends { params: Record<string, string> }>(
  action: PermissionAction
) {
  return function wrap(
    handler: (req: Request, ctx: Ctx, session: Session) => Promise<Response>
  ) {
    return async (req: Request, ctx: Ctx): Promise<Response> => {
      const session = await auth();
      if (!session?.user) return new Response('Unauthorized', { status: 401 });

      const spec = PERMISSIONS[action];
      if (!hasRole(session.user.role, spec.minRole)) {
        await writeAudit({
          actor: session.user.id,
          action: 'rbac.permission_deny',
          resourceType: spec.resourceType,
          resourceId: ctx.params?.id,
          meta: { required: action, actualRole: session.user.role, reason: 'role' },
        });
        return Response.json({ error: 'permission_denied', required: action, actual_role: session.user.role }, { status: 403 });
      }

      // Org/project scope enforcement
      if (spec.scope === 'org') {
        const orgId = await resolveOrgId(ctx, req);  // extract from params or body
        if (orgId && !(await isOrgMember(session.user.id, orgId))) {
          await writeAudit({
            actor: session.user.id,
            action: 'rbac.permission_deny',
            resourceType: spec.resourceType,
            resourceId: orgId,
            meta: { reason: 'not_a_member', scope: 'org' },
          });
          return Response.json({ error: 'not_a_member', resource_type: 'organization', resource_id: orgId }, { status: 403 });
        }
      }
      // (project scope similar)

      return handler(req, ctx, session);
    };
  };
}
```

#### `lib/ai/expert-review-gating.ts` 시그니처 (REQ-ENTERPRISE-007)

```ts
import { detectPolicyKeyword } from './policy-keywords';

export interface ConfidenceResult {
  level: 'low' | 'medium' | 'high';
  score: number;
}

export function shouldAutoFlag(
  confidence: ConfidenceResult,
  question: string,
  prose: string
): { flag: true; reason: string } | { flag: false; reason: null } {
  if (confidence.score < 0.7) {
    return { flag: true, reason: `confidence ${confidence.score.toFixed(2)} < 0.7` };
  }
  const kw = detectPolicyKeyword(question, prose);
  if (kw) {
    return { flag: true, reason: `policy keyword: ${kw}` };
  }
  return { flag: false, reason: null };
}
```

#### FOUT 방지 inline script (REQ-ENTERPRISE-041)

```tsx
// app/layout.tsx <head> 내부
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var saved = localStorage.getItem('regula-theme');
          var resolved;
          if (saved === 'light' || saved === 'dark') {
            resolved = saved;
          } else {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          document.documentElement.setAttribute('data-theme', resolved);
        } catch (e) { /* localStorage 접근 불가 환경: 기본 light */ }
      })();
    `,
  }}
/>
```

CSP nonce 주입은 Next.js 15 middleware에서 자동 처리 (`res.headers.set('Content-Security-Policy', ...)`에 `'nonce-xxx'` 포함).

### 마이그레이션 스크립트 전략 (REQ-ENTERPRISE-016)

`users.role` text → pgEnum 전환은 데이터 손실 가능성이 있어 분리 마이그레이션 권장.

```sql
-- migrations/00XX_rbac_role_enum.sql
BEGIN;

-- 1. 새 enum type 생성
CREATE TYPE user_role AS ENUM ('admin', 'ra-lead', 'ra-member', 'viewer');

-- 2. 기존 'member' 값을 'ra-member'로 migration
UPDATE users SET role = 'ra-member' WHERE role = 'member' OR role = '' OR role IS NULL;

-- 3. 나머지 알 수 없는 값은 에러 대신 default로 강제 (안전장치)
UPDATE users SET role = 'ra-member'
WHERE role NOT IN ('admin', 'ra-lead', 'ra-member', 'viewer');

-- 4. 컬럼 타입 변환
ALTER TABLE users
  ALTER COLUMN role TYPE user_role
    USING role::user_role,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'ra-member';

COMMIT;
```

Rollback 절차는 Phase 6의 down script 준비에서 다룬다.

---

## 테스트 시나리오 상세 (대표)

본 섹션은 주요 REQ의 **실행 가능한 테스트 시나리오**를 Given-When-Then 패턴으로 나열한다. 전체는 `acceptance.md`(Phase 6 작성 예정)에서 확장.

### 시나리오 1: 자동 expert review 플래그 (Group A)

**Given:** 사용자 user-1 (role: ra-member)이 Org-A 소속이며 `/chat`에서 새 상담 시작
**When:** "판매 허가 없이 수출 가능한 의료기기가 있는가?" 질문 제출 (정책 키워드 포함)
**Then:**
- `/api/ra/consult` SSE 스트림에 `{ type: 'expert_review_required', reason: 'policy keyword: 판매 허가 없이' }` event 포함
- `expert_reviews` 테이블에 row 추가: `requested_by = SYSTEM_USER_UUID`, `status = 'pending'`, `reason`에 키워드 포함
- `messages.expert_review_required = true`
- `audit_logs`에 `action = 'consult.expert_review_auto_flag'` row
- 클라이언트 toast "전문가 검토 큐에 추가되었습니다" 표시
- `ExpertReviewCallout` 컴포넌트 DOM에 렌더링

### 시나리오 2: RBAC permission deny (Group B)

**Given:** 사용자 user-2 (role: viewer)가 로그인 상태
**When:** `POST /api/ra/expert-review` 호출 (`conversationId: some-uuid, reason: 'user_manual'`)
**Then:**
- 응답 403 `{ error: 'permission_denied', required: 'expertReview.create', actual_role: 'viewer' }`
- `audit_logs`에 `action = 'rbac.permission_deny'` row (`meta.required = 'expertReview.create'`)
- 요청에 따른 부작용 없음 (expert_reviews에 row 삽입되지 않음)

### 시나리오 3: Audit writeAudit 실패 전파 (Group C)

**Given:** DB에 `audit_logs` 트리거 함수가 일시적으로 실패 (테스트 mock)
**When:** 사용자가 `POST /api/ra/projects` 호출 (valid body)
**Then:**
- 응답 500 `{ error: 'audit_write_failed' }`
- `projects` 테이블에 row 추가되지 않음 (트랜잭션 롤백)
- 로그에 writeAudit failure 기록 (Sentry에는 error로 보고, audit_logs에는 아님)

### 시나리오 4: 다크 모드 런타임 전환 (Group D)

**Given:** 사용자 user-3 (theme_pref: 'light') 로그인, 현재 light mode 렌더링
**When:** Topbar ThemeToggle 클릭 → "dark" 선택
**Then:**
- `document.documentElement.getAttribute('data-theme') === 'dark'`
- localStorage `regula-theme === 'dark'`
- 500ms 후 `PATCH /api/ra/profile` 요청 발행 (`theme_pref: 'dark'`)
- `users.theme_pref` 업데이트
- `audit_logs`에 `action = 'profile.theme_update'` row (`meta: { from: 'light', to: 'dark' }`)
- Serif 타이포 H1 및 stat 값 렌더링 유지 (`font-family: var(--font-serif)`) — 시각 회귀 스크린샷으로 검증

### 시나리오 5: Locale 전환 중 대화 보존 (Group E)

**Given:** 사용자 user-4 (locale: 'ko'), `/chat/abc123`에서 질문 답변 스트리밍 중 (prose 50% 렌더링 완료)
**When:** Topbar LocaleToggle 클릭 → "English" 선택
**Then:**
- URL `/chat/abc123` 유지 (페이지 새로고침 없음)
- 진행 중인 SSE 스트림 계속 진행 (abort되지 않음)
- 기존 prose (한국어)는 한국어 그대로 유지
- Sidebar/Topbar 텍스트가 영어로 즉시 전환
- `<html lang="en">` 업데이트
- 이후 Composer에서 질문 제출하면 `ConsultRequest.locale === 'en'`, LLM 시스템 프롬프트가 영어 브랜치
- `PATCH /api/ra/profile` → `users.locale = 'en'`

### 시나리오 6: axe-core 0 critical violation (Group F)

**Given:** 프로덕션 빌드 배포 preview URL
**When:** `pnpm test:a11y` 실행 — axe-core가 10개 core 페이지 크롤링
**Then:**
- 각 페이지에 대한 report: critical = 0, serious = 0
- Minor/moderate warning은 허용되나 issue로 추적
- CI 스테이지 green, 머지 가능

### 시나리오 7: Observability 이중 기록 방지 (Group G)

**Given:** 사용자 user-5가 어떤 Route Handler에서 예외 발생
**When:** 핸들러 내부에서 `Sentry.captureException(err)` 호출
**Then:**
- Sentry 대시보드에 event 기록 (user context: `{ id: userId }`만, email 부재)
- `audit_logs`에 `consult.error` (또는 해당 action) row는 이미 기록됨 (에러 경로도 writeAudit 필수)
- Sentry breadcrumb에 question/answer 본문 부재
- PostHog `capture`는 이 에러에 대해 호출되지 않음 (에러는 Sentry 단독 도메인)

### 시나리오 8: Expert review status 머신 역전이 거부 (Group A)

**Given:** `expert_reviews` row (status: 'resolved', id: er-1)
**When:** admin 사용자가 `PATCH /api/ra/expert-review/er-1` body `{ status: 'pending' }` 제출
**Then:**
- 응답 409 Conflict `{ error: 'invalid_transition', from: 'resolved', to: 'pending', allowed: [] }`
- row의 status는 'resolved' 그대로 유지
- `audit_logs`에 이 실패 시도 기록 없음 (요청 자체가 거부되었고, transition이 성립하지 않음) — 또는 선택적으로 `rbac.permission_deny`로 기록 (구현자 재량. 본 REQ는 변경이 일어나지 않음을 보장)

### 시나리오 9: FOUT 방지 (Group D)

**Given:** 사용자 브라우저에 localStorage `regula-theme = 'dark'`, OS는 light mode
**When:** hard reload `/` (Ctrl+Shift+R)
**Then:**
- 초기 paint 시점부터 `<html data-theme="dark">` 설정 (inline script 실행 후 body 렌더링)
- 사용자가 light-mode flash를 경험하지 않음 — Playwright 비디오 녹화 프레임 분석으로 검증
- React hydration 완료 후에도 data-theme 유지 (Zustand store가 localStorage에서 동일 값 읽음)

### 시나리오 10: i18n dictionary 키 누락 감지 (Group E)

**Given:** `lib/i18n/dictionaries/ko.ts`에 `chat.newKey: '새 키'` 추가, `en.ts`에 대응 키 부재
**When:** 개발자가 PR 생성 → CI 실행
**Then:**
- `pnpm i18n:check` step에서 exit code 1
- 에러 메시지: `Missing keys in 'en' dictionary: chat.newKey`
- PR merge 블록
- 개발자가 `en.ts`에 `chat.newKey: 'New key'` 추가 → 재실행 시 green

---

## EARS 패턴 분포 (EARS Pattern Distribution)

본 SPEC의 73개 REQ는 다음 5개 EARS 패턴을 사용한다. 각 패턴의 count는 CI 정적 검증(`scripts/qa/ears-lint.ts`)에 의해 자동 집계 가능.

| 패턴 | 개수 | 용도 | 대표 REQ |
|---|---|---|---|
| Ubiquitous (The system SHALL ...) | 48 | 항상 유효한 시스템 속성 — API 존재, 데이터 구조, 타입 정의 | REQ-ENTERPRISE-001 (Expert review POST handler 제공), REQ-ENTERPRISE-016 (pgEnum 정의), REQ-ENTERPRISE-046 (next-intl 설치) |
| Event-Driven (WHEN X THEN Y) | 11 | 이벤트 발생 시 반응 — SSE event, 사용자 액션, callback | REQ-ENTERPRISE-009 (자동 플래그), REQ-ENTERPRISE-029 (login audit), REQ-ENTERPRISE-051 (locale 전송) |
| State-Driven (IF X THEN Y) | 5 | 조건 상태 기반 — 권한 부족, 환경, 트랜잭션 상태 | REQ-ENTERPRISE-004 (status 전이 제약), REQ-ENTERPRISE-022 (role 부족 시 403), REQ-ENTERPRISE-073 (프로덕션 샘플링) |
| Unwanted (SHALL NOT) | 8 | 금지 동작 — 보안, 규정 준수, PII 누설 방지 | REQ-ENTERPRISE-005 (DELETE 금지), REQ-ENTERPRISE-036 (PII 금지), REQ-ENTERPRISE-070 (observability PII 금지) |
| Optional (WHERE X, SHALL Y) | 1 | 조건부 기능 — feature existence 기반 | REQ-ENTERPRISE-015 (queue polling badge) |

### 패턴 선택 근거

- **Ubiquitous 편중(65%)**은 엔터프라이즈 강화의 특성상 "기능이 존재해야 한다"는 진술이 다수임을 반영. 이는 초기 기능 추가 SPEC(CHAT-001 등)과 유사하지만, Phase 5는 기존 기능의 하드닝이므로 "존재 증명" 비중이 상대적으로 높음.
- **Unwanted 8건**은 보안/규제 크리티컬 영역에 집중 — DELETE 금지, 필드 mutation 금지, PII 누설 금지, 관측성 벤더 audit 전송 금지 등. 이는 Phase 5의 본질(하드닝)과 일치.
- **Event-Driven 11건**은 audit 기록, SSE event 발행, theme/locale 변경 hook 등 "트리거 → 부작용" 관계에 사용.
- **State-Driven 5건**은 엔티티 상태 머신(expert review status, transaction 상태)과 환경 조건(NODE_ENV).
- **Optional 1건**은 role 기반 UI 가시성(ra-member에게는 expert review 큐 badge 비표시). Optional 최소화는 SPEC 결정론 제고의 신호.

---

## 자동화 CI Gate 상세 (Automation Gate Details)

각 gate의 실행 방식, 실패 메시지 형식, 우회 불가 여부를 명시한다.

### Gate 1: `pnpm tsc --noEmit`
- **목적**: TypeScript 타입 검증. `AuditAction` enum 확장, dictionary 구조 대칭, permission action 매트릭스 완전성 등 컴파일 단계 오류 차단.
- **실패 예시**: `lib/audit.ts:45:12 - Type '"profile.theme_update"' is not assignable to type 'AuditAction'`.
- **우회**: 불가. 타입 오류는 무조건 해결.

### Gate 2: `pnpm lint` (Biome)
- **목적**: 코드 스타일 + 린트 규칙. FOUNDATION-001의 `noHexColor` 규칙이 Phase 5에서도 유효.
- **실패 예시**: `components/shell/ThemeToggle.tsx:12:20 - Avoid raw hex color literal '#ff0000'; use design token`.
- **우회**: `biome-ignore lint/...: <justification>` 주석. PR 리뷰어 승인 필요.

### Gate 3: `pnpm test:unit`
- **목적**: 단위 테스트 — `shouldAutoFlag`, `detectPolicyKeyword`, `hasRole`, `withPermission` 등.
- **성공 기준**: 100% pass, 각 REQ당 최소 1 assertion.
- **우회**: 불가.

### Gate 4: `pnpm test:int`
- **목적**: 통합 테스트 — Route Handler가 DB + Auth 컨텍스트에서 기대 동작.
- **환경**: Postgres testcontainers + Auth.js mock session.
- **성공 기준**: 100% pass. 특히 시나리오 1-10 중 자동화 가능한 것 전부.

### Gate 5: `pnpm audit:check`
- **목적**: 모든 Write Route Handler에 writeAudit 호출 존재 + PII 누설 키 부재 검증 (REQ-ENTERPRISE-032/033).
- **구현**: ts-morph AST traversal. `app/api/**/route.ts`에서 `export async function (POST|PATCH|DELETE|PUT)` 수집 → body에 `writeAudit(` 참조 여부 확인.
- **실패 예시**: `VIOLATION: app/api/ra/expert-review/route.ts:POST - writeAudit call not found in function body`.
- **우회**: `/* audit-check-ignore: <justification> */` 주석 (REQ-ENTERPRISE-034). PR 리뷰 필수.

### Gate 6: `pnpm rbac:check`
- **목적**: 모든 Route Handler가 `withPermission` 래핑 확인 (REQ-ENTERPRISE-021/024).
- **구현**: AST traversal. export가 `withPermission(...)`로 감싸졌는지 판별. 화이트리스트는 `scripts/qa/rbac-whitelist.json`.
- **실패 예시**: `VIOLATION: app/api/ra/new-handler/route.ts:POST - not wrapped with withPermission() and not in whitelist`.
- **우회**: 화이트리스트 추가 시 PR 설명에 이유 명시 + 리뷰어 승인.

### Gate 7: `pnpm i18n:check`
- **목적**: `ko`와 `en` dictionary의 leaf path 동일성 (REQ-ENTERPRISE-048).
- **구현**: 두 dictionary를 deep flatten하여 경로 집합 비교.
- **실패 예시**: `VIOLATION: Keys present in 'ko' but missing in 'en': ['chat.newFeature', 'expertReview.assignButton']`.
- **우회**: 불가. 키 추가는 양쪽 동시.

### Gate 8: `pnpm i18n:hardcoded-check`
- **목적**: 컴포넌트 파일에 한국어 unicode block 또는 영어 문장 하드코딩 탐지 (REQ-ENTERPRISE-055).
- **구현**: `components/**/*.tsx` 및 `app/**/*.tsx` 대상 regex grep. 한국어는 `/[가-힣]{2,}/`, 영어는 `/^[A-Z][a-z]+(\s+[a-z]+)+\.?$/` 휴리스틱.
- **실패 예시**: `VIOLATION: components/chat/Composer.tsx:23 - hardcoded Korean text '규제 질문을 입력하세요' - move to lib/i18n/dictionaries/ko.ts:chat.placeholder`.
- **우회**: `/* i18n-ignore: <justification> */` 주석.

### Gate 9: `pnpm tokens:check`
- **목적**: `styles/tokens.css`의 dark mode 블록이 :root 블록의 토큰 subset 여부 (REQ-ENTERPRISE-045).
- **구현**: CSS parser로 두 블록 변수명 추출 → subset 비교.
- **실패 예시**: `VIOLATION: [data-theme="dark"] defines '--color-experimental' not present in :root`.

### Gate 10: `pnpm modules:check`
- **목적**: `lib/audit.ts`와 observability 모듈 간 import 경계 (REQ-ENTERPRISE-072).
- **구현**: `eslint-plugin-boundaries` 또는 커스텀 AST grep.

### Gate 11: `pnpm contrast:check`
- **목적**: tokens.css의 designated color pair가 WCAG AA 4.5:1 / 3:1 만족 (REQ-ENTERPRISE-064).
- **구현**: `wcag-contrast` npm 라이브러리. 페어 목록은 `scripts/qa/contrast-pairs.json`.

### Gate 12: `pnpm test:a11y`
- **목적**: axe-core로 core 페이지 0 critical/serious violation (REQ-ENTERPRISE-056).
- **구현**: Playwright + @axe-core/playwright. 각 페이지 fixture URL 방문 후 `checkA11y()`.
- **실패 예시**: `VIOLATION: /chat/[fixture] - button-name (serious) - Button has no accessible text`.

### Gate 13: `pnpm build`
- **목적**: Next.js production build 성공 + Sentry sourcemap 업로드.
- **실패 예시**: 빌드 실패 / Sentry 업로드 실패.

---

## 역할별 담당 에이전트 (Agent Ownership)

| Group | 주 담당 | 검증 담당 |
|---|---|---|
| A (Expert Review) | regula-frontend + regula-backend | regula-compliance-qa |
| B (RBAC) | regula-backend | regula-compliance-qa |
| C (Audit 완전성) | regula-backend | regula-compliance-qa (필수 서명) |
| D (Dark Mode) | regula-frontend + regula-design-system | regula-compliance-qa (visual regression) |
| E (i18n) | regula-frontend + regula-rag-pipeline (LLM locale 분기) | regula-compliance-qa |
| F (접근성) | regula-frontend + regula-design-system | regula-compliance-qa (axe-core + 수동) |
| G (관측성) | regula-backend + regula-architect | regula-compliance-qa (분리 원칙 검증) |

regula-compliance-qa는 **모든 Group에서 검증 필수**이며, 특히 Group C (audit)는 서명 없이 merge 불가.

---

## 변경 이력 (Change History)

| 버전 | 날짜 | 작성자 | 주요 변경 |
|---|---|---|---|
| 0.1.0 | 2026-04-22 | manager-spec | 초기 draft. 73 REQ-ENTERPRISE / 7 groups / 6 technical decisions / 10 risks / 7 test scenarios. FOUNDATION-001 v0.3.0, CHAT-001, STRUCTURED-001, BREADTH-001 의존. |
| 0.2.0 | 2026-04-23 | manager-spec (iteration via cross-spec-audit Critical patch) | Applied C1 (REQ-ENTERPRISE-009 expert_reviews row INSERT 오너십 명확화 — CHAT event 수신 후 Phase 5 전담), C3 (REQ-ENTERPRISE-028 enum 확장 목록에 checklist.toggle/consult.expert_review_auto_flag/project.switch 3개 추가 → 총 13개 Phase 5 신규 값), C6 (audit_logs.action pgEnum 통일 정합 — R1 risk 문구 유지), H7 (누적 inventory 26개 값 선언). R2 risk High→Medium downgrade (BREADTH v0.2.0 REQ-BREADTH-058 minimum filter로 회귀 위험 완화). depends_on을 FOUNDATION v0.4.0+, CHAT/STRUCTURED/BREADTH v0.2.0+로 갱신. 신규 REQ 없음. |

---

## Pending Cross-Audit Findings (v0.2.0)

cross-spec-audit.md(2026-04-22)의 High findings 중 본 iteration에서 해소되지 않고 후속 Wave에서 추적할 항목.

| ID | 요약 | 해당 SPEC | 추적 상태 |
|---|---|---|---|
| H1 | ENTERPRISE "E2E 전체 스위트" defer는 LAUNCH 7 core flows만 커버 | LAUNCH | Wave 4 또는 Phase 6 kickoff에서 LAUNCH E2E 확장 결정 |
| H5 | Project delete 구현 (projects.deleted_at 컬럼 + DELETE endpoint) | 본 SPEC 또는 Post-launch | Phase 5 kickoff 재검토 |
| H6 | Users CRUD endpoint (org member 관리 UI) | 본 SPEC 또는 Post-launch | Phase 5 kickoff 재검토 (RBAC admin 페르소나 요구) |
| M1 | `checklist_completions` 정규화 migration (multi-user 공유) | 본 SPEC 또는 Post-launch | Phase 5 kickoff 재검토 |
| M2 | Regulatory updates impact_analysis LLM 실시간 생성 | 본 SPEC 또는 Post-launch | Inngest crawler 도입 시 결정 |
| M3 | Onboarding DB persist (`users.onboarded_at` 컬럼) | 본 SPEC 또는 Post-launch | Phase 5 migration 포함 여부 결정 |
| M4 | `audit_logs` materialized view | 본 SPEC 또는 Post-launch | production 트래픽 데이터 기반 재평가 |
| M7 | `expert_reviews.message_id` single FK vs Zod `messageIds[]` plural 불일치 | 본 SPEC | Phase 5 kickoff에서 `messageIds[0]` 또는 junction table 결정 |

기타 Medium/Low findings는 Phase 5 kickoff 또는 Post-launch에서 개별 결정.

---

## 결론 및 승인 조건 (Conclusion and Approval)

본 SPEC은 Phase 5 "Enterprise hardening"의 완결을 목표로, Phase 6 "Quality & Launch" 진입 전 다음을 보장한다.

1. **제품 안전 게이트 완성**: 의료기기 규제 도메인의 expert review 자동 게이팅이 프로덕션 수준으로 작동하고, 게이팅 우회가 원천 봉쇄된다.
2. **규제 준수 기반 완성**: 21 CFR Part 11 audit_logs 완전성이 정적 분석 CI gate로 보장되며, PII 누설 경로가 차단된다.
3. **접근 제어 확립**: 모든 Route Handler가 RBAC permission guard로 보호되며, org/project scope가 enforce된다.
4. **사용자 경험 완성**: 다크 모드와 i18n이 대화 상태를 보존하며 런타임 전환되고, 한국어 first-class 경험이 보장된다.
5. **접근성 컴플라이언스**: WCAG 2.1 AA 자동화 게이트(axe-core 0 critical)가 green이며, 수동 QA 체크리스트 통과로 enterprise 조달 요구를 충족한다.
6. **관측성 분리**: Sentry/PostHog/Langfuse/Vercel Analytics 4-way 관측성이 `audit_logs`와 엄격 분리된 별도 채널로 작동한다.

본 SPEC의 merge 조건:
- plan-auditor agent 감사 결과 Critical/High finding 0건
- regula-compliance-qa 서명 (Group C 필수)
- 의존 SPEC(FOUNDATION/CHAT/STRUCTURED/BREADTH)의 기존 회귀 테스트 green 유지
- 자동화 13개 CI gate green

본 SPEC merge 후 Phase 6 진입 트리거는 `/moai:2-run SPEC-REGULA-ENTERPRISE-001`.

---

Version: 0.2.0
Status: draft (cross-audit patched)
Last Updated: 2026-04-23
Next Step: plan-auditor re-audit → v0.3.0 if remaining findings → PROCEED_TO_PHASE_5 gate
