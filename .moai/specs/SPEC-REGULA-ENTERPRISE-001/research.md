---
id: SPEC-REGULA-ENTERPRISE-001
doc_type: research
created: 2026-04-22
updated: 2026-04-22
spec_version: 0.1.0
author: manager-spec
phase: 5
skill: regula
---

# Research — SPEC-REGULA-ENTERPRISE-001 (Phase 5: Enterprise Hardening)

본 문서는 `spec.md`의 EARS 요구사항과 기술 결정의 **근거 기록**이다. handoff §20 Phase 5 "Enterprise hardening" 범위 — Expert review 워크플로우 완성, RBAC, audit_logs 완전성 확립, 다크 모드 런타임, i18n 런타임, 접근성 감사(WCAG 2.1 AA), 관측성(Sentry/PostHog/Langfuse) — 에 대한 조사 결과와 기술 결정 근거를 정리한다.

Phase 1~4 선행 SPEC에 의해 이미 확보된 자원:
- FOUNDATION-001 (v0.3.0): `audit_logs` append-only 테이블, `expert_reviews` 테이블, `users.locale`/`users.theme_pref` pgEnum, `[data-theme="dark"]` CSS 오버라이드 블록, `<html lang="ko">` 기본값, 13-테이블 Drizzle 스키마
- CHAT-001: `/api/ra/consult` SSE 파이프라인, `confidence` 이벤트, `confidence.score` 필드
- STRUCTURED-001: `Callout` 컴포넌트, expert_review variant UI 기본형
- BREADTH-001: Dashboard 페이지 뼈대 (메트릭 카드 위치 확보)

본 SPEC은 위 토대에서 **게이팅·권한·관측성·접근성·i18n 런타임**을 완성해 **Phase 6 Quality & Launch**로 이관할 수 있는 프로덕션 수준을 달성한다.

---

## 조사 배경

Phase 5는 "Enterprise hardening"이라는 이름이 시사하듯이, **기능 추가가 아니라 이미 존재하는 프리미티브를 규제·보안·접근성 수준으로 강화**하는 단계다. 구체적으로 다음 네 가지 근본 긴장(tension)을 해결해야 한다.

### 긴장 1: Expert review "게이트"와 "UX 편의"의 혼동 위험

`regula-expert-review-gating` 스킬은 "UI 편의가 아닌 **제품 안전 게이트**이다"라고 명시한다(스킬 L8). 이는 다음 의미를 갖는다.

1. 게이팅 우회 금지 — "이번 답변만 게이팅 제외" 요청 거부 (스킬 L188–191)
2. 관리자도 자동 플래그 해제 불가 — `resolved` 상태로 이동만 허용
3. 게이팅 로직 변경은 PR 리뷰 + regula-compliance-qa 승인 필수

Phase 5가 범하기 쉬운 실수는 expert review 큐를 일반 이슈 트래커처럼 취급해 "편집 가능·삭제 가능" 기능을 덧붙이는 것이다. 본 SPEC은 감사 로그와 동일한 엄격성을 expert_reviews에 적용한다: 상태 전이만 허용, 삭제 금지, 모든 전이에 audit 기록.

### 긴장 2: audit_logs "완전성"의 정의

FOUNDATION-001은 **테이블·트리거·writeAudit 헬퍼**까지를 Phase 1 범위로 잡았다. REQ-FND-049는 Phase 2/5에서 Route Handler 콜사이트를 와이어링한다고 예고했다.

완전성의 세 기둥:
1. **모든 Write Route Handler**가 writeAudit를 호출 — 정적 분석으로 검증
2. **writeAudit 실패 시 요청 실패** — 규제 요구사항 충족 우선 (스킬 L110–111)
3. **PII 누설 금지** — meta JSONB에 question/answer/email/phone 키 부재

Phase 4까지는 CHAT/STRUCTURED/BREADTH가 자신의 Route Handler에 writeAudit를 **개별적으로** 추가했지만, 체계적 커버리지 검증은 없었다. Phase 5에서 정적 분석 스크립트(`scripts/qa/audit-completeness.ts`)를 도입해 **감사 누락 0건** 상태를 CI gate로 만든다.

