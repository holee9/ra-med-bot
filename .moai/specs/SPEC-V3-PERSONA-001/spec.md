---
id: SPEC-V3-PERSONA-001
version: 0.2.0
status: completed
phase: D
priority: High
created: 2026-07-06
updated: 2026-07-06
author: manager-spec
issue_number: TBD
depends_on:
  - SPEC-V3-IMPACT-UI-001
  - SPEC-V3-CONSULT-001
  - SPEC-V3-INBOX-001
blocks: []
parent_spec: SPEC-V3-UI-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/shell
  - domain/persona
  - type/v3-new
---

# SPEC-V3-PERSONA-001 — 3-Tier PersonaBar (v3 Phase D)

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-06 | manager-spec | 초기 작성. v3 Phase D-2 3-tier PersonaBar + persona-aware Sidebar + persona landing branch. research.md 직검 기반 (L-013). REQ 10종 (8 functional + 2 optional/deferred). 마스터 플랜 route reorg → incremental push-back (§6-A3). SPEC ID collision 회피 (UI-001 → PERSONA-001, §6-A1). |

---

## §1 Purpose (목적)

### 1.1 배경 (Background)

v3 마스터 플랜(`docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` §5.1 Phase D-2)은 3-tier 페르소나 아키텍처(Employee · RA · Admin)를 Regula의 핵심 shell 레벨 전환으로 지정했다. `docs/v3/README.md` §1 "3-tier Persona 아키텍처"에 따라 상단에 `<PersonaBar />` 배치, 각 페르소나는 별도 사이드바 IA를 가진다.

현재 코드베이스는 role-gated 사이드바(`components/shell/Sidebar.tsx`, 482L)와 서버 사이드 RBAC flag 산출(`app/(app)/layout.tsx`, 150L)을 이미 갖추고 있다. 본 SPEC은 이 위에 **3-tier 페르소나 전환 레이어**를 추가한다 — 단, 기존 라우트와 RBAC를 보존하는 **점진적(incremental)** 방식으로 (research.md §4, §6-A3).

> **PUSH-BACK on master plan:** 마스터 플랜은 `app/((employee)|(ra)|admin)/` 풀 라우트 재구성을 제안하지만, 본 SPEC은 이를 **거부**하고 incremental 접근을 취한다. 이유: 25+ 라우트 디렉토리 이동, 50+ `<Link>` 참조 갱신, 10+ E2E 테스트 깨짐, 모든 RBAC 게이트 재작업 = 높은 회귀 위험. 6-8인 내부 팀(Charter)에 점진적 가치 전달이 적합. 라우트 재구성은 별도 SPEC-V3-ROUTE-REORG-001로 이월 (research.md §6-A3).

### 1.2 핵심 가치

- **페르소나 중심 전환:** 사용자가 자신의 역할에 해당하는 tier(Employee/RA/Admin)로 진입해 맞춤형 IA를 본다.
- **기존 투자 보존:** consult, inbox, impact, triage 등 완성된 v3 컴포넌트/라우트를 **재작성 없이** persona-aware 레이어로 감싼다.
- **서버 사이드 RBAC 불변:** PersonaBar 전환은 **뷰 전용**(view-only). `withPermission` / `hasRole` 서버 게이트는 그대로 동작한다 (Charter [정직성] — 권한 우회 금지).
- **점진적 가치 전달:** PersonaBar + Sidebar 필터 + 랜딩 분기만으로 23개 페르소나 화면이 plug-in 할 수 있는 shell 인프라 완성.

### 1.3 페르소나 정의 (verified — research.md §2.3)

> **역할 래더 (verified, `lib/auth/rbac.ts:16-26`):** admin=4 > ra-lead=3 > qa-lead=2.5 > ra-member=2 > viewer=1 > auditor=0.5. `employee` 역할은 존재하지 않는다. Employee 페르소나 = `viewer`(+`auditor`) 역할 매핑.

