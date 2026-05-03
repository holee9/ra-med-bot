## Task Decomposition
SPEC: SPEC-REGULA-ENTERPRISE-001
Mode: TDD (RED-GREEN-REFACTOR)
Total tasks: 13 (one per implementation step from SPEC §구현 지침)
Note: SPEC has 13 implementation steps; one atomic task per step keeps the limit at 10 violated by design (SPEC scope is 8 domains × 74 REQ).
Decision: Treat each step as a *task batch* and decompose internally during /moai run. Each batch has its own RED-GREEN-REFACTOR cycle.

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Migrations 선행: user_role pgEnum, audit_action +12 values, users.notification_pref, expert_reviews(status,assigned_to) index, system user seed, org_members/project_members tables (FOUNDATION 누락분 검증 후 보완) | REQ-ENTERPRISE-016, 027, 028; REQ-009 SYSTEM_USER_UUID seed | none | migrations/0004_rbac_role_enum.sql, migrations/0005_enterprise_audit_actions.sql, migrations/0006_users_notification_pref.sql, migrations/0007_expert_reviews_index.sql, migrations/0008_system_user_seed.sql, migrations/0009_membership_tables.sql (조건부), lib/db/schema.ts (userRoleEnum, users.role 변환, auditActionEnum 25 values, users.notificationPref, orgMembers/projectMembers 테이블) | pending |
| T-002 | RBAC 인프라: rbac.ts (Role + hierarchy), acl.ts (isOrgMember/isProjectMember), permissions.ts (15+ action 매트릭스), with-permission.ts (HOF), 단위 테스트 매트릭스 | REQ-ENTERPRISE-017 ~ 020 | T-001 | lib/auth/rbac.ts, lib/auth/acl.ts, lib/auth/permissions.ts, lib/auth/with-permission.ts, tests/unit/auth/rbac.test.ts, tests/unit/auth/acl.test.ts, tests/unit/auth/permissions.test.ts, tests/unit/auth/with-permission.test.ts | pending |
| T-003 | 기존 Route Handler 래핑 + 신규 Route Handler 추가 (BREADTH의 dashboard/conversations/projects/sources/templates/updates Route Handler가 부재 — 본 단계에서 신규 작성하면서 withPermission 적용). consult/sources/messages-blocks도 withPermission 추가. RBAC coverage CI script. | REQ-ENTERPRISE-021 ~ 024 | T-002 | app/api/ra/consult/route.ts (수정), app/api/ra/sources/[id]/route.ts (수정), app/api/ra/messages/[messageId]/blocks/[blockId]/route.ts (수정), app/api/ra/dashboard/route.ts (신규), app/api/ra/conversations/route.ts (신규), app/api/ra/conversations/[id]/route.ts (신규), app/api/ra/projects/route.ts (신규), app/api/ra/projects/[id]/route.ts (신규), app/api/ra/templates/route.ts (신규), app/api/ra/updates/route.ts (신규), scripts/qa/rbac-coverage.ts, scripts/qa/rbac-whitelist.json, tests/unit/qa/rbac-coverage.test.ts, tests/integration/api/permission-deny.test.ts | pending |
| T-004 | Audit 완전성: Auth.js callback writeAudit 와이어링(login/logout/session.invalidate), 기존 STRUCTURED 핸들러 checklist.toggle wiring, BREADTH project.switch wiring, audit-completeness static 분석, PII 누설 검사, 실패 전파 보장 | REQ-ENTERPRISE-028 ~ 038 | T-001, T-003 | lib/auth.ts (signIn/signOut callback writeAudit), app/api/ra/messages/[messageId]/blocks/[blockId]/route.ts (checklist.toggle audit), scripts/qa/audit-completeness.ts, scripts/qa/audit-pii-check.ts, lib/db/queries/audit.ts (read-only getAuditTrail), tests/unit/qa/audit-completeness.test.ts, tests/unit/qa/audit-pii.test.ts, tests/integration/audit/login-logout.test.ts, tests/integration/audit/audit-failure-propagation.test.ts | pending |
| T-005 | Expert Review 게이팅 파이프라인: policy-keywords (한/영 사전), expert-review-gating (shouldAutoFlag), consult.ts Phase C 통합 (expert_review_required SSE event + writeAudit + enqueueExpertReview idempotent ON CONFLICT), messages.expert_review_required 컬럼 set | REQ-ENTERPRISE-007 ~ 010 | T-001, T-004 | lib/ai/policy-keywords.ts, lib/ai/expert-review-gating.ts, lib/ai/expert-review-queue.ts (enqueueExpertReview), lib/ai/consult.ts (Phase C 수정 — auto-flag 통합), tests/unit/ai/policy-keywords.test.ts, tests/unit/ai/expert-review-gating.test.ts, tests/integration/ai/consult-auto-flag.test.ts | pending |
| T-006 | Expert Review API: POST /api/ra/expert-review (생성), GET/PATCH /api/ra/expert-review/[id] (조회 + 상태 전이 머신), Zod schema, DELETE 405, 필드 mutation 제약 | REQ-ENTERPRISE-001 ~ 006 | T-002, T-005 | lib/schemas/expert-review.ts (Zod), app/api/ra/expert-review/route.ts (POST + GET 큐 list), app/api/ra/expert-review/[id]/route.ts (GET + PATCH), tests/integration/api/expert-review-create.test.ts, tests/integration/api/expert-review-patch-state.test.ts, tests/integration/api/expert-review-delete-405.test.ts | pending |
| T-007 | Expert Review UI: queue page (admin/ra-lead 전용 server-side check), QueueList, ReviewCard, ExpertReviewCallout (amber Callout 재사용), Topbar manual flag button, Sidebar 조건부 링크, badge polling | REQ-ENTERPRISE-011 ~ 015, 025, 026 | T-006, T-008(LocaleToggle 자리만), T-009(dictionaries) | app/(app)/expert-review/page.tsx, components/expert-review/QueueList.tsx, components/expert-review/ReviewCard.tsx, components/expert-review/ExpertReviewBadge.tsx, components/chat/ExpertReviewCallout.tsx, components/shell/Topbar.tsx (수정 — 수동 플래그 버튼 wiring), components/shell/Sidebar.tsx (수정 — 조건부 링크), lib/queries/useExpertReviews.ts, tests/unit/components/ExpertReviewCallout.test.tsx, tests/integration/api/expert-review-queue-rbac.test.ts | pending |
| T-008 | Dark Mode Runtime: stores/ui.ts theme 추가, ThemeToggle 컴포넌트, app/layout.tsx FOUT 방지 inline script, profile API와 연결 (T-013에서 완성), tokens-symmetry CI script, prefers-color-scheme 초기 존중 | REQ-ENTERPRISE-039 ~ 045 | T-001 (theme_pref schema 재사용은 FOUNDATION 그대로 OK), T-013 일부 의존 | stores/ui.ts (수정 — theme/setTheme 추가), components/shell/ThemeToggle.tsx, app/layout.tsx (FOUT inline script 추가), scripts/qa/tokens-symmetry.ts, tests/unit/stores/ui-theme.test.ts, tests/unit/components/ThemeToggle.test.tsx, tests/integration/theme/fout-prevention.test.ts (Playwright video) | pending |
| T-009 | i18n Runtime: next-intl 설치 + 설정, ko/en dictionaries (전체 namespace), useI18n + getTranslations, regulatory-glossary, LocaleToggle, stores/ui.ts locale 추가, consult.ts buildSystemPrompt(locale) 분기, html lang 동적 바인딩, i18n-completeness + i18n-hardcoded CI scripts | REQ-ENTERPRISE-046 ~ 055 | T-001, T-013 (profile 연결) | package.json (next-intl 추가), lib/i18n/config.ts, lib/i18n/dictionaries/ko.ts, lib/i18n/dictionaries/en.ts, lib/i18n/index.ts, lib/i18n/regulatory-glossary.ts, components/shell/LocaleToggle.tsx, stores/ui.ts (수정 — locale/setLocale 추가), lib/ai/consult.ts (수정 — locale 분기), lib/ai/prompt-templates.ts (수정 — buildSystemPrompt(locale)), app/layout.tsx (수정 — html lang 동적 바인딩), scripts/qa/i18n-completeness.ts, scripts/qa/i18n-hardcoded.ts, tests/unit/i18n/dictionaries-symmetry.test.ts, tests/unit/i18n/regulatory-glossary.test.ts, tests/unit/qa/i18n-hardcoded.test.ts | pending |
| T-010 | Accessibility: @axe-core/playwright 및 vitest-axe 설치, SkipToContent 컴포넌트, focus-ring 표준, citation aria-label, confidence badge aria-label, streaming live region, prefers-reduced-motion 적용, form aria-describedby, contrast-check CI, Storybook a11y addon (Optional) | REQ-ENTERPRISE-056 ~ 065 | T-007, T-009 (a11y dictionary 키 의존) | package.json (@axe-core/playwright, vitest-axe, @storybook/addon-a11y), components/shared/SkipToContent.tsx, components/chat/Citation.tsx (수정 — aria-label), components/chat/ConfidenceBadge.tsx (수정 — aria-label), components/chat/AnswerBlock.tsx (수정 — aria-live region), components/chat/Composer.tsx (수정 — form a11y), styles/tokens.css (수정 — prefers-reduced-motion 블록), styles/globals.css (수정 — focus-visible standard), scripts/qa/contrast-check.ts, scripts/qa/contrast-pairs.json, tests/e2e/a11y/core-pages.spec.ts (Playwright + axe-core 10 page), tests/unit/qa/contrast-check.test.ts | pending |
| T-011 | Observability: @sentry/nextjs (3 configs), posthog-js + lib/analytics/posthog.ts (EU region), langfuse + lib/ai/langfuse.ts (consult.ts trace wrap, PII-free metadata whitelist), @vercel/analytics, .env.example 갱신, lib/env.ts Zod 확장, module-boundaries CI script, NODE_ENV 기반 sample rate | REQ-ENTERPRISE-066 ~ 073 | T-005 (consult.ts 안정), T-004 (분리 원칙 검증 대상) | package.json (@sentry/nextjs, posthog-js, langfuse, @vercel/analytics), sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, lib/analytics/posthog.ts, lib/ai/langfuse.ts, lib/ai/consult.ts (수정 — Langfuse trace wrap), app/layout.tsx (수정 — Vercel Analytics), app/providers.tsx (PostHog init), .env.example (수정), lib/env.ts (수정 — observability vars), scripts/qa/module-boundaries.ts, tests/unit/qa/module-boundaries.test.ts, tests/integration/observability/pii-redaction.test.ts | pending |
| T-012 | CI Pipeline 통합: package.json scripts (audit:check, rbac:check, i18n:check, i18n:hardcoded-check, tokens:check, modules:check, contrast:check, test:a11y, test:unit, test:int), .github/workflows/ci.yml에 13 gate 추가, override mechanism (audit-check-ignore, biome-ignore, i18n-ignore) | Group C/E/F 전반 (REQ-032/048/055/064 등) | T-004, T-008, T-009, T-010, T-011 (각 script가 모두 존재해야 통합 가능) | package.json (scripts 13개 추가), .github/workflows/ci.yml (수정 — 13 stage), tests/integration/ci/gate-smoke.test.ts | pending |
| T-013 | Profile API + 최종 회귀 시나리오: PATCH/GET /api/ra/profile (theme_pref + locale + writeAudit 양방향), Theme/Locale runtime PATCH 연결, FOUNDATION-001 회귀 테스트 (noindex, serif discipline, audit append-only), visual regression (light/dark × ko/en), traceability script | REQ-ENTERPRISE-074 (Group H), REQ-ENTERPRISE-043, 049 wiring, 완료 조건 | T-002 (withPermission), T-008 (theme), T-009 (locale) | lib/schemas/profile.ts (Zod), app/api/ra/profile/route.ts (GET + PATCH + withPermission('profile.edit') + writeAudit), stores/ui.ts (수정 — debounced PATCH), tests/integration/api/profile-patch.test.ts, tests/integration/api/profile-rbac.test.ts, tests/e2e/regression/serif-discipline.spec.ts, tests/e2e/regression/noindex.spec.ts, scripts/qa/req-traceability.ts | pending |