추가로, FOUNDATION REQ-FND-049는 Phase 5에서 `auth.login`/`auth.logout`/`session.invalidate`/`expert_review.resolve` enum 값을 실제 와이어링한다고 명시했다. 본 SPEC이 그 집행 지점이다.

### 긴장 3: RBAC 도입의 광범위 영향

handoff §16은 "Org/project-scoped; enforce at DB query layer (RLS in Postgres if using Supabase)"라고 쓰여 있지만, 구체적 권한 매트릭스는 미결정이다. Phase 4에서 BREADTH가 `/api/ra/dashboard`·`/api/ra/conversations`·`/api/ra/projects` 등 다수 Route Handler를 추가했는데, 이들 모두 현재는 단순 "auth session 존재" 만으로 접근 허용한다.

Phase 5 RBAC 도입은 다음을 포함한다.
1. Role enum 정의: `admin`, `ra-lead`, `ra-member`, `viewer`
2. Organization-scoped membership: `org_members(org_id, user_id, role)` 테이블 활성화 (FOUNDATION이 이미 정의)
3. Project-scoped ACL: `project_members(project_id, user_id)` 테이블 활성화
4. Route별 permission guard: `withPermission(action)` 미들웨어 함수
5. Expert review 큐 접근 제약: 오직 `admin` OR `ra-lead`만

이 도입은 **Phase 4의 모든 Route Handler를 건드린다**. "광범위 침투"는 피할 수 없으며, 오히려 Phase 6로 미루면 회귀 위험이 더 크다. Phase 5에서 완결해야 하는 이유다.

### 긴장 4: i18n "런타임" 전환의 의미

프로토타입과 Phase 1~4는 한국어 문자열을 컴포넌트에 **하드코딩**했다. `regula-i18n` 스킬은 `lib/i18n/dictionaries/ko.ts`·`en.ts` + `useI18n()` 훅 패턴을 정의하지만, 실제 구현은 Phase 5다.

런타임 전환의 정의:
1. 사용자가 Topbar 로케일 토글을 누르면 페이지 새로고침 없이 UI 문자열이 즉시 전환
2. 진행 중인 SSE 스트림이 있어도 **대화 상태 유지** (URL 유지, Zustand store만 업데이트)
3. LLM 답변은 생성 당시 locale로 고정 (기존 답변 재번역 없음 — LLM 원본 언어 유지)
4. 신규 질문부터 새 locale로 /api/ra/consult 전송
5. `<html lang>` 속성 동적 업데이트

**전량 추출의 규모**: 프로토타입 기반 추정 300+ 하드코딩 문자열. 기계적 작업이지만 대량이다. 본 SPEC은 추출 자체를 요구사항으로 인코딩하지 않고 (세부는 구현 세부사항), **dictionary 키 완전성 + 누락 감지 CI 테스트**를 REQ로 명시한다.

### 긴장 5: 접근성 감사와 "보증 vs 보장"의 차이

`WCAG 2.1 AA` 100% 준수는 **보증**될 수 없고 **최대한 보장**될 뿐이다. 본 SPEC은 다음 레벨로 분리한다.

- **자동화 가능한 항목**: axe-core 위반 수, 색 대비(tokens.css 정적 계산), 시맨틱 HTML 태그, ARIA 필수 속성 — CI gate로 "0 violations"
- **수동 샘플링 항목**: 스크린 리더 내비게이션, 키보드 플로우 전체 경로, prefers-reduced-motion 존중 — RA 리드 수동 QA 체크리스트
- **지속 감시 항목**: 색 대비 회귀, 신규 컴포넌트의 focus ring — Storybook a11y addon

Phase 5 완료 기준: axe-core CI 0 violations, 체크리스트 100% pass, Storybook addon 설치. "WCAG 2.1 AA 완전 준수"는 주장하지 않고 "감사 기반 컴플라이언스 상태"로 표현.

---

## 기술 선택 근거

### 결정 1: i18n 라이브러리 — next-intl vs react-intl

**선택: next-intl**

