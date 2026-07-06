# SPEC-V3-PERSONA-001 — Acceptance Criteria

---
**SPEC ID:** SPEC-V3-PERSONA-001
**Version:** 0.1.0
**Status:** planned
**Phase:** D
**Created:** 2026-07-06
---

## §1 Acceptance Criteria

> 모든 AC는 observable evidence를 포함한다. Tier derivation은 `lib/auth/rbac.ts:16-26`의 `ROLE_HIERARCHY`에 근거한다 (research.md §2.3 직검 검증).

### AC-PER-01: PersonaBar 3-Tier 렌더링 (REQ-V3-PER-001)

**Given** `ra-member` 역할 사용자가 인증된 상태에서
**When** 앱 셸(`/`)에 진입하면
**Then** PersonaBar가 3개 tier 버튼(Employee / RA / Admin)을 렌더링하고, RA 버튼이 `aria-selected="true"` 활성 상태로 표시된다.

**Given** `viewer` 역할 사용자가
**When** PersonaBar가 렌더링되면
**Then** Employee 버튼만 활성화되고 RA/Admin 버튼은 `disabled` 속성과 "권한 없음" 툴팁(i18n 키 `persona.tierLocked`)을 표시한다.

**Given** `admin` 역할 사용자가
**When** PersonaBar가 렌더링되면
**Then** 세 tier 버튼 모두 활성화된다.

**Evidence:** RTL — 6종 역할(`auditor`, `viewer`, `ra-member`, `qa-lead`, `ra-lead`, `admin`) 각각에 대해 PersonaBar 렌더링 + 버튼 활성/비활성 상태 단언. 특히 `qa-lead`가 RA tier(Admin 아님), `auditor`가 Employee tier(RA 아님)로 매핑됨을 단언.

### AC-PER-02: Persona 전환 동작 (REQ-V3-PER-001, PER-005)

**Given** `ra-member` 사용자가 RA tier에서 Employee tier 버튼을 클릭하면
**When** 전환 이벤트가 발생하면
**Then** `regula-persona=employee` 쿠키가 설정되고, Sidebar가 Employee 대상 항목으로 필터링되며, 활성 tier가 Employee로 변경된다.

**Given** `ra-member` 사용자가 Admin tier 버튼을 클릭하면
**When** 버튼이 `disabled` 상태이면
**Then** 클릭이 무시되고 쿠키/Sidebar/활성 tier가 변경되지 않는다.

**Given** 사용자가 페이지를 새로고침하면
**When** SSR이 `regula-persona` 쿠키를 읽으면
**Then** 이전에 선택한 tier가 복원되고 hydration mismatch 없이 렌더링된다.

**Evidence:** RTL — `fireEvent.click` + `document.cookie` 단언 + `rerender`로 새로고침 시뮬레이션. SSR 단언은 layout 테스트에서 `cookies()` mock으로 검증.

### AC-PER-03: Tier별 랜딩 분기 (REQ-V3-PER-003)

**Given** `viewer` 역할 사용자가 `/`에 진입하면
**When** `personaTier('viewer') === 'employee'`이면
**Then** Employee 랜딩 섹션(Ask / Impact / Products 진입점)이 렌더링된다.

**Given** `ra-lead` 역할 사용자가 `/`에 진입하면
**When** `personaTier('ra-lead') === 'ra'`이면
**Then** RA 랜딩 섹션(Inbox / Consult / Triage 진입점)이 렌더링된다.

**Given** `admin` 역할 사용자가 `/`에 진입하면
**When** `personaTier('admin') === 'admin'`이면
**Then** Admin 랜딩 섹션(Users / Corpus / Audit 진입점)이 렌더링된다.

**Given** 사용자가 PersonaBar로 tier를 전환하면
**When** 홈 `/`로 이동하면
**Then** 전환된 tier에 해당하는 랜딩 섹션이 렌더링된다 (기존 `ROLE_ENTRIES` 위에 tier 분기 추가).

**Evidence:** RTL + `app/(app)/__tests__/page.test.tsx` — 각 tier별 렌더링 단언. 기존 `ROLE_ENTRIES`가 깨지지 않음을 회귀 단언.

### AC-PER-04: Persona 인지 Sidebar 필터 (REQ-V3-PER-002)

**Given** Sidebar가 `tier="employee"` prop으로 렌더링되면
**When** Employee tier 필터가 적용되면
**Then** Employee 대상 NAV(Ask, MyQuestions, Products, Guides)가 우선 노출되고, RA 전용 항목(Inbox, Consult)은 숨김 또는 비활성 배지로 표시된다.

