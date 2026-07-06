# SPEC-V3-PERSONA-001 — Research (Codebase Analysis)

---
**SPEC ID:** SPEC-V3-PERSONA-001
**Version:** 0.1.0
**Status:** planned
**Phase:** D
**Created:** 2026-07-06
**Author:** manager-spec
**Method:** L-013 direct code inspection (no self-report, no matrix-only reasoning)
---

## §1 Research Scope

Plan-phase deep codebase analysis to ground the **3-tier PersonaBar** SPEC in verified facts. v3 master plan (`docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` §5.1 Phase D-2) assigns "3-tier PersonaBar + components/ 재작성" to a new SPEC. The master plan originally named this `SPEC-V3-UI-001`, but that ID is already taken (M6 RA Power Chat consult UI, completed). This SPEC uses `SPEC-V3-PERSONA-001` to avoid ID collision (research.md §7-A1).

Every persona definition, RBAC tier, route, and Sidebar prop referenced in `spec.md` is traceable to a line in this document.

**Out of scope:** backend changes, DB migration, schema, audit log changes, RBAC enum additions. Tier is a **client-side composition** over the existing `permissions.ts` / `rbac.ts` (read-only derivation).

---

## §2 Verified Role & Tier Foundation

### 2.1 Role union (verified — `lib/auth/rbac.ts:14`)

```ts
export type Role = 'admin' | 'qa-lead' | 'ra-lead' | 'ra-member' | 'viewer' | 'auditor';
```

**NOTE:** The v3 docs (`docs/v3/05_claude_code_playbook.md`, `docs/v3/README.md`) describe "Employee" as a persona. The codebase has **no `employee` role**. The Employee persona maps to the `viewer` role (least-privileged operational role). `auditor` (external read-only inspector) is operationally equivalent to Employee tier for navigation purposes but is gated differently on audit endpoints (`PERMISSIONS[*].additionalRoles`).

### 2.2 Role hierarchy ladder (verified — `lib/auth/rbac.ts:16-26`)

```ts
export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  'ra-lead': 3,
  'qa-lead': 2.5,
  'ra-member': 2,
  viewer: 1,
  auditor: 0.5,
};
```

`hasRole(userRole, required)` returns `ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]` (rbac.ts:32-34).

### 2.3 Tier mapping (derived, VERIFIED derivation)

The 3-tier persona model composes over the 6-role ladder as follows. This is the **single source of truth** for `personaTier(role)`:

| Persona Tier | Roles included | Hierarchy range | Charter mapping |
|---|---|---|---|
| `employee` | `viewer`, `auditor` | 0.5 – 1 | 전사 직원 셀프서비스 (Ask, MyQuestions, Products, Guides, Impact) |
| `ra` | `ra-member`, `qa-lead`, `ra-lead` | 2 – 3 | RA 워크벤치 (Inbox, Consult, Triage, Authoring, Knowledge) |
| `admin` | `admin` | 4 | Admin 감시 (users, corpus, audit logs, settings) |

**NOTE:** `qa-lead` (2.5) maps to RA tier, NOT admin. `qa-lead` performs member-level RA work by default (rbac.ts:19-20 comment: "QA lead can perform member-level work by default"). Signature-only elevation uses `PERMISSIONS[*].additionalRoles` (rbac.ts:20-21).

**NOTE:** `auditor` (0.5) maps to Employee tier for navigation/landing purposes, but remains blocked from all non-audit write endpoints by the `withPermission` write-block (rbac.ts:11-13 comment). The PersonaBar switch does NOT bypass this — server-side RBAC stays authoritative (REQ-V3-PER-004).

### 2.4 Why tier = client-side composition, not a new role enum

Adding a `tier` field to the DB / session / `Role` union would require:
- migration (`lib/db/schema.ts`)
- session extension (`lib/auth`)
- `withPermission` rewrite
- backfill for all existing users

That is a **backend change**, explicitly out of scope for this UI-only SPEC. Instead, `lib/auth/persona.ts` exports a pure function `personaTier(role: Role): 'employee' | 'ra' | 'admin'` that derives the tier from the existing role at render time. This is read-only, non-breaking, and reversible.

---

## §3 Current Navigation Architecture (verified)

### 3.1 Sidebar (`components/shell/Sidebar.tsx`, 482 lines)