- **Next.js 15 App Router 네이티브**: next-intl은 App Router middleware, locale-based routing, Server Components 내부 사용을 네이티브 지원. react-intl은 주로 Pages Router + Client Component 패턴에 최적화.
- **Zod 및 TypeScript 통합**: next-intl의 dictionary 타이핑이 ko/en 키 불일치 시 compile-time error를 유발. `regula-i18n` 스킬의 "en 딕셔너리 키가 ko와 완전 일치" 체크리스트(스킬 L231)가 정적 검증으로 충족.
- **SSR 안전 locale 전환**: next-intl은 `NextIntlClientProvider` + 서버 사이드 dictionary 주입으로 hydration mismatch 방지.
- **탈락 사유**: react-intl의 `IntlProvider`는 Client Component 강제를 유발해 RSC가 많은 Regula 레이아웃과 충돌. 또한 react-intl은 ICU MessageFormat 기반인데, Regula는 단순 보간(`{name}`)만 필요해 과설계.
- **재평가 트리거**: next-intl이 plural/gender 복잡한 언어 지원이 필요해질 때 (아랍어/히브리어 추가 시).

### 결정 2: RBAC 모델 — Role + Scope 2-tier vs ABAC

**선택: Role + Organization/Project scope 2-tier**

- **요구사항 단순성**: handoff §16 "Org/project-scoped"만 언급. ABAC(attribute-based, e.g. "user X가 device_class III 프로젝트 Y에 submission_date - 30 이내면 edit 가능")은 Regula 사용 사례에서 정당화되지 않음.
- **읽기 성능**: RBAC는 Route 진입 시 `SELECT role FROM org_members WHERE user_id = ? AND org_id = ?` 1 쿼리로 끝남. ABAC는 정책 엔진(OPA 등) 추가 필요, 레이턴시 증가.
- **테스트 용이**: Role 기반은 fixture 생성이 단순(`admin` 사용자·`ra-member` 사용자 각 1명). ABAC는 정책 매트릭스 테스트가 조합 폭발.
- **탈락 사유**: ABAC는 기능상 "하나 더 할 수 있다"는 선택지를 주지만, 본 제품의 복잡도 수준을 초과.
- **Phase 6 후 확장 여지**: 필요 시 Project level에서 `project_members(role text)`를 추가해 project-scoped role을 보강 가능(본 Phase는 project_members.role은 미도입, 참여 여부만 확인).

### 결정 3: Notification 채널 — In-app vs Slack/Email

**선택: In-app notifications (Phase 5) + email opt-in (Post-launch)**

- **초기 복잡도 감소**: Slack webhook은 워크스페이스별 설정·토큰 관리·per-org configuration UI가 필요. Phase 5 범위 초과.
- **In-app 채널**: `/expert-review` 페이지 상단에 신규 item 카운트 배지(Tanstack Query polling 5s interval 또는 WebSocket). 이미 존재하는 Topbar의 알림 벨 영역 활용.
- **이메일 단계적 도입**: 3rd-party(Resend, Postmark) 의존성 추가 + 사용자별 preference UI는 Post-launch. Phase 5는 DB schema에 `users.notification_pref` 컬럼만 추가(migration cost 작음).
- **재평가 트리거**: 초기 고객 요청 집중 시 Post-launch 1-2주 내 이메일 도입.

### 결정 4: Theme persistence 소스

**선택: localStorage + users.theme_pref DB 양방향 동기화**

- **Cross-device 일관성**: 사용자가 노트북과 태블릿에서 각각 접속해도 테마 일관. localStorage만으로는 device-local.
- **첫 방문 우선순위**: `prefers-color-scheme` → DB `theme_pref` (로그인 세션 있으면) → localStorage 최종 캐시
- **쓰기 시점**: 사용자가 토글하면 localStorage 즉시 + DB `PATCH /api/ra/profile` 비동기 (debounced 500ms)
- **탈락 사유**: DB만 사용 시 로그인 전 테마 깜빡임(flash); localStorage만 사용 시 device간 불일치.
- **SSR 처리**: `[data-theme]` 초기값은 hydration 전에 `<script>`로 설정(Chakra UI/Next-themes 패턴). FOUT(flash of unstyled theme) 방지.

### 결정 5: Observability 벤더 분담

**선택: Sentry (errors) + PostHog (product analytics) + Langfuse (LLM traces) + Vercel Analytics (Web Vitals) 4-way**

- **각 도구 강점**:
  - Sentry: JavaScript error tracking + source maps, release tracking, performance (transaction traces). 의료 도메인 에러 조기 감지.
  - PostHog: 제품 분석(session count, funnel, retention), privacy-first (self-hosted 가능, EU 리전 지원).
  - Langfuse: LLM latency/cost/quality trace. Prompt version, token usage per generation. `regula-rag-pipeline`이 주 사용자.
  - Vercel Analytics: Core Web Vitals (LCP, INP, CLS). Next.js 네이티브 통합.