---

## Implementation Order Rationale (per SPEC §구현 지침)

순서는 SPEC의 13단계와 정합:

1. **T-001 (Migrations)**: 모든 후속 단계가 DB 스키마에 의존. 먼저 land해야 RBAC enum/permission/audit enum/index 생성됨.
2. **T-002 (RBAC infra)**: T-003에서 모든 Route Handler가 wrap 대상이므로 먼저 인프라 확립.
3. **T-003 (Route Handler 래핑)**: BREADTH의 Route Handler가 부재(코드베이스 검증 — 본 단계에서 신규 작성 + withPermission 적용). 이는 SPEC v0.2.0 R2 risk Medium downgrade 가정과 다름 — 별도 risk로 격상 (R-CRITICAL-1 참조).
4. **T-004 (Audit 완전성)**: T-003 wrapping 완료 후 audit 정적 분석이 의미 있음. Auth callback writeAudit과 enum 검증이 여기서 완성.
5. **T-005 (Expert Review pipeline)**: consult.ts 수정이 T-004 audit enum 확장 후에야 안전.
6. **T-006 (Expert Review API)**: pipeline이 row INSERT 가능해야 API 응답 가능.
7. **T-007 (Expert Review UI)**: API 존재 후 UI/queue page 구축.
8. **T-008 (Dark Mode Runtime)**: 독립 가능하나 T-013(profile API)와 짝이므로 같은 시점에 wiring.
9. **T-009 (i18n Runtime)**: 독립 가능하나 T-013(profile API)와 짝. dictionary 작업이 큰 범위라 T-007 이후 시작.
10. **T-010 (Accessibility)**: UI 변경(T-007, T-008, T-009)이 모두 완료된 후 일괄 감사가 효율적.
11. **T-011 (Observability)**: 마지막 추가 — 기존 테스트 환경 오염 최소화.
12. **T-012 (CI Pipeline)**: 모든 script가 존재한 후 통합.
13. **T-013 (Profile API + 회귀)**: 가장 마지막에 Theme/Locale wiring 완성 + 전체 회귀 검증.