| 페르소나 Tier | 포함 역할 | Hierarchy | 대상 사용자 |
|---|---|---|---|
| Employee | `viewer`, `auditor` | 0.5 – 1 | 전사 직원 (26명, docs/v3/README.md §1.1) — 셀프서비스 Q&A |
| RA | `ra-member`, `qa-lead`, `ra-lead` | 2 – 3 | RA 담당자 — 워크벤치 (Inbox, Consult, Authoring) |
| Admin | `admin` | 4 | 관리자 — 감시 (users, corpus, audit, settings) |

> **qa-lead 매핑 주의:** `qa-lead` (2.5)는 RA tier이다 (rbac.ts:19-20 comment: "QA lead can perform member-level work by default"). Admin tier가 아님.
> **auditor 매핑 주의:** `auditor` (0.5)는 Employee tier이다 (탐색 목적). 단 기존 write-block(`withPermission`)은 그대로 유지된다 — PersonaBar가 이를 우회하지 않는다 (REQ-V3-PER-004).

### 1.4 비목표 (Charter 정렬)

- 23개 페르소나 화면(Ask, MyQuestions, Registry, Radar, Admin 12종 등) 개별 구현 X — 본 SPEC은 **shell 인프라**만. 개별 화면은 별도 SPEC.
- 라우트 그룹 재구성(`(employee)/(ra)/admin`) X — incremental 접근, 기존 flat 라우트 보존 (research.md §6-A3).
- 백엔드 변경 X — migration, schema, RBAC enum, audit 로그 변경 없음. Tier는 순수 클라이언트 derivation.
- ESIG, 실시간 알림, admin impersonation(view-as) X — future SPEC (REQ-V3-PER-009로 명시만).

---

## §2 Scope

### 2.1 In Scope

1. `components/shell/PersonaBar.tsx` 신규 — 3-tier 전환 컴포넌트 (Employee/RA/Admin).
2. `lib/auth/persona.ts` 신규 — `personaTier(role)` 순수 함수 + `regula-persona` 쿠키 읽기/쓰기 유틸.
3. `components/shell/Sidebar.tsx` 수정(additive) — `tier` prop 추가, tier 기반 NAV 필터(기존 `show*`/`NAV_ITEMS`/`userRole` 비파괴 확장).
4. `app/(app)/layout.tsx` 수정 — `auth()` → `personaTier(role)` → `<PersonaBar tier={...}>` + `<Sidebar tier={...}>` 전달.
5. `app/(app)/page.tsx` 수정 — tier-level 랜딩 분기 (기존 `ROLE_ENTRIES` 위에 tier 분기 추가).
6. `messages/ko.json` / `messages/en.json` — `persona` 키 신규 추가.
7. `components/shell/__tests__/` — Vitest + RTL 단위 테스트.

### 2.2 Out of Scope (Exclusions)

- 백엔드 4계층 로직, 마이그레이션, RBAC enum 추가 — frozen.
- 23개 페르소나 화면(Ask, MyQuestions, Products, Guides, Submissions, Registry, Radar, Admin 12종) — 별도 SPEC.
- 라우트 그룹 재구성(`(employee)|(ra)|admin`) — SPEC-V3-ROUTE-REORG-001로 이월 (research.md §6-A3).
- Employee Impact self-check 페이지 게이트 완화(`impact.view` 현재 `ra-member`) — SPEC-V3-EMPLOYEE-IMPACT-001로 이월 (research.md §6-A2).
- Admin view-as / impersonation 플로우 — future SPEC (REQ-V3-PER-009 optional).
- SearchPalette(`/` command palette) — v1은 PersonaBar + Sidebar만. SearchPalette는 future SPEC.

---

## §3 Functional Requirements (EARS)

> **Verified basis:** 모든 REQ는 research.md §2-§3에 직검 검증된 `Role` union, `ROLE_HIERARCHY`, `PERMISSION_MAP`, Sidebar props, layout 패턴에 근거한다. Tier는 클라이언트 사이드 순수 derivation이다 (`lib/auth/persona.ts`의 `personaTier(role)`).

