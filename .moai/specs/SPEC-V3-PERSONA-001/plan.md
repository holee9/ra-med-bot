# SPEC-V3-PERSONA-001 — Implementation Plan

---
**SPEC ID:** SPEC-V3-PERSONA-001
**Version:** 0.1.0
**Status:** planned
**Phase:** D
**Created:** 2026-07-06
---

## §1 Overview

v3 Phase D **3-Tier PersonaBar** 구현 계획. 전사 직원(Employee) / RA 담당자(RA) / 관리자(Admin) 3-tier 페르소나 전환 레이어를 기존 shell에 **incremental**하게 추가한다. 마스터 플랜의 풀 라우트 재구성(`(employee)|(ra)|admin`)은 **거부**하고, 점진적 composition 접근을 취한다 (research.md §6-A3).

**핵심 목표:**
- `<PersonaBar />` 컴포넌트 — 3-tier 전환 (view-only)
- `lib/auth/persona.ts` — tier 파생 순수 함수 + 쿠키 유틸
- Sidebar persona-aware 확장 (additive, 비파괴)
- 홈 페이지 tier별 랜딩 분기
- i18n + WCAG 2.1 AA 접근성
- 기존 라우트/RBAC/테스트 비회귀 보장

**TDD 기본:** quality.yaml `development_mode: tdd`에 따라 RED-GREEN-REFACTOR. brownfieldEnhancement: 기존 Sidebar(482L) / layout(150L) / page(248L) 사전 독해 (Pre-RED).

---

## §2 Implementation Milestones

### Milestone 1: persona.ts — Tier 파생 유틸 + 테스트 (Priority: High)

**목표:** `lib/auth/persona.ts` 순수 함수 + `regula-persona` 쿠키 유틸

**작업 항목:**
1. `lib/auth/persona.ts` 신규:
   - `type Tier = 'employee' | 'ra' | 'admin'`
   - `personaTier(role: Role): Tier` — verified mapping (research.md §2.3):
     - `viewer`, `auditor` → `'employee'`
     - `ra-member`, `qa-lead`, `ra-lead` → `'ra'`
     - `admin` → `'admin'`
   - `isValidTierForRole(role: Role, tier: Tier): boolean` — 전환 권한 검증
   - `PERSONA_COOKIE = 'regula-persona'`
   - `readPersonaCookie(cookieStore): Tier | null` — `cookies()`에서 읽기
   - `writePersonaCookie(tier: Tier)` — `document.cookie` 설정 (path=/, sameSite=lax, 30일)
2. 단위 테스트 `lib/auth/__tests__/persona.test.ts`:
   - `personaTier` 6종 역할 매핑 단언 (특히 `qa-lead`→RA, `auditor`→Employee)
   - `isValidTierForRole` 분기 (viewer+admin=false, admin+employee=true 등)
   - 쿠키 읽기/쓰기 mock

**산출물:**
- `lib/auth/persona.ts`
- `lib/auth/__tests__/persona.test.ts`

**완료 기준:**
- [ ] `personaTier` 6종 역할 매핑이 research.md §2.3과 정확히 일치
- [ ] `isValidTierForRole`이 권한 상승 시도를 거부
- [ ] 단위 테스트 통과

**의존성:**
- `@/lib/auth/rbac` (`Role`)

### Milestone 2: PersonaBar 컴포넌트 + i18n (Priority: High)

**목표:** 3-tier 전환 UI 컴포넌트 + i18n 키

**작업 항목:**
1. `components/shell/PersonaBar.tsx` 신규 ('use client'):
   - props: `currentTier: Tier`, `role: Role`, `onTierChange: (tier: Tier) => void`
   - 3개 버튼(Employee/RA/Admin)을 `role="tablist"`/`role="tab"` ARIA 패턴
   - `isValidTierForRole(role, tier)`로 버튼 활성/비활성 결정
   - 비활성 버튼: `disabled` + `aria-disabled` + 툴팁(i18n `persona.tierLocked`)
   - 활성 버튼: `aria-selected="true"`
   - 키보드: Tab 이동, Enter/Space 선택
2. i18n 키 추가:
   - `messages/ko.json`: `persona.tier.employee`="전사 직원", `persona.tier.ra`="RA 담당자", `persona.tier.admin`="관리자", `persona.tierLocked`="권한이 없는 tier입니다"
   - `messages/en.json`: 동일 키 (Employee / RA / Admin)