**NAV_ITEMS (lines 24-29, verified):**
```ts
const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/', minRole: 'viewer' },
  { label: '새 상담', href: '/chat', testId: 'nav-chat', minRole: 'viewer' },
  { label: '히스토리', href: '/history', minRole: 'viewer' },
  { label: '설정', href: '/settings', minRole: 'viewer' },
];
```

**~13 `show*` props (lines 33-81, verified):** `showExpertReview`, `showPredicate`, `showKnowledgeGap`, `showClassify`, `showTraceability`, `showStandards`, `showChangeControl`, `showLabeling`, `showClinicalInvestigation`, `showGovernance`, `showQualityHeatmap`, `showTeamKnowledge`, `showAuthoring`, `showEvidence`, `showInbox`, `showConsult`. Each has an `// @MX:NOTE` or SPEC comment documenting its permission gate.

**`userRole` prop (line 79, verified):** Added 2026-06-29 ("사이드바 3계층: NAV_ITEMS를 userRole로 필터"). This is the **existing** persona-awareness hook — Sidebar already filters `NAV_ITEMS` by role. The new PersonaBar extends this same pattern.

### 3.2 Layout (`app/(app)/layout.tsx`, 150 lines)

Server component. Calls `auth()` (dynamic import, line 61), reads `session.user.role`, computes all 16 `show*` flags via `hasRole(userRole, '<minRole>')` (lines 66-100), and passes them to `<Sidebar>` (lines 122-141). Also reads `regula-locale` cookie for i18n (line 118).

**This is the proven pattern for server-side RBAC composition.** PersonaBar tier detection MUST follow the same `auth()` + `hasRole` approach in the layout, then pass `tier` as a prop to the client PersonaBar.

### 3.3 Home page (`app/(app)/page.tsx`, 248 lines)

**Already has role-based branching** (lines 18-40, verified): `ROLE_ENTRIES: Record<Role, RoleEntry[]>` maps each role to different entry points (e.g., `ra-lead` → "RA 전략 시작" → `/chat`; `admin` → admin console; `viewer` → employee entry). This is the **persona landing foundation** — the new SPEC extends it with a tier-level branch (employee/ra/admin), reusing the existing `ROLE_ENTRIES` data.

### 3.4 Permissions map (`lib/auth/permissions.ts`, 597 lines)

`PERMISSION_MAP` (lines ~190-580) defines ~60 permissions, each with `minRole`, `scope`, `resourceType`, optional `additionalRoles`. Key tier-relevant gates (verified):

| Permission | minRole | Tier implication |
|---|---|---|
| `dashboard.view` | `ra-member` | RA tier landing gate |
| `dashboard.team` | `ra-lead` | RA Lead only |
| `auditLogs.view` | `admin` | Admin tier only |
| `sources.ingest` | `admin` | Admin tier only |
| `rbac.manage` | `admin` | Admin tier only |
| `consult.session.view` | `ra-member` | RA tier consult gate |
| `inbox.view` | `ra-member` | RA tier inbox gate |
| `impact.view` | `ra-member` | RA tier (employee impact self-check uses `impact.self_check` at `viewer`) |
| `impact.self_check` | `viewer` | Employee tier — impact wizard backend reachable, but page gate is stricter (`ra-member` per SPEC-V3-IMPACT-UI-001 REQ-IMP-UI-001) |

**NOTE — gate inversion:** `impact.self_check` (`minRole: viewer`) is reachable by Employee tier via the API, but the impact **page** gate (`impact.view`, `minRole: ra-member`) blocks Employee tier from the wizard UI. This is a known tension: the v3 master plan wants Employee to self-check impact (docs/v3/README.md §1.1 "Employee Impact 위저드"), but the current page gate blocks them. This SPEC does NOT change that gate (out of scope — backend/RBAC change). Employee Impact self-check is deferred to a follow-up SPEC that relaxes the page gate (see §6-A2).

---

## §4 Route Inventory (verified — flat, NOT route-grouped)

`app/(app)/` contains these flat routes (verified via `ls`):

```
admin/  audit/  calendar/  chat/  consult/  dashboard/  expert-review/
export/  governance/  history/  impact/  inbox/  knowledge/  knowledge-gap/
library/  predicate/  projects/  quality/  settings/  standards/
templates/  traceability/  triage/  updates/  workflows/  onboarding/
```