### REQ-V3-PER-001: PersonaBar 3-Tier 전환 컴포넌트

**WHEN** 인증된 사용자가 앱 셸에 진입하면, **THE SYSTEM SHALL** 상단(Topbar 또는 그 하위)에 3개 tier(Employee / RA / Admin) 전환 버튼을 가진 `<PersonaBar />`를 렌더링한다.

**THE SYSTEM SHALL** 사용자의 현재 역할에서 파생된 기본 tier를 `personaTier(role)`로 산출하여 활성 버튼으로 표시한다 (verified derivation — research.md §2.3).

**WHILE** 사용자의 역할이 `viewer` 또는 `auditor`일 때, **THE SYSTEM SHALL** Employee tier 버튼만 활성화하고 RA/Admin 버튼은 비활성화(disabled)한다 — 권한 없는 tier로 전환 시도 차단.

**WHILE** 사용자의 역할이 `ra-member`, `qa-lead`, 또는 `ra-lead`일 때, **THE SYSTEM SHALL** Employee와 RA tier 버튼을 활성화하고 Admin 버튼은 비활성화한다.

**WHERE** 사용자의 역할이 `admin`일 때, **THE SYSTEM SHALL** 세 tier 모두 활성화한다.

### REQ-V3-PER-002: Persona 인지 Sidebar 필터

**WHEN** PersonaBar의 활성 tier가 변경되면, **THE SYSTEM SHALL** `<Sidebar />`가 해당 tier에 맞게 네비게이션 항목을 필터링하여 표시한다.

**THE SYSTEM SHALL** 기존 `NAV_ITEMS`(홈/새상담/히스토리/설정)와 `show*` props를 **비파괴적으로** 확장하여, tier가 `employee`일 때는 Employee 대상 항목(Ask, MyQuestions, Products, Guides)을, `ra`일 때는 RA 대상 항목(Inbox, Consult, Impact, Knowledge)을, `admin`일 때는 Admin 대상 항목(Users, Corpus, Audit, Settings)을 우선 노출한다.

**IF** 항목이 해당 tier에 속하지 않으면, **THE SYSTEM SHALL** 해당 항목을 숨기거나(기본) 또는 비활성화된 "RA 전용" 배지로 표시한다 (UX 확정은 run-phase).

> **H3 — 비파괴 확장 (run-phase 주의):** 기존 `show*` props와 `userRole` prop은 **삭제하지 않는다**. Sidebar는 이미 `userRole`로 NAV를 필터 중이다 (line 79). 새 `tier` prop은 **additive**하며, 기존 로직을 대체하지 않는다. run-phase에서 `show*` props 제거 시 기존 SPEC-REGULA-* / SPEC-V3-* 테스트가 깨진다.

> **H4 — NAV_ITEMS 고정 + tier filter precedence (plan-auditor H1/H2 개정, 2026-07-06):** 4개 핵심 `NAV_ITEMS`(홈/새상담/히스토리/설정)은 REQ-FND-019가 정한 고정 순서로 primary `<nav>`에 **tier 값과 무관하게 항상** 렌더링된다 (`tests/unit/frontend-shell.test.ts`의 `navLinks.length === 4` / `toEqual(['/', '/chat', '/history', '/settings'])` 단언 준수). tier별 항목은 **별도 `<nav>` 블록**에 기존 `show*` 조건부 패턴과 동일 방식으로 additive 렌더링한다. `tier` prop이 설정된 경우 tier filter가 `show*` props에 **AND 결합**으로 우선 적용된다 (예: admin이 Employee tier 전환 시 `showInbox=true`여도 Inbox는 미노출). `tier`가 `undefined`인 경우 기존 `show*`-only 동작을 보존한다 (비회귀).

### REQ-V3-PER-003: Persona 랜딩 페이지 분기

**WHEN** 사용자가 `/` (home) 경로로 진입하면, **THE SYSTEM SHALL** `auth()`로 역할을 읽고 `personaTier(role)`로 tier를 파생하여 tier별 랜딩 섹션을 렌더링한다.