- **탈락 사유 (Datadog/New Relic 통합 플랫폼)**:
  - LLM-specific observability(Langfuse) 대체 불가 — generation-level trace가 1st-class 개념 아님.
  - 비용(seat-based) 대비 Regula 초기 규모 과잉 투자.
- **21 CFR Part 11과의 분리 재확인**: `regula-audit-compliance` 스킬 L16 "observability와 분리" — Sentry/PostHog은 버그 추적용, audit_logs는 규제 준수용. **절대 대체 관계 아님.** 본 SPEC은 두 경로를 분리된 코드 경로로 유지 요구사항으로 인코딩.
- **재평가 트리거**: 전체 관측성 비용 월 $500 초과 시 통합 검토.

### 결정 6: Expert review notification trigger 위치

**선택: 애플리케이션 레이어 (Next.js Route Handler) vs DB trigger**

- **테스트 용이**: 애플리케이션 레이어 코드는 Vitest에서 mock 가능. DB trigger는 Postgres를 spinning up해야 검증.
- **관찰 가능성**: Sentry/Langfuse trace에 notification 발행이 포함됨. DB trigger는 애플리케이션 trace에서 안 보임.
- **다중 채널 지원**: 미래 Slack/email 확장 시 애플리케이션 레이어가 채널 추가 용이.
- **탈락 사유**: DB trigger는 "absolute guarantee" 관점에서 매력적이지만, 현재 notification은 best-effort(SLA 없음). audit_logs는 DB trigger(append-only 강제) 유지, expert review notification은 애플리케이션 레이어가 적합.
- **재평가 트리거**: notification miss가 규제 이슈로 격상될 경우 — e.g. RA 리드가 큐를 못 봐서 리소스 미할당 → FDA audit 지적. 그 경우 Post-launch에 DB trigger 추가.

---

## 대체 접근 검토 (Rejected Alternatives)

### 대체안 1: Phase 5를 Phase 6에 병합

`Phase 5 = Enterprise hardening`과 `Phase 6 = Quality & Launch`를 단일 Phase로 합치는 안.

- **반대 근거**: 접근성 감사와 RBAC 도입은 회귀 위험이 가장 높음. Phase 6 E2E/LLM eval과 섞으면 실패 디버깅이 어려워짐. 분리 유지.
- **결과**: 기각.

### 대체안 2: Dark mode를 Phase 6로 이관

"기능적으로는 Phase 1 CSS 블록이 이미 존재하니 토글 UI 하나 추가는 Phase 6 polish에서"

- **반대 근거**: 접근성 감사는 dark mode 포함 양쪽 테마 색 대비 검증 필요. Phase 6로 미루면 감사 범위가 반쪽이 됨.
- **결과**: 기각.

### 대체안 3: 접근성 감사를 Post-launch로

"AA 준수는 마케팅 차원의 자발적 약속이니 launch 후 점진 개선"

- **반대 근거**: handoff §14 "enterprise + 규제 산업 구매자에게 필수". 엔터프라이즈 조달 프로세스(VPAT 요청)에서 감사되므로 pre-launch 확보 필요.
- **결과**: 기각.

### 대체안 4: 이메일 notification을 Phase 5에 포함

"RA 리드가 큐를 실시간으로 보지 않으면 expert review SLA 파손 가능"

- **반대 근거**: Phase 5 범위 초과. 3rd-party 벤더 선정 + 사용자 preference UI + 템플릿 관리까지 필요. In-app 알림으로 Phase 5 완료 후 Post-launch 이메일 추가.
- **결과**: 기각. `users.notification_pref` 컬럼만 Phase 5에 선행 도입.

---

## 관련 스킬 및 참조

- `regula-expert-review-gating`: confidence < 0.7 / 정책 키워드 / 수동 플래그의 3개 자동 게이팅 조건, SSE event 발행 위치, 게이팅 우회 금지 원칙.
- `regula-audit-compliance`: append-only 트리거, writeAudit 헬퍼 패턴, PII 누설 금지, 7년 retention, 정적 분석 위험 패턴.
- `regula-i18n`: ko/en 이중 dictionary, Noto Serif KR + Pretendard, locale 전환 시 대화 보존, 규제 용어 glossary.
- `regula-design-tokens`: `[data-theme="dark"]` 오버라이드, Serif 디시플린, 임의 hex 색 금지.