**Critical observation:** Routes are FLAT (single route group `(app)/`). The v3 master plan proposes `app/((employee)|(ra)|admin)/` route-group reorg (docs/v3/05_claude_code_playbook.md:39-50). This would require:
- Moving 25+ route directories into 3 route groups
- Updating every `<Link href>` (cross-route links break on rename)
- Updating E2E tests (`frontend-shell.test.ts` order assertions)
- Updating RBAC gates (currently per-route, not per-group)
- Risk of breaking working, tested, RBAC-gated features (consult, inbox, impact, triage all post-merge)

**This is a massive regression surface.** For a 6-8 person internal team (Charter scope), the incremental approach (PersonaBar + persona-aware Sidebar + persona landing branch, KEEP existing routes) delivers 80% of the value at 5% of the risk. Route reorg is deferred to a separate SPEC (§6-A3).

---

## §5 v3 Persona Definitions (verified — docs/v3/)

### 5.1 Source documents

- `docs/v3/README.md` §1 "3-tier Persona 아키텍처" (line 22): "상단에 페르소나 스위치 (`PersonaBar`) · 3-tier: **Employee · RA · Admin** · 각각 별도 사이드바 IA. 페르소나별 화면 접근권한은 서버에서 강제."
- `docs/v3/05_claude_code_playbook.md` table (lines 39-50): persona → screen → route mapping
- `docs/v3/reference/data.jsx` (line 437, `personas`): 9 persona profiles (Employee 5, RA 3, Admin 1)
- `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` §5.1 Phase D-2: master plan assignment

### 5.2 Persona screen inventory (verified)

**Employee (5 screens, 26 users — docs/v3/README.md §1.1):**
1. Ask — `/ask` (new route, master plan) or reuse `/chat`
2. MyQuestions — `/my-questions` (new) or reuse `/history`
3. Products — `/products` (new) or reuse `/library`
4. Guides — `/guides` (new)
5. Impact — `/impact` (exists, but page gate blocks employee tier — §3.4)

**RA (6 screens):**
1. Inbox — `/inbox` (exists, SPEC-V3-INBOX-001)
2. Consult — `/consult` (exists, SPEC-V3-CONSULT-001)
3. Submissions — `/submissions` (new)
4. Registry — `/registry` (new)
5. Radar — `/radar` (new)
6. Knowledge — `/knowledge` (exists) / `/knowledge-gap` (exists)

**Admin (12 screens, 5 categories):**
- Overview, Users, Corpus, Radar Sources, Logs, Settings, Personas, Usability, Backlog (per docs/v3/05_claude_code_playbook.md:50)

### 5.3 Scope discipline for this SPEC

This SPEC does NOT build all 23 persona screens. Those are separate SPECs per screen. This SPEC delivers the **shell-level infrastructure** that all persona screens will plug into:
- `<PersonaBar />` component (3-tier switch)
- `lib/auth/persona.ts` (tier derivation util)
- Persona-aware Sidebar composition (filter existing NAV by tier)
- Persona landing branch (`app/(app)/page.tsx` tier branch)

Individual screens (Ask, MyQuestions, Registry, Radar, Admin 12) are **out of scope** and belong to follow-up SPECs.

---

## §6 Ambiguities & Risks (must surface in spec.md)

### A1. SPEC ID collision with SPEC-V3-UI-001 — RESOLVED

Master plan assigns Phase D-2 to "SPEC-V3-UI-001". But `SPEC-V3-UI-001` already exists (M6 RA Power Chat consult UI, completed — see `.moai/specs/SPEC-V3-UI-001/`). Creating a second SPEC with the same ID would collide in `.moai/specs/` directory and break `/moai run SPEC-V3-UI-001` routing.

**Resolution:** This SPEC uses `SPEC-V3-PERSONA-001`. `parent_spec: SPEC-V3-UI-001` (since PersonaBar is the shell-level extension of the v3 UI work).

### A2. Employee Impact access — KNOWN TENSION (deferred)

docs/v3/README.md §1.1 lists "Impact Check" as an Employee screen. But the impact **page** gate (`impact.view`, `minRole: ra-member`, SPEC-V3-IMPACT-UI-001 REQ-IMP-UI-001) blocks Employee tier. The API (`impact.self_check`, `minRole: viewer`) is reachable, but the page is not.

**Resolution:** This SPEC does NOT change the impact page gate (out of scope — RBAC change). Employee tier PersonaBar will show an "Impact" entry, but clicking it will hit the existing `ra-member` gate and redirect to `/?error=access_denied`. A follow-up SPEC (e.g., SPEC-V3-EMPLOYEE-IMPACT-001) will relax the page gate for Employee-tier impact self-check. This SPEC's Sidebar lists Impact for Employee tier as a **placeholder** (greyed or "RA 문의" CTA), deferring the gate change.