**THE SYSTEM SHALL** 기존 `ROLE_ENTRIES`(`app/(app)/page.tsx`)를 재사용하여 tier 분기를 추가한다 — Employee tier는 Ask/Impact/Products 진입점, RA tier는 Inbox/Consult/Triage 진입점, Admin tier는 Users/Corpus/Audit 진입점.

**WHERE** `regula-persona` 쿠키가 존재하면, **THE SYSTEM SHALL** 쿠키 값을 우선 적용하여 사용자가 마지막으로 선택한 tier로 랜딩한다 (단, 쿠키 tier가 역할에서 파생된 tier보다 권한이 높으면 거부하고 역할 기반 tier로 폴백 — REQ-V3-PER-004 준수).

### REQ-V3-PER-004: 서버 사이드 RBAC 불변 (보안 핵심)

**THE SYSTEM SHALL** PersonaBar 전환이 사용자의 실제 권한을 변경하지 않도록 보장한다 — 전환은 **뷰 전용**(view-only)이며, 모든 서버 사이드 `withPermission` / `hasRole` 게이트는 사용자의 **실제 역할**(`session.user.role`)을 기준으로 동작한다.

**IF** Employee tier 사용자가 RA 전용 라우트(`/inbox`, `/consult` 등)로 직접 진입하면, **THE SYSTEM SHALL** 기존 RBAC 게이트가 그대로 동작하여 `/?error=access_denied`로 리다이렉트한다 — PersonaBar 전환 상태와 무관.

> **H1 — 권한 우회 금지 (Charter [정직성]):** PersonaBar는 사용자가 볼 수 있는 IA를 바꿀 뿐, 실제 권한을 부여하지 않는다. 예: `viewer` 역할 사용자가 PersonaBar로 "RA"를 선택해도 `/inbox` 접근 시 서버 게이트가 거부한다. 이는 보안 불변량이며 테스트로 강제된다.

### REQ-V3-PER-005: Persona 전환 상태 영속 (Cookie)

**WHEN** 사용자가 PersonaBar에서 다른 tier를 선택하면, **THE SYSTEM SHALL** `regula-persona` 쿠키에 해당 tier 값을 저장한다.

**THE SYSTEM SHALL** 쿠키를 서버 사이드에서 읽을 수 있도록 설정한다 (`httpOnly: false`, `path: '/'`, `sameSite: 'lax'`) — `layout.tsx`가 SSR 시 읽어 hydration mismatch를 방지 (research.md §6-A4 — localStorage 사용 시 SSR 불가).

**THE SYSTEM SHALL** 쿠키의 tier 값이 사용자 역할에서 파생 가능한 tier 범위를 벗어나면(예: `viewer` 역할인데 쿠키가 `admin`), 쿠키를 무시하고 역할 기반 기본 tier로 폴백한다 (REQ-V3-PER-004 보강).

> **A4 결정 (research.md):** localStorage가 아닌 cookie를 사용하는 이유 — `layout.tsx`(server component)가 SSR 시 읽을 수 있어야 hydration mismatch가 발생하지 않는다. localStorage는 클라이언트 전용이므로 SSR 시 빈 상태 렌더링 → 클라이언트 hydration 후 전환 → 깜빡임 발생. `regula-locale` 쿠키(layout.tsx:118)가 동일 패턴으로 입증되었다.

### REQ-V3-PER-006: 접근성 (WCAG 2.1 AA)

**WHEN** PersonaBar가 렌더링되면, **THE SYSTEM SHALL** 3개 tier 버튼을 `role="tablist"` / `role="tab"` ARIA 패턴으로 구현하고 `aria-selected` 상태를 활성 tier에 표시한다.

**THE SYSTEM SHALL** 키보드 사용자가 Tab으로 버튼 사이를 이동하고 Enter/Space로 tier를 선택할 수 있게 한다.