handoff 섹션:
- §6 Design Tokens (특히 Dark Mode 완성)
- §9.3 Expert review flag (자동 + 수동)
- §9.5 Theme toggle
- §9.7 Responsive breakpoints
- §11.8 POST /api/ra/expert-review
- §14 Accessibility (WCAG 2.1 AA)
- §16 Security & Compliance (21 CFR Part 11 완전성, RBAC, audit 완전성)
- §18 Deployment & DevOps (Sentry, PostHog, Langfuse 등)

의존 SPEC:
- SPEC-REGULA-FOUNDATION-001 v0.3.0
- SPEC-REGULA-CHAT-001 (confidence 계산 파이프라인)
- SPEC-REGULA-STRUCTURED-001 (Callout 컴포넌트)
- SPEC-REGULA-BREADTH-001 (Dashboard)

---

## Non-Obvious Constraints 매트릭스 (Phase 5 집중)

handoff README의 "Non-Obvious Product Constraints"(CLAUDE.md 기반) 중 Phase 5가 직접 책임지는 항목:

| # | 제약 | Phase 5 처리 |
|---|---|---|
| 3 | Expert review 자동 플래그(confidence < 0.7 OR 정책 키워드) — **제품 안전 게이트** | REQ-ENTERPRISE Group A 전량 (게이팅 우회 금지, resolved 전이만 허용, 수동·자동 플래그 모두 audit) |
| 4 | 21 CFR Part 11 audit_logs append-only + 7년 retention | Group C 전량 (모든 Write Route Handler writeAudit, 정적 분석 CI gate, enum 확장) |
| 5 | Serif/sans 타이포 (다크 모드에서도 유지) | Group D (다크 모드 런타임 토글 시 `--font-serif` 불변, 시각 회귀 테스트) |
| 6 | 한/영 first-class, Noto Serif KR + Pretendard | Group E 전량 (런타임 locale 스위처, dictionary 완전성, `<html lang>` 동적 업데이트) |
| 7 | Auth 뒤 noindex 유지 | 회귀 테스트 (Phase 1 FOUNDATION REQ-FND-014 · 018 유지 검증) |

Constraint #3(Expert review), #4(audit), #6(i18n)은 Phase 5에서 **최종 완결**된다. #5(Serif), #7(noindex)는 Phase 1에서 확보 후 Phase 5에서 회귀 방지.

---

## Phase 6 (Quality & Launch)로의 Handoff 포인트

Phase 5 완료 후 Phase 6가 인수받는 자원:

1. **Expert review 워크플로우 완성됨** → Phase 6 E2E에서 "low confidence 질문 → 큐 적재 → RA 리드 resolved" 플로우 Playwright 커버.
2. **RBAC permission guard 존재** → Phase 6 부하 테스트가 admin vs ra-member 이중 페르소나로 실행.
3. **audit_logs 완전성 확립** → Phase 6 규제 감사 시뮬레이션(getAuditTrail 쿼리 샘플 + meta PII-free 검증).
4. **axe-core CI gate** → Phase 6는 수동 스크린 리더 QA와 VPAT 초안 작성으로 이어짐.
5. **Sentry/PostHog/Langfuse wired** → Phase 6는 production release 후 alert threshold 튜닝 및 runbook 작성.
6. **i18n dictionary 완성** → Phase 6 LLM eval(promptfoo)는 ko/en 각각 별도 회귀 셋 실행.

Phase 6에서 다룰 명시적 이슈 (Phase 5 Out of Scope로 이관):
- Playwright E2E 전체 커버리지 확대
- promptfoo LLM eval harness + 50+ RA 질문 회귀 셋
- 부하 테스트(k6 또는 Artillery)
- VPAT 공식 문서화
- Feature flag 시스템(Statsig 또는 Vercel Flags) wiring
- Rollback runbook + migration down script
- 프로덕션 Sentry alert threshold 튜닝

---

Version: 0.1.0
Status: draft
Last Updated: 2026-04-22