3. 단위 테스트 `components/shell/__tests__/PersonaBar.test.tsx`:
   - 6종 역할별 활성/비활성 버튼 단언
   - 전환 클릭 → `onTierChange` 콜백 호출
   - 비활성 버튼 클릭 무시
   - ARIA 속성 단언
   - 키보드 탐색

**산출물:**
- `components/shell/PersonaBar.tsx`
- `messages/ko.json`, `messages/en.json` 확장
- `components/shell/__tests__/PersonaBar.test.tsx`

**완료 기준:**
- [ ] AC-PER-01 (3-tier 렌더링) 통과
- [ ] AC-PER-06 (접근성 ARIA) 통과
- [ ] AC-PER-07 (i18n ko/en) 통과
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 1 (`personaTier`, `isValidTierForRole`)
- `next-intl`
- Radix UI `Tabs` (선택) 또는 네이티브 button + ARIA

### Milestone 3: Sidebar persona-aware 확장 (Priority: High)

**목표:** Sidebar에 `tier` prop 추가, tier별 NAV 필터 (비파괴 additive)

> **H3 — 비파괴 확장 (run-phase 주의):** Sidebar는 이미 `userRole` prop으로 NAV를 필터 중이다 (line 79). 새 `tier` prop은 **additive**. 기존 `show*` props, `NAV_ITEMS`, `userRole`을 **삭제하지 않는다**. 제거 시 SPEC-REGULA-* / SPEC-V3-* 테스트가 깨진다.

**작업 항목:**
1. `components/shell/Sidebar.tsx` 수정 (additive):
   - `SidebarProps`에 `tier?: Tier` 추가 (선택 prop — undefined 시 기존 동작 유지)
   - tier 정의 시, tier별 우선 NAV 섹션 렌더링 (Employee: Ask/MyQuestions/Products/Guides, RA: Inbox/Consult/Impact/Knowledge, Admin: Users/Corpus/Audit/Settings)
   - 기존 `NAV_ITEMS`(홈/새상담/히스토리/설정)는 tier 무관 항상 노출
   - 기존 `show*` props는 그대로 유지 (tier 필터와 병렬 동작)
   - tier에 속하지 않은 항목은 숨김 또는 비활성 배지 (UX는 run-phase 확정, OQ-1)
2. 단위 테스트 `components/shell/__tests__/Sidebar.tier.test.tsx` (기존 테스트 파일과 별개):
   - `tier="employee"` / `tier="ra"` / `tier="admin"` 각각 NAV 필터링 단언
   - `tier` undefined 시 기존 동작 유지 (비회귀)
   - 기존 `show*` props가 tier와 함께 동작

**산출물:**
- `components/shell/Sidebar.tsx` (수정, additive)
- `components/shell/__tests__/Sidebar.tier.test.tsx`

**완료 기준:**
- [ ] AC-PER-04 (tier별 Sidebar 필터) 통과
- [ ] 기존 `frontend-shell.test.ts` 통과 (비회귀)
- [ ] 기존 `show*` / `NAV_ITEMS` / `userRole` prop 제거 없음 (코드 검사)

**의존성:**
- Milestone 1 (`Tier` 타입)
- 기존 `Sidebar.tsx` (482L, 비파괴 확장)

### Milestone 4: layout + page — 서버 사이드 tier 주입 + 랜딩 분기 (Priority: High)

**목표:** `layout.tsx`에서 tier 파생 → PersonaBar + Sidebar 전달, `page.tsx` tier별 랜딩 분기

**작업 항목:**
1. `app/(app)/layout.tsx` 수정:
   - `auth()` 후 `personaTier(userRole)`로 tier 파생
   - `readPersonaCookie(cookieStore)`로 쿠키 읽기 — 단, `isValidTierForRole(userRole, cookieTier)` 검증 후 폴백 (변조 방지)
   - `<PersonaBar currentTier={...} role={userRole} onTierChange={...} />` 배치 (Topbar 내 또는 독립 행 — OQ-2)
   - `<Sidebar tier={tier} ...기존 props />` 전달