**THE SYSTEM SHALL** PersonaBar의 모든 색상 조합이 light/dark 모두에서 WCAG 2.1 AA 대비를 만족한다 (`ci:contrast` 게이트).

### REQ-V3-PER-007: 국제화 (i18n)

**THE SYSTEM SHALL** 모든 PersonaBar 가시 문자열(tier 이름, 툴팁, 비활성화 사유 등)을 `next-intl`의 `persona.*` 네임스페이스 키로 관리한다 (`messages/ko.json` + `messages/en.json`).

**THE SYSTEM SHALL** tier 이름을 로켈별로 표시한다 — ko: "전사 직원 / RA 담당자 / 관리자", en: "Employee / RA / Admin".

### REQ-V3-PER-008: 비회귀 (기존 라우트 보존)

**THE SYSTEM SHALL** 기존 `app/(app)/` flat 라우트 구조(admin, audit, chat, consult, dashboard, history, impact, inbox, knowledge, settings, triage 등 25+ 디렉토리)를 변경하지 않는다 — 라우트 이동/이름 변경/그룹화 금지.

**THE SYSTEM SHALL** 기존 `NAV_ITEMS` 순서(REQ-FND-019 계약)와 `frontend-shell.test.ts` 단언을 깨뜨리지 않는다 — Sidebar 수정은 **additive**(`tier` prop 추가)이며 기존 prop 제거 없음.

**THE SYSTEM SHALL** 기존 SPEC-REGULA-* 및 SPEC-V3-*(INBOX/TRIAGE/IMPACT/CONSULT/UI) 컴포넌트/라우트에 영향을 주지 않는다.

### REQ-V3-PER-009: Admin View-as (OPTIONAL / DEFERRED)

**WHERE** 기능 플래그 `FEATURE_FLAGS.PERSONA_VIEW_AS`가 활성화되면, **THE SYSTEM SHALL** `admin` 역할 사용자가 다른 tier의 IA를 미리보기 할 수 있는 "view-as" 모드를 제공한다 (선택적).

> **v1 비구현:** 본 REQ는 아키텍처가 이를 배제하지 않도록 명시만 해둔다. 구현은 future SPEC (research.md §6-A5). View-as는 **뷰 전용**이며 실제 권한 부여 없음 (REQ-V3-PER-004 준수).

### REQ-V3-PER-010: SearchPalette (OPTIONAL / DEFERRED)

**WHERE** 기능 플래그 `FEATURE_FLAGS.SEARCH_PALETTE`가 활성화되면, **THE SYSTEM SHALL** `/` 키 또는 Cmd+K로 여는 전역 검색 팔레트를 제공하여 tier 무관 모든 라우트로 점프할 수 있게 한다 (선택적).

> **v1 비구현:** master plan이 언급한 SearchPalette, ModalHost, ToastHost는 v1 범위 밖. 본 SPEC은 PersonaBar + Sidebar + landing만. SearchPalette는 future SPEC.

---

## §4 Non-Functional Requirements

### REQ-V3-PER-NFR-001: 성능

**THE SYSTEM SHALL** PersonaBar 초기 렌더링을 500ms 이내에 완료한다 (서버 사이드 tier 파생 + 클라이언트 hydration).

**THE SYSTEM SHALL** tier 전환 시 전체 페이지 리로드 없이 클라이언트 사이드에서 Sidebar/landing을 재렌더링한다 (쿠키만 갱신, navigation 없음).

### REQ-V3-PER-NFR-002: 보안

**THE SYSTEM SHALL** `regula-persona` 쿠키 값을 신뢰하지 않고, 매 요청마다 `session.user.role`에서 tier를 재파생하여 쿠키 값을 검증한다 (쿠키 변조 방지 — REQ-V3-PER-004 강제).

**THE SYSTEM SHALL** 쿠키에 `httpOnly: false`를 사용하되(클라이언트 읽기 필요), tier 권한 상승은 서버가 거부한다.

### REQ-V3-PER-NFR-003: 유지보수성