**Given** Sidebar가 `tier="ra"` prop으로 렌더링되면
**When** RA tier 필터가 적용되면
**Then** RA 대상 NAV(Inbox, Consult, Impact, Knowledge)가 노출되고, Admin 전용 항목(Users, Audit)은 비활성 배지로 표시된다.

**Given** Sidebar가 `tier="admin"` prop으로 렌더링되면
**When** Admin tier 필터가 적용되면
**Then** 모든 항목이 노출된다.

**Given** 기존 `NAV_ITEMS`(홈/새상담/히스토리/설정)와 `show*` props가 전달되면
**When** Sidebar가 렌더링되면
**Then** 기존 항목이 **삭제되지 않고** 그대로 유지되며, tier 필터는 additive하게 적용된다 (비파괴 — H3).

**Evidence:** RTL — `tier` prop별 NAV 렌더링 필터 단언 + 기존 `frontend-shell.test.ts` 통과 단언(비회귀).

### AC-PER-05: 서버 사이드 RBAC 불변 (REQ-V3-PER-004) — 보안 핵심

**Given** `viewer` 역할 사용자가 PersonaBar로 "RA" tier를 선택하고(또는 `regula-persona=ra` 쿠키를 수동으로 변조하고)
**When** `/inbox` (RA 전용, `inbox.view` `minRole: ra-member`)로 직접 진입하면
**Then** 서버 사이드 RBAC 게이트가 `hasRole('viewer', 'ra-member') === false`로 판정하여 `/?error=access_denied`로 리다이렉트한다 — PersonaBar 전환 상태와 무관.

**Given** 쿠키 `regula-persona=admin`을 가진 `viewer` 역할 사용자가
**When** `/admin` 라우트로 진입하면
**Then** 서버가 쿠키를 무시하고 역할 기반 게이트(`admin` 전용)로 거부한다.

**Evidence:** E2E (Playwright) + RTL — 쿠키 변조 시나리오에서 RBAC 게이트가 여전히 동작함을 단언. 이 테스트는 **보안 불변량**이며 실패 시 머지 불가.

### AC-PER-06: 접근성 — WCAG 2.1 AA (REQ-V3-PER-006)

**Given** PersonaBar가 렌더링될 때
**When** 접근성 audit을 실행하면
**Then** `role="tablist"` / `role="tab"` / `aria-selected` ARIA 구조가 준수되고, 키보드 Tab/Enter/Space로 tier 전환이 가능하다.

**Given** PersonaBar의 색상 조합이
**When** light/dark 모두에서 대비 검사를 실행하면
**Then** WCAG 2.1 AA 대비(4.5:1 본문, 3:1 대형 텍스트)를 만족한다 (`ci:contrast` 통과).

**Evidence:** `jest-axe` 또는 `@axe-core/playwright` 자동 audit + 키보드 탐색 RTL 시뮬레이션.

### AC-PER-07: 국제화 — ko/en (REQ-V3-PER-007)

**Given** `messages/ko.json`에 `persona.tier.employee`, `persona.tier.ra`, `persona.tier.admin`, `persona.tierLocked` 키가 정의되어 있으면
**When** 한국어 로켈로 PersonaBar가 렌더링되면
**Then** tier 이름이 "전사 직원 / RA 담당자 / 관리자"로 표시된다.

**Given** `messages/en.json`에 동일한 키가 정의되어 있으면
**When** 영어 로켈로 렌더링되면
**Then** "Employee / RA / Admin"으로 표시된다.

**Evidence:** RTL — next-intl mock으로 키 lookup 검증.

### AC-PER-08: 비회귀 — 기존 라우트/컴포넌트 보존 (REQ-V3-PER-008)

**Given** 기존 `app/(app)/` flat 라우트 25+ 디렉토리(admin, audit, chat, consult, dashboard, history, impact, inbox, knowledge, settings, triage 등)가
**When** 본 SPEC 변경 후에도
**Then** 동일한 경로에서 동일한 RBAC 게이트로 동작한다 — 라우트 이동/이름 변경/그룹화 없음.

**Given** 기존 `frontend-shell.test.ts`와 SPEC-REGULA-* / SPEC-V3-* 테스트가
**When** `pnpm test` full suite를 실행하면
**Then** 모두 통과한다 — Sidebar 수정이 additive이고 기존 `show*` / `NAV_ITEMS` / `userRole` prop을 제거하지 않음.