2. `app/(app)/page.tsx` 수정:
   - 기존 `ROLE_ENTRIES` 위에 tier 분기 추가
   - `tier === 'employee'` → Employee 진입점 (Ask, Impact placeholder, Products)
   - `tier === 'ra'` → RA 진입점 (Inbox, Consult, Triage)
   - `tier === 'admin'` → Admin 진입점 (Users, Corpus, Audit)
3. 단위 테스트:
   - `app/(app)/__tests__/layout.tier.test.tsx` — tier 파생 + 쿠키 폴백 + 변조 거부
   - `app/(app)/__tests__/page.tier.test.tsx` — tier별 랜딩 섹션 렌더링

**산출물:**
- `app/(app)/layout.tsx` (수정)
- `app/(app)/page.tsx` (수정)
- 단위 테스트 2종

**완료 기준:**
- [ ] AC-PER-02 (전환 동작) 통과
- [ ] AC-PER-03 (tier별 랜딩 분기) 통과
- [ ] AC-PER-05 (서버 사이드 RBAC 불변) 통과 — 보안 핵심
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 1 (`personaTier`, `readPersonaCookie`, `isValidTierForRole`)
- Milestone 2 (`PersonaBar`)
- Milestone 3 (`Sidebar` tier prop)

### Milestone 5: 접근성 + 다크 모드 + 보안 E2E (Priority: High)

**목표:** WCAG 2.1 AA + 다크 모드 + 쿠키 변조 보안 E2E

**작업 항목:**
1. PersonaBar ARIA 점검 (M2에서 구현, M5에서 audit):
   - `jest-axe` 자동 접근성 audit
   - 키보드 탐색: Tab/Shift+Tab/Enter/Space
2. 다크 모드 렌더링 검증:
   - PersonaBar 활성/비활성 색상 light/dark 대비
   - `ci:contrast` 게이트 통과
3. 보안 E2E (Playwright):
   - `viewer` + `regula-persona=admin` 쿠키 변조 → `/admin` 접근 → 거부 단언
   - Employee tier → `/inbox` 딥링크 → redirect 단언
   - RA tier → `/admin/users` 딥링크 → redirect 단언
4. 모바일 collapse 테스트 (viewport 375px)
5. locale 전환 중 tier 영속 테스트

**산출물:**
- 접근성 audit 결과
- E2E 테스트 시나리오 3종 (보안 핵심)
- 다크 모드 / 모바일 테스트

**완료 기준:**
- [ ] AC-PER-05 (서버 사이드 RBAC 불변) E2E 통과 — 보안 불변량
- [ ] AC-PER-06 (접근성) 통과
- [ ] Edge Case 1-8 모두 테스트 커버

**의존성:**
- Milestone 4

### Milestone 6: 비회귀 full suite + 통합 (Priority: High)

**목표:** 기존 라우트/컴포넌트/테스트 비회귀 보장

**작업 항목:**
1. `pnpm test` full suite 실행 (L-009):
   - 특히 `frontend-shell.test.ts`, SPEC-REGULA-* / SPEC-V3-* 테스트 통과
2. `pnpm lint` (lint:hex) 실행 (L-008)
3. diff에서 기존 `app/(app)/` 라우트 디렉토리 이동/이름 변경 부재 확인
4. Sidebar 수정이 additive임을 코드 검사 (`show*` / `NAV_ITEMS` / `userRole` prop 제거 없음)
5. 통합 시나리오:
   - 6종 역할 × 3 tier 매트릭스 (PersonaBar + Sidebar + landing)
   - tier 전환 → 쿠키 설정 → 새로고침 → tier 복원
   - locale 전환 중 tier 독립성

**산출물:**
- 비회귀 테스트 결과
- 통합 시나리오 결과

**완료 기준:**
- [ ] AC-PER-08 (비회귀) 통과
- [ ] `pnpm test` full 통과
- [ ] `pnpm lint` 통과
- [ ] 기존 라우트 변경 부재 (diff 검사)

**의존성:**
- Milestone 5

---

## §3 New and Modified Files

### 신규 파일 (New Files)

**persona 유틸:**
```
lib/auth/
├── persona.ts                              # M1: tier 파생 + 쿠키 유틸
└── __tests__/
    └── persona.test.ts                     # M1: 6종 역할 매핑
```