**THE SYSTEM SHALL** `lib/auth/persona.ts`를 단일 책임 순수 함수로 유지한다 — `personaTier(role): Tier`, `isValidTierForRole(role, tier): boolean`, 쿠키 유틸. 부작용 없음.

**THE SYSTEM SHALL** PersonaBar 컴포넌트를 presentation-only로 유지하고, tier 상태 관리는 `layout.tsx`가 서버 사이드에서 주입.

### REQ-V3-PER-NFR-004: 비회귀

**THE SYSTEM SHALL** 기존 `pnpm test` full suite (특히 `frontend-shell.test.ts`, SPEC-REGULA-* / SPEC-V3-* 테스트)가 모두 통과한다 — Sidebar 수정은 additive, 라우트 변경 없음.

---

## §5 Data Model

본 SPEC은 DB 스키마를 정의하지 않는다 (Tier는 클라이언트 사이드 derivation). 다음 타입만 사용한다:

```ts
// lib/auth/persona.ts
type Tier = 'employee' | 'ra' | 'admin';

// Pure derivation from existing Role (no DB/session changes)
export function personaTier(role: Role): Tier;
export function isValidTierForRole(role: Role, tier: Tier): boolean;

// Cookie utils (mirrors regula-locale pattern)
export const PERSONA_COOKIE = 'regula-persona';
export function readPersonaCookie(cookieStore: ReadonlyRequestCookies): Tier | null;
export function writePersonaCookie(tier: Tier): void;
```

---

## §6 API Contract

본 SPEC은 API를 정의하지 않는다. PersonaBar는 순수 클라이언트 사이드 상태(cookie)이며, 백엔드 API 호출 없음.

---

## §7 Dependencies

### 7.1 Internal
- `@/lib/auth` (`auth()`, `session.user.role`) — 서버 사이드 역할 읽기.
- `@/lib/auth/rbac` (`Role`, `ROLE_HIERARCHY`, `hasRole`) — tier 파생 입력.
- `components/shell/Sidebar.tsx` — `tier` prop additive 확장.
- `components/shell/Topbar.tsx` — PersonaBar 배치 위치.
- `next-intl` — i18n.
- Tailwind v4 `@theme` — design tokens.

### 7.2 External
- Radix UI `Tabs` primitive — 접근성 있는 tier 전환 (선택).

### 7.3 NOT Imported
- `/api/persona` — 백엔드 API 없음 (tier는 클라이언트 derivation).
- localStorage / Zustand — SSR 불가 / 과잉 추상화 (research.md §6-A4).

---

## §8 Exclusions (What NOT to Build)

[HARD] 본 SPEC의 제외 항목:

1. **23개 페르소나 화면(Ask, MyQuestions, Products, Guides, Submissions, Registry, Radar, Admin 12종)** — 개별 화면은 별도 SPEC. 본 SPEC은 shell 인프라만.
2. **라우트 그룹 재구성(`(employee)|(ra)|admin`)** — SPEC-V3-ROUTE-REORG-001로 이월. 기존 flat 라우트 보존 (research.md §6-A3). 마스터 플랜의 풀 재구성 제안을 **거부**하고 incremental 접근 채택.
3. **백엔드 변경(migration, schema, RBAC enum, audit)** — Tier는 순수 클라이언트 derivation.
4. **Employee Impact self-check 페이지 게이트 완화** — 현재 `impact.view`(`minRole: ra-member`)가 Employee tier 차단. 완화는 SPEC-V3-EMPLOYEE-IMPACT-001로 이월 (research.md §6-A2).
5. **Admin view-as / impersonation** — future SPEC (REQ-V3-PER-009로 명시만).
6. **SearchPalette / ModalHost / ToastHost** — future SPEC (REQ-V3-PER-010으로 명시만).

---

## §9 Open Questions (Run-Phase Resolution)