---

## TDD Cycle per Task (RED-GREEN-REFACTOR)

각 Task는 다음 마이크로 사이클로 분해된다:

**Phase RED**:
- 실패 테스트 작성 (관련 REQ별 1건 이상)
- @MX:TODO 태그 부착
- pnpm test:unit으로 RED 확인

**Phase GREEN**:
- 최소 구현으로 테스트 통과
- @MX:TODO 제거
- 새로 추가된 export에 @MX:NOTE/@MX:ANCHOR 부착 (fan_in 예측 시)

**Phase REFACTOR**:
- 중복 제거, 명명 개선, 추출
- 모든 테스트 green 유지
- LSP 0 errors / 0 type errors / 0 lint errors 검증

---

## Risk-Based Sequencing Notes

- **T-001 → T-003 critical path**: BREADTH Route Handler 부재가 발견되면 T-003가 *작성 + 래핑*의 이중 책임을 짐. 시간 견적 재평가 필요 (SPEC v0.3.0 가정과 차이).
- **T-005가 Phase 2 (consult.ts) 파일을 수정**: SPEC REQ-009가 Phase 2 소유 파일에 추가 call-site 삽입을 명시하지만, 회귀 위험. T-005 RED phase에서 기존 CHAT-001 테스트 전부 돌려 회귀 detect.
- **T-009 i18n 추출 작업**: 기존 컴포넌트 30+ 파일 한국어 추출. T-009 GREEN phase가 가장 길어질 가능성. 점진적 PR 분할 권장 (Sidebar → Topbar → Chat → Doc → Dashboard 순).
- **T-011 Observability**: 4개 vendor 동시 wiring 시 로컬 dev 환경 오염 위험. NODE_ENV 분기로 dev에서는 Sentry sample 1.0, Langfuse는 LANGFUSE_HOST 누락 시 graceful disable.

---

Version: 0.1.0
Generated by: manager-strategy (Phase 1 Analysis)
Last Updated: 2026-05-03