**PersonaBar 컴포넌트:**
```
components/shell/
├── PersonaBar.tsx                          # M2: 3-tier 전환 UI
└── __tests__/
    ├── PersonaBar.test.tsx                 # M2: 렌더링/전환/ARIA
    └── Sidebar.tier.test.tsx               # M3: tier prop별 NAV 필터
```

**layout/page 테스트:**
```
app/(app)/
└── __tests__/
    ├── layout.tier.test.tsx                # M4: tier 파생 + 쿠키 폴백
    └── page.tier.test.tsx                  # M4: tier별 랜딩
```

### 수정 파일 (Modified Files)

**additive 수정:**
```
components/shell/Sidebar.tsx                # M3: tier prop 추가 (비파괴, 기존 props 유지)
app/(app)/layout.tsx                        # M4: personaTier 파생 + PersonaBar/Sidebar 전달
app/(app)/page.tsx                          # M4: tier별 랜딩 분기 (ROLE_ENTRIES 위)
```

**i18n:**
```
messages/ko.json                            # M2: persona.* 키 추가
messages/en.json                            # M2: 동일
```

### 수정 금지 / Out of Scope (변경 시 머지 불가)

- `app/(app)/` 기존 flat 라우트 디렉토리(admin, audit, chat, consult, dashboard, history, impact, inbox, knowledge, settings, triage 등 25+) — 이동/이름 변경/그룹화 금지
- `lib/auth/rbac.ts` — `Role` union, `ROLE_HIERARCHY`, `hasRole` 변경 금지
- `lib/auth/permissions.ts` — `PERMISSION_MAP` 변경 금지
- `lib/db/schema.ts` — frozen
- 백엔드 API 라우트 — frozen
- 기존 SPEC-REGULA-* / SPEC-V3-* 컴포넌트 — 비회귀

---

## §4 Technical Approach

### 아키텍처 패턴

**서버 사이드 tier 파생 + 클라이언트 전환 (기존 layout 패턴 준용):**
```
app/(app)/layout.tsx (server)
    ↓ auth() → session.user.role
    ↓ personaTier(role) → Tier (verified derivation)
    ↓ readPersonaCookie(cookies()) → 쿠키 tier (검증 후 폴백)
    ↓ isValidTierForRole(role, cookieTier) → 변조 방지
    ↓ <PersonaBar currentTier={tier} role={role} onTierChange={...} />
    ↓ <Sidebar tier={tier} ...기존 show* props />
    ↓ <main>{children}</main>

app/(app)/page.tsx (server)
    ↓ auth() → role → personaTier(role) → Tier
    ↓ tier 분기: employee / ra / admin 랜딩 섹션
    ↓ 기존 ROLE_ENTRIES 재사용
```

**상태 관리:**
- tier 상태: `regula-persona` 쿠키 (서버 사이드 읽기, SSR 일관성)
- 전환: PersonaBar 클릭 → 쿠키 설정 → 클라이언트 재렌더링 (페이지 리로드 없음)
- 전역 상태(Zustand/Jotai) 불필요 — 과잉 추상화 방지 (Charter [지양-5]).

### Tier composition diagram

```
┌────────────────────────────────────────────────────────────────┐
│ Role (rbac.ts)                                                  │
│ admin(4) > ra-lead(3) > qa-lead(2.5) > ra-member(2) >           │
│ viewer(1) > auditor(0.5)                                        │
└──────────────────┬─────────────────────────────────────────────┘
                   │ personaTier(role) — pure function
                   ▼
┌────────────────────────────────────────────────────────────────┐
│ Tier (persona.ts)                                               │
│ ┌──────────┬─────────────────┬────────┐                         │
│ │ employee │ ra              │ admin  │                         │
│ │ viewer,  │ ra-member,      │ admin  │                         │
│ │ auditor  │ qa-lead,        │        │                         │
│ │          │ ra-lead         │        │                         │
│ └──────────┴─────────────────┴────────┘                         │
└──────────────────┬─────────────────────────────────────────────┘
                   │ PersonaBar view-only switch
                   ▼
┌────────────────────────────────────────────────────────────────┐
│ View Layer (PersonaBar + Sidebar + landing)                     │
│ • Sidebar NAV 필터 (tier별 우선 항목)                            │
│ • page.tsx 랜딩 분기                                             │
│ • 단, 서버 RBAC는 실제 role 기준 (tier 무관)                     │
└────────────────────────────────────────────────────────────────┘
```