| ID | Question | Default | Plan-auditor focus |
|---|---|---|---|
| OQ-1 | tier 불일치 시 UX(숨김 vs 비활성 배지) 확정 | 비활성 + 툴팁 | 접근성 / 혼란 방지 |
| OQ-2 | PersonaBar 배치 위치(Topbar 내장 vs 독립 행) | Topbar 우측 | 레이아웃 일관성 |
| OQ-3 | Employee tier의 Impact 진입점 처리(placeholder vs 숨김) | placeholder "RA 문의" CTA | A2 정렬 |
| OQ-4 | `phase: D` 라벨 roadmap 교차 검증 | orchestrator 지시 따름 | — |

---

## §10 Implementation Notes (Run Phase, 2026-07-06)

**M1-M6 구현 완료** (본 PR). 프론트엔드 additive 확장, 백엔드/migration 비파괴.

### 핵심 설계 결정 (구현)
1. **resolveTier SSR canonical path** (`lib/auth/persona.ts`): 매 요청 `session.user.role`에서 tier 재파생 + 쿠키 변조 거부. `layout.tsx`/`page.tsx`가 단일 진입점 (REQ-V3-PER-004/NFR-002).
2. **PersonaBarClient router.refresh()**: tier 전환 시 쿠키 write + local state + `router.refresh()` (풀 리로드 없이 server components 재평가, REQ-NFR-001). Context/Store 불필요, hydration 안전.
3. **Sidebar additive tier filter** (`hidePersonaScopedItems`): employee tier 시 show* 변수 오버라이드. 렌더링 로직 변경 0, primary NAV_ITEMS 보존 (H4 `navLinks.length===4` 비회귀).
4. **prop명 `userRole`** (not `role`): biome `useValidAriaRole`이 JSX `role` attribute를 ARIA role로 오인 → prop명 변경으로 근본 해결.

### 보안 불변량 (REQ-V3-PER-004)
- tier는 **view-only** 클라이언트 파생. 서버 `withPermission`/`hasRole`은 항상 `session.user.role` 기준 (PersonaBar 전환과 무관).
- 쿠키 변조: viewer + `regula-persona=admin` → resolveTier가 employee로 폴백 (persona.test.ts 22개 검증).
- PersonaBarClient 이중 방어: `isValidTierForRole` 재확인 (PersonaBarClient.test.tsx 4개).

### 게이트 직검 (orchestrator, L-007/L-013/L-015)
- typecheck EXIT 0 / lint(biome+lint:hex) **0 errors** / ci:i18n ko/en parity / ci:contrast dark-mode / ci:build(next build) 전 라우트 성공.
- full vitest **4659 passed** (1 flaky `frontend-shell root layout metadata timeout` — 사전 존재, 단독 19/19 통과, 본 작업 무관).
- 신규 테스트 71: persona 22 + PersonaBar 21 + PersonaBarClient 4 + Sidebar.tier 5 + frontend-shell 비회귀 19.

### REQ 충족도
- 001 PersonaBar ✓ / 002 Sidebar 필터 ✓ / 003 랜딩 분기 ✓ / 004 RBAC 불변 ✓ / 005 cookie 영속 ✓ / 006 a11y ✓ / 007 i18n ✓ / 008 비회귀 ✓
- 009 View-as DEFERRED (future SPEC) / 010 SearchPalette DEFERRED (future SPEC)
- NFR-001 성능(router.refresh) ✓ / NFR-002 보안(쿠키 검증) ✓ / NFR-003 유지보수성(pure fn) ✓ / NFR-004 비회귀 ✓

### Follow-up (별도 SPEC)
- SPEC-V3-ROUTE-REORG-001: 마스터 plan의 route reorg (본 SPEC additive 접근으로 이월).
- View-as (REQ-009): future SPEC.

---

**생성일:** 2026-07-06
**버전:** 0.2.0
**상태:** completed
**총 REQ:** 10 functional (8 mandatory + 2 optional/deferred) + 4 NFR
**run phase 완료:** 2026-07-06 (M1-M6, 프론트엔드 additive, 백엔드 비파괴)