**Evidence:** `pnpm test` full 실행 (L-009) + `pnpm lint` (lint:hex, L-008). diff에서 `app/(app)/` 라우트 디렉토리 이동/이름 변경 부재 단언.

---

## §2 Edge Cases

### Edge Case 1: 역할이 3-tier에 고르게 분포하지 않는 경우 (qa-lead, auditor)

**Given** `qa-lead` 역할(hierarchy 2.5) 사용자가
**When** PersonaBar가 렌더링되면
**Then** RA tier 버튼이 활성화된다 (`personaTier('qa-lead') === 'ra'`). Admin 버튼은 비활성화. — `qa-lead`가 Admin이 아님을 단언 (research.md §2.3 주의).

**Given** `auditor` 역할(hierarchy 0.5) 사용자가
**When** PersonaBar가 렌더링되면
**Then** Employee tier 버튼이 활성화된다 (`personaTier('auditor') === 'employee'`). 기존 write-block(`withPermission`)은 유지되어 audit 엔드포인트 외 쓰기 차단.

### Edge Case 2: Persona 전환 새로고침 영속

**Given** `ra-member` 사용자가 RA에서 Employee tier로 전환 후
**When** 브라우저를 완전히 닫고 다시 열어 `/`에 진입하면
**Then** `regula-persona=employee` 쿠키가 읽혀 Employee tier로 렌더링된다 — 단, `ra-member` 역할이 Employee tier를 유효 범위로 포함하므로 폴백 없이 적용.

**Given** 쿠키 만료(기본 30일) 후
**When** 사용자가 진입하면
**Then** 쿠키가 사라져 역할 기반 기본 tier(`ra`)로 폴백.

### Edge Case 3: 타 tier 라우트 딥링크 — RBAC 유지

**Given** Employee tier(`viewer`) 사용자가 PersonaBar로 Employee를 선택한 상태에서
**When** 주소창에 `/consult` (RA 전용)를 직접 입력하면
**Then** 서버 RBAC 게이트가 `consult.session.view`(`minRole: ra-member`)으로 거부하여 `/?error=access_denied`로 리다이렉트. PersonaBar 전환 상태는 RBAC를 우회하지 않는다 (REQ-V3-PER-004).

**Given** 반대로 RA tier 사용자가 `/admin/users`를 직접 입력하면
**When** 서버가 `auditLogs.view` / `rbac.manage`(`minRole: admin`) 게이트를 실행하면
**Then** 거부된다.

### Edge Case 4: 쿠키 변조 — 권한 상승 시도

**Given** `viewer` 역할 사용자가 브라우저 DevTools로 `regula-persona=admin`을 수동 설정하고
**When** `/admin` 라우트로 진입하면
**Then** 서버가 쿠키를 무시하고 `session.user.role === 'viewer'`로 RBAC 판정하여 거부. 사용자는 PersonaBar에서 Admin 버튼이 여전히 disabled로 표시됨 (SSR이 쿠키를 검증 후 폴백).

### Edge Case 5: 모바일 collapse

**Given** 좁은 화면(모바일)에서
**When** PersonaBar가 렌더링되면
**Then** 3개 버튼이 아이콘 전용(텍스트 숨김) 또는 햄버거 메뉴로 collapse되어도 tier 전환 기능이 유지된다.

### Edge Case 6: 다크 모드 렌더링

**Given** 사용자가 다크 모드를 활성화하면
**When** PersonaBar가 렌더링되면
**Then** tier 버튼 활성/비활성 색상이 다크 모드에서도 WCAG AA 대비를 유지한다 (`ci:contrast` 통과).

### Edge Case 7: 세션 만료 후 전환 시도

**Given** 세션이 만료된 상태에서(로그아웃 후)
**When** 사용자가 PersonaBar 버튼을 클릭하면
**Then** 로그인 페이지로 리다이렉트된다 — PersonaBar는 인증된 사용자만 접근 가능 (`layout.tsx`의 `auth()`가 세션을 확인).

### Edge Case 8: locale 전환 중 tier 영속

**Given** 한국어 로켈에서 RA tier를 선택한 사용자가
**When** 영어로 locale을 전환하면(`regula-locale` 쿠키 변경)
**Then** tier 선택(`regula-persona`)은 독립적으로 유지되어 RA tier가 그대로 적용되고, tier 라벨만 "RA 담당자" → "RA"로 변경.

---