### A3. Route reorg vs incremental — PUSH BACK ON MASTER PLAN (documented in spec.md §Risk)

Master plan proposes full `((employee)|(ra)|admin)` route reorg. This research identifies **5 concrete regression risks** (§4). Charter-aligned recommendation: **incremental composition** (PersonaBar + tier-aware Sidebar + landing branch, KEEP existing flat routes). Route-group migration is deferred to SPEC-V3-ROUTE-REORG-001 (future).

**Quantified push-back:**
- Master plan route reorg: touches 25+ route dirs, ~50+ `<Link>` references, 10+ E2E tests, all RBAC gates. Regression surface: HIGH.
- Incremental approach: 3 new files (PersonaBar.tsx, persona.ts, page.tsx branch), 2 modified files (Sidebar.tsx additive, layout.tsx). Regression surface: LOW (additive only, existing routes untouched).

**Decision:** Incremental. Documented in spec.md §8 Exclusions and plan.md §6 Risk Mitigation.

### A4. Persona-switch state persistence — DECISION NEEDED

Should the persona switch persist across page refreshes?

**Options:**
- (a) **Cookie** (`regula-persona`, like `regula-locale`) — server-readable, survives refresh, works with SSR. Default-recommended.
- (b) **URL query** (`/?persona=ra`) — shareable links, but pollutes URL and breaks if user navigates away.
- (c) **localStorage** — client-only, breaks SSR (layout can't read it during render → hydration mismatch).
- (d) **No persistence** — reset to role-derived default on every page load. Simplest, but loses user preference.

**Resolution:** Default to (a) cookie `regula-persona`, mirroring the existing `regula-locale` pattern (layout.tsx:118 reads `regula-locale` cookie). Server-side readable for SSR consistency. The switch is **view-only** — it does NOT change the user's actual role or permissions (REQ-V3-PER-004). RBAC stays server-side authoritative.

### A5. "View-as" admin impersonation — DEFERRED (optional REQ)

Master plan mentions admin "감시" (monitoring) which could include view-as-persona for admins to see what an employee sees. This is a powerful admin feature but adds:
- Complex state (admin's real role vs. viewed tier)
- Security review (impersonation must not grant actual permissions)
- UX complexity (exit impersonation flow)

**Resolution:** Defer to future SPEC. This SPEC includes REQ-V3-PER-009 as an **optional/deferred** requirement (EARS "Where possible" pattern) so the architecture doesn't preclude it, but no implementation in v1.

---

## §7 Plan-auditor Focus Areas

1. **Tier derivation is read-only** — `personaTier(role)` is a pure function over existing `Role`. Spec MUST NOT propose adding `tier` to DB, session, or `Role` union.
2. **RBAC stays server-side** — PersonaBar switch is view-only. spec MUST state that `withPermission` / `hasRole` gates are unaffected (REQ-V3-PER-004).
3. **Non-regression on existing routes** — spec MUST list existing flat routes as out-of-scope for renaming/moving (REQ-V3-PER-008).
4. **Incremental over full reorg** — plan.md §6 MUST document the push-back on master plan's route reorg with quantified regression surface (§4 of this research).
5. **SPEC ID collision avoided** — ID is `SPEC-V3-PERSONA-001`, NOT `SPEC-V3-UI-001` (which exists).
6. **qa-lead tier mapping** — `qa-lead` (2.5) maps to RA tier, NOT admin. Spec MUST NOT place qa-lead in admin tier.
7. **auditor tier mapping** — `auditor` (0.5) maps to Employee tier for navigation. Spec MUST NOT block auditor from the Employee persona view, but MUST preserve the existing write-block.
8. **Cookie persistence decision** — spec MUST state the `regula-persona` cookie decision (A4) and justify it over localStorage (SSR consistency).

---

**Generated:** 2026-07-06
**Inspection basis:** `lib/auth/rbac.ts` (lines 1-35), `lib/auth/permissions.ts` (lines 13-62, 190-280), `components/shell/Sidebar.tsx` (lines 1-120), `app/(app)/layout.tsx` (full 150L), `app/(app)/page.tsx` (lines 1-40), `app/(app)/` route listing, `docs/v3/README.md`, `docs/v3/05_claude_code_playbook.md`, `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` §5.1, existing `.moai/specs/SPEC-V3-IMPACT-UI-001/` (4-file template).