### 왜 incremental인가 (마스터 플랜 거부 근거)

| 항목 | 마스터 플랜 (route reorg) | 본 SPEC (incremental) |
|---|---|---|
| 라우트 디렉토리 | 25+ 이동 (3 그룹) | 0 변경 |
| `<Link href>` 참조 | 50+ 갱신 | 0 갱신 |
| E2E 테스트 | 10+ 깨짐 | 0 깨짐 |
| RBAC 게이트 | 모두 재작업 | 0 변경 |
| 회귀 위험 | HIGH | LOW (additive) |
| Charter 가치 전달 | 80% (전체 완성 시) | 80% (shell 인프라) |
| 일정 | 큼 | 작음 |

→ 6-8인 내부 팀에 incremental이 적합. route reorg는 SPEC-V3-ROUTE-REORG-001로 이월.

### 데이터 흐름

**정상 플로우 (전환):**
```
PersonaBar 클릭 (RA tier 선택)
    ↓
onTierChange('ra')
    ↓
writePersonaCookie('ra') → document.cookie = 'regula-persona=ra; ...'
    ↓
클라이언트 재렌더링 (Sidebar tier prop 갱신)
    ↓
페이지 리로드 없이 NAV 필터 변경
```

**새로고침 플로우 (영속):**
```
layout.tsx (SSR)
    ↓ auth() → role
    ↓ personaTier(role) → 기본 tier
    ↓ readPersonaCookie(cookies()) → 쿠키 tier
    ↓ isValidTierForRole(role, 쿠키 tier)?
    │   YES → 쿠키 tier 사용
    │   NO  → 기본 tier 폴백 (변조 방지)
    ↓ <PersonaBar currentTier={...} /> + <Sidebar tier={...} />
```

---

## §5 Testing Strategy

### 단위 테스트 (Vitest + RTL)

**목표 커버리지:** 85% 이상

**Mock 패턴:**
```ts
vi.mock('next-intl', () => ({ useTranslations: () => (key) => key }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
```

**테스트 대상:** §3 신규 파일 목록 참조.

### 보안 테스트 (핵심 — 머지 게이트)

**쿠키 변조 시나리오:**
1. `viewer` 역할 + `regula-persona=admin` 쿠키 → `/admin` 접근 → 거부
2. `viewer` + `regula-persona=ra` → `/inbox` 접근 → 거부
3. 쿠키 삭제 → 역할 기본 tier로 폴백

→ AC-PER-05 단언. 실패 시 머지 불가 (보안 불변량).

### 접근성 테스트

- `jest-axe` 자동 audit
- 키보드 탐색 RTL 시뮬레이션
- `ci:contrast` CI 게이트 통과 (light/dark)

### 비회귀 테스트

- `pnpm test` full suite 통과 (L-009) — 특히 `frontend-shell.test.ts`, SPEC-REGULA-* / SPEC-V3-*
- `pnpm lint` (lint:hex) full 실행 (L-008)
- diff에서 라우트 디렉토리 이동/이름 변경 부재 확인

---

## §6 Risk Mitigation

### 위험 1: 기존 라우트/RBAC 회귀 (마스터 플랜 route reorg)

**완화:**
- incremental 접근 채택 (route reorg 거부, research.md §6-A3)
- 기존 flat 라우트 보존, Sidebar additive 확장
- AC-PER-08 + M6 비회귀 게이트 강제

**검증:** M6 `pnpm test` full + diff 검사.

### 위험 2: PersonaBar 전환으로 RBAC 우회 (보안)

**완화:**
- tier는 view-only (REQ-V3-PER-004)
- 서버는 매 요청마다 `session.user.role`로 RBAC 판정 (쿠키 신뢰 X)
- AC-PER-05 쿠키 변조 시나리오로 보안 불변량 강제

**검증:** M5 보안 E2E (쿠키 변조 3종).

### 위험 3: hydration mismatch (SSR vs 클라이언트 tier)

**완화:**
- 쿠키 사용 (localStorage X) — layout.tsx가 SSR 시 읽음 (research.md §6-A4)
- `regula-locale` 패턴 준용 (layout.tsx:118 입증)
- M4 layout 테스트에서 hydration 일관성 단언