## §3 Quality Gate Criteria

### Definition of Done (DoD)

**SPEC-V3-PERSONA-001은 다음 조건을 모두 충족할 때 "완료"로 간주한다:**

1. **기능 완료:**
   - [ ] 8개 AC (AC-PER-01 ~ AC-PER-08)가 모두 통과한다
   - [ ] PersonaBar 3-tier 전환이 동작한다 (활성/비활성 분기)
   - [ ] tier별 Sidebar 필터가 동작한다 (비파괴 additive)
   - [ ] tier별 랜딩 분기가 동작한다 (기존 ROLE_ENTRIES 위에 tier 분기)
   - [ ] 서버 사이드 RBAC가 PersonaBar와 무관하게 동작한다 (보안 불변량)

2. **i18n:**
   - [ ] `messages/ko.json`에 `persona.*` 키가 정의되었다
   - [ ] `messages/en.json`에 동일 키가 정의되었다
   - [ ] 컴포넌트 내 하드코딩 문자열이 없다

3. **접근성:**
   - [ ] PersonaBar가 ARIA tablist/tab 패턴을 준수한다
   - [ ] 키보드 전용 탐색이 가능하다
   - [ ] `ci:contrast` 게이트가 통과한다 (WCAG 2.1 AA, light/dark)
   - [ ] 모바일 collapse가 동작한다

4. **비회귀 (항심 게이트):**
   - [ ] 기존 `app/(app)/` flat 라우트가 변경되지 않았다 (이동/이름 변경/그룹화 없음)
   - [ ] 기존 `NAV_ITEMS` 순서(REQ-FND-019)가 유지된다
   - [ ] `frontend-shell.test.ts`가 통과한다
   - [ ] 기존 SPEC-REGULA-* / SPEC-V3-* 테스트가 전체 통과한다
   - [ ] Sidebar 수정이 additive하다 (`show*` / `NAV_ITEMS` / `userRole` prop 제거 없음)

5. **보안:**
   - [ ] 쿠키 변조 시 서버 RBAC가 거부한다 (AC-PER-05 단언)
   - [ ] PersonaBar가 실제 권한을 변경하지 않는다 (view-only)
   - [ ] 쿠키 tier가 역할 범위를 벗어나면 폴백

6. **성능:**
   - [ ] PersonaBar 초기 렌더링 < 500ms
   - [ ] tier 전환 시 페이지 리로드 없음
   - [ ] hydration mismatch 없음

7. **테스트:**
   - [ ] 단위 테스트 커버리지 85% 이상 (`components/shell/__tests__/`, `lib/auth/__tests__/persona.test.ts`)
   - [ ] 8개 edge case 시나리오 테스트 포함
   - [ ] 6종 역할 × 3 tier 매트릭스 단언 (특히 qa-lead=RA, auditor=Employee)

### 테스트 전략

**단위 테스트 (Vitest + RTL):**
- `lib/auth/__tests__/persona.test.ts` — `personaTier(role)` 6종 역할 매핑 + `isValidTierForRole` 분기
- `components/shell/__tests__/PersonaBar.test.tsx` — 렌더링/전환/비활성 분기
- `components/shell/__tests__/Sidebar.tier.test.tsx` — tier prop별 NAV 필터 (기존 `__tests__/Sidebar.test.tsx`와 별개, 비회귀)
- `app/(app)/__tests__/page.tier.test.tsx` — tier별 랜딩 분기

**보안 테스트 (핵심):**
- 쿠키 변조 시나리오 (`regula-persona=admin` in `viewer` 세션) → RBAC 거부 단언
- 딥링크 시나리오 (Employee → `/inbox` 직접 진입) → redirect 단언

**비회귀 테스트:**
- `pnpm test` full suite 통과 (L-009)
- `pnpm lint` (lint:hex) 통과 (L-008)
- `frontend-shell.test.ts` 통과

**Mock 패턴** (`components/consult/__tests__/` 직검 기반):
- `vi.mock('next-intl')` — `useTranslations`
- `vi.mock('@/lib/auth')` — 역할별 `auth()` 반환
- `vi.mock('next/headers')` — `cookies()` mock

**접근성 테스트:**
- `jest-axe` 자동 audit
- 키보드 탐색 RTL 시뮬레이션

---

**생성일:** 2026-07-06
**버전:** 0.1.0
**상태:** planned
**총 AC 개수:** 8개 (AC-PER-01 ~ AC-PER-08)
**총 Edge Cases:** 8개