**검증:** M4 `layout.tier.test.tsx` SSR 단언.

### 위험 4: Sidebar 기존 테스트 깨짐 (show* prop 제거)

**완화:**
- `tier` prop은 **선택**(optional) — undefined 시 기존 동작 유지
- 기존 `show*` / `NAV_ITEMS` / `userRole` prop 제거 금지 (H3)
- M3 `Sidebar.tier.test.tsx`를 기존 테스트와 별개 파일로 작성

**검증:** M6 `frontend-shell.test.ts` 통과.

### 위험 5: Employee Impact 접근 (A2 tension)

**완화:**
- v1은 Employee tier의 Impact 진입점을 placeholder("RA 문의" CTA)로 표시
- 페이지 게이트 완화(`impact.view` ra-member → viewer)는 SPEC-V3-EMPLOYEE-IMPACT-001로 이월
- 본 SPEC은 게이트 변경 없음

**검증:** M4 page 테스트에서 Employee Impact placeholder 단언.

### 위험 6: qa-lead / auditor tier 매핑 혼동

**완화:**
- research.md §2.3 명시: qa-lead=RA, auditor=Employee
- M1 `persona.test.ts`에서 6종 역할 매핑 단언 (특히 qa-lead≠Admin, auditor≠RA)
- AC-PER-01 Edge Case 1 단언

**검증:** M1 단위 테스트.

---

## §7 Dependencies Mapping

### 내부 의존성

| 의존 대상 | 용도 | Milestone |
|---|---|---|
| `@/lib/auth` (`auth()`) | 서버 사이드 역할 읽기 | M4 |
| `@/lib/auth/rbac` (`Role`, `ROLE_HIERARCHY`) | tier 파생 입력 | M1 |
| `components/shell/Sidebar.tsx` (기존 482L) | tier prop additive 확장 | M3 |
| `components/shell/Topbar.tsx` | PersonaBar 배치 | M4 |
| `next-intl` | i18n | M2 |
| Tailwind v4 `@theme` | 디자인 토큰 | M2 |
| 기존 `app/(app)/page.tsx` `ROLE_ENTRIES` | tier 랜딩 분기 재사용 | M4 |

### 외부 의존성

| 의존 대상 | 용도 | 버전 |
|---|---|---|
| Radix UI `Tabs` (선택) | 접근성 tier 전환 | 기존 사용 버전 |
| `jest-axe` / `@axe-core/playwright` | 접근성 audit | 기존 설정 |

### 외부 의존성이 아닌 것 (NOT Imported)

- `/api/persona` — 백엔드 API 없음 (tier는 클라이언트 derivation)
- localStorage / Zustand / Jotai — SSR 불가 / 과잉 추상화
- ESIG / impersonation 백엔드 — future SPEC

### 상위 SPEC 의존성 (depends_on)

- **SPEC-V3-UI-001** (parent) — consult UI 패턴(TanStack Query provider, design tokens, i18n 네임스페이스) 참조. PersonaBar는 동일 패턴 준용.
- **SPEC-V3-CONSULT-001** — consult 라우트가 RA tier NAV에 포함됨 (비회귀 대상).
- **SPEC-V3-INBOX-001** — inbox 라우트가 RA tier NAV에 포함됨.
- **SPEC-V3-IMPACT-UI-001** — impact 라우트가 RA tier NAV에 포함됨. Employee tier는 placeholder (A2).

---

## §8 Open Questions (Run-Phase Resolution)

| ID | Question | Default | Owner |
|---|---|---|---|
| OQ-1 | tier 불일치 UX(숨김 vs 비활성 배지) | 비활성 + 툴팁 | run phase: UX 확정 |
| OQ-2 | PersonaBar 배치(Topbar 내장 vs 독립 행) | Topbar 우측 | run phase: 레이아웃 확정 |
| OQ-3 | Employee Impact 진입점(placeholder vs 숨김) | placeholder "RA 문의" | run phase: UX 확정 (A2 정렬) |
| OQ-4 | `phase: D` 라벨 roadmap 교차 검증 | orchestrator 지시 따름 | plan-auditor |

---

**생성일:** 2026-07-06
**버전:** 0.1.0
**상태:** planned
**총 Milestones:** 6개
**예상 완료:** Phase D 종료 시점
