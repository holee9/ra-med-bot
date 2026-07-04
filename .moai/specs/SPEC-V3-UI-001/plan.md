---
id: SPEC-V3-UI-001
version: 0.1.0
status: draft
phase: D
priority: High
created: 2026-07-03
updated: 2026-07-03
author: manager-spec
issue_number: TBD
depends_on:
  - SPEC-V3-INBOX-001
blocks:
  - SPEC-V3-TRIAGE-001
  - SPEC-V3-CONSULT-001
lifecycle_level: spec-anchored
labels:
  - component/frontend
  - component/ui
  - domain/inbox
  - type/v3-new
---

# SPEC-V3-UI-001 — Implementation Plan: RA Inbox 4-column Kanban UI (Phase D)

> **Scope**: This document is the **implementation PLAN only** (Phase 1 sub-artifact).
> The full `spec.md` (EARS requirements + AC) and `acceptance.md` are produced in
> the next annotation step. Do NOT treat this plan as the SPEC contract.

## HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-07-03 | manager-spec | Initial plan. Brownfield UI consuming SPEC-V3-INBOX-001 (PR #322, implemented). Backend contract verified via `research.md` + direct source read (state-machine, routes, types). 2 contract discrepancies flagged (§8). |

---

## §1 SPEC Candidate Confirmation

### 1.1 ID & Title

- **SPEC ID**: `SPEC-V3-UI-001` (confirmed — domain UI, sequential 001 under v3-UI namespace)
- **Title**: RA Inbox 4-column Kanban UI (Phase D frontend)
- **Phase**: D (frontend slice of v3 Phase C-1 backend)

### 1.2 Duplicate Check

Grep of `.moai/specs/` (66 SPEC dirs, 2026-07-03):
- No prior `SPEC-V3-UI-*` exists (only `SPEC-V3-INBOX-001`, `SPEC-V3-RESTRUCTURE-001`, `SPEC-V3-UI-001` itself).
- No `SPEC-REGULA-INBOX-*` / `SPEC-REGULA-KANBAN-*` exists.
- The closest prior art (`SPEC-REGULA-CHAT-001`, `SPEC-REGULA-KNOWLEDGE-GAP-001`) is a different domain (chat / knowledge-gap queue) and does NOT overlap with the RA Kanban workflow.

**Conclusion**: `SPEC-V3-UI-001` is unique and correctly named.

### 1.3 Lifecycle Level

`spec-anchored` — SPEC maintained alongside implementation. Inbox UI is a core v3 surface (RA Lead daily driver) and will evolve (TRIAGE Phase C-2, Consult Phase C-5).

---

## §2 Scope Summary (User-Approved — DO NOT Re-litigate)

### 2.1 In Scope (Phase D MVP slice)

| Slice | Detail | Source |
|-------|--------|--------|
| **4-column Kanban (read)** | Columns: `auto`, `needs-review`, `escalated`, `waiting`. Terminal states (`closed`, `rejected`) rendered via filter, not columns. | research.md §2; types.ts:33-40 |
| **Ticket detail route** | Independent route `app/(app)/inbox/[id]/page.tsx`. URL shareable, print-friendly (21 CFR Part 11 audit evidence). | User decision |
| **Triage state transition** | Button-based action menu per card (NOT drag-and-drop). Calls `PATCH /api/inbox/[id]/triage`. | User decision; Charter 지양-4 |
| **ESIG approve / reject** | Approve dialog with password re-entry + ESIG signature. Calls `POST /api/inbox/[id]/approve`. | approve/route.ts:25-144 |
| **Viewer "my questions" view** | Viewers ask via existing `/chat` (ask.create → inbox ticket auto-created). Viewers see their own questions' status via `/chat` or a "my questions" list. RA Kanban NOT exposed to viewers. | User decision |
| **Refresh strategy** | tanstack-query `revalidateOnFocus` + manual refresh button + `staleTime: 60s`. No auto-polling. | User decision |
| **Activity feed** | Detail page shows audit-based timeline (append-only `audit_logs`, 21 CFR Part 11). | User decision |

### 2.2 Exclusions (What NOT to Build) — Phase D

1. **WebSocket realtime** (`/api/inbox/subscribe`) — deferred to a later phase.
2. **Drag-and-drop column moves** — explicitly excluded. ESIG approve requires password re-entry (impossible via DnD); 21 CFR Part 11 audit; WCAG accessibility (Charter 지양-4).
3. **Bulk actions** (multi-select triage/approve) — excluded.
4. **Auto-polling** (interval-based refetch) — excluded; manual + focus refresh only.
5. **New backend APIs** — consume existing only (`/api/inbox`, `/api/inbox/[id]`, `/api/inbox/[id]/triage`, `/api/inbox/[id]/approve`, `/api/ask`).
6. **New permissions** — reuse existing `inbox.view` (ra-member+), `inbox.manage` (ra-lead), `ask.create` (viewer/employee). No changes to `lib/auth/permissions.ts`.
7. **TRIAGE auto-answer injection UI** — depends on SPEC-V3-TRIAGE-001 (C-2). UI displays `autoAnswer` if present but does not generate it.
8. **Consult (Power Chat)** — `SPEC-V3-CONSULT-001` (C-5). Not in this SPEC.
9. **Admin audit-log viewer** — separate admin surface (existing `app/(app)/audit/`). This SPEC only shows per-ticket activity feed on detail page.
10. **Kanban list-view toggle** — MVP is Kanban-only. List view deferred.

---

## §3 EARS Requirement Skeleton (Proposed REQ IDs)

> **Note**: These are proposed REQ IDs for the next-step `spec.md`. Grouped into **5 modules** (≤5 constraint). Each UI REQ traces to the backend REQ-V3-INBOX-XXX it consumes (see §4 traceability table).

### Module 1 — Kanban Board Rendering & Data Fetching

| ID | EARS Pattern | Skeleton | Backend Trace |
|----|-------------|----------|---------------|
| REQ-V3-UI-001 | Ubiquitous | The system **shall** render a 4-column Kanban board (auto / needs-review / escalated / waiting) for users with `inbox.view` (ra-member+) on `/inbox`. | REQ-V3-INBOX-002 (6-value enum → 4 working columns + 2 terminal) |
| REQ-V3-UI-002 | Event-Driven | **When** the Kanban page mounts or regains focus, the system **shall** fetch tickets in parallel for each of the 4 working columns via `GET /api/inbox?state=<state>&limit=50`. | REQ-V3-INBOX-019, REQ-V3-INBOX-020 |
| REQ-V3-UI-003 | State-Driven | **While** a column query is loading, the system **shall** show a skeleton loader per column; **while** a query errored, the system **shall** show an error state with a retry button. | (UX convention; no backend dep) |
| REQ-V3-UI-004 | Optional | **Where** a ticket has `slaDeadline`, the system **shall** render an SLA badge showing relative time, with an "overdue" style when `slaDeadline < now`. | REQ-V3-INBOX-017 |
| REQ-V3-UI-005 | Ubiquitous | The system **shall** render terminal-state tickets (`closed`, `rejected`) only when the user explicitly selects the "archived" filter, not as Kanban columns. | REQ-V3-INBOX-002 |

### Module 2 — Ticket Detail View & ESIG Approve Flow

| ID | EARS Pattern | Skeleton | Backend Trace |
|----|-------------|----------|---------------|
| REQ-V3-UI-010 | Event-Driven | **When** a user clicks a Kanban card, the system **shall** navigate to `/inbox/[id]` (independent route), fetching `GET /api/inbox/[id]`. | REQ-V3-INBOX-019 |
| REQ-V3-UI-011 | Ubiquitous | The detail page **shall** display: question, autoAnswer (with citations), raAssignee, escalateTo, slaDeadline, triageState, approvedBy/At, finalAnswer, and the audit-based activity timeline. | REQ-V3-INBOX-001 (field set), REQ-V3-INBOX-021 (audit actions) |
| REQ-V3-UI-012 | State-Driven | **While** the user is `ra-lead`/`admin` AND the ticket has `finalAnswer` set AND `triageState` is not `closed`/`rejected`, the system **shall** show the "Approve (ESIG)" action. | REQ-V3-INBOX-012, REQ-V3-INBOX-014 |
| REQ-V3-UI-013 | Event-Driven | **When** the user submits the approve form, the system **shall** call `POST /api/inbox/[id]/approve` with body `{password, esigSignature}` and **shall** disable the submit button + show a "signing..." pending state until the response. | REQ-V3-INBOX-012 (approve/route.ts:25-144) |
| REQ-V3-UI-014 | Unwanted | **If** the approve endpoint returns 401 (invalid password), the system **shall** show an inline "비밀번호가 올바르지 않습니다" error on the password field **and shall NOT** navigate away or show a generic toast. | approve/route.ts:82 |
| REQ-V3-UI-015 | Unwanted | **If** the approve endpoint returns 400 with "Cannot promote" (missing `final_answer`), the system **shall** show a blocking message instructing the user to set `finalAnswer` first, and **shall NOT** retry silently. | approve/route.ts:134-136 |
| REQ-V3-UI-016 | Event-Driven | **When** the approve endpoint returns 200, the system **shall** invalidate the `/inbox` query cache (tanstack-query) **and** navigate the user back to the Kanban with a success toast. | (UI state coordination) |

### Module 3 — Triage Action UI (Button Menu, State Transition, 409 Handling)

| ID | EARS Pattern | Skeleton | Backend Trace |
|----|-------------|----------|---------------|
| REQ-V3-UI-020 | State-Driven | **While** the user is `ra-lead`/`admin` AND the ticket is non-terminal, the system **shall** render a per-card action menu offering only the transitions valid for the ticket's current `triageState` (per `VALID_TRANSITIONS` at types.ts:33-40). | REQ-V3-INBOX-006 |
| REQ-V3-UI-021 | Event-Driven | **When** the user picks a transition target, the system **shall** optimistically update the local Kanban cache **and** call `PATCH /api/inbox/[id]/triage` with `{toState, reason?}`. | REQ-V3-INBOX-006 (triage/route.ts:23-131) |
| REQ-V3-UI-022 | Unwanted | **If** the triage endpoint returns 409 Conflict (invalid transition), the system **shall** revert the optimistic update **and** show a toast: "상태 전이 실패 — 새로고침 후 다시 시도하세요". | triage/route.ts:74-93 |
| REQ-V3-UI-023 | Unwanted | **If** the triage endpoint returns 404 (ticket not in org / IDOR attempt), the system **shall** remove the card from the local cache **and** log a warning to the console. | triage/route.ts (IDOR defense) |
| REQ-V3-UI-024 | Optional | **Where** the transition target is `rejected` or `escalated`, the system **shall** prompt for an optional `reason` (max 500 chars) before confirming. | triage/route.ts:19 |

### Module 4 — Role-Based Access & Viewer "My Questions"

| ID | EARS Pattern | Skeleton | Backend Trace |
|----|-------------|----------|---------------|
| REQ-V3-UI-030 | Ubiquitous | The system **shall** gate the `/inbox` route (server-side via `app/(app)/layout.tsx`) such that only `ra-member`/`ra-lead`/`admin` can reach it; `viewer`/`employee` are redirected to `/chat`. | REQ-V3-INBOX-008, REQ-V3-INBOX-009 |
| REQ-V3-UI-031 | Ubiquitous | The Sidebar nav **shall** show the "Inbox" entry only when the resolved role is `ra-member`+ (passed as a `showInbox` prop from `app/(app)/layout.tsx`, following the established pattern). | (convention: Sidebar.tsx L33-75 showX prop pattern) |
| REQ-V3-UI-032 | State-Driven | **While** the user is `ra-member` (not `ra-lead`), the system **shall** hide all `inbox.manage` actions (triage menu, approve button, reject) and render the Kanban as read-only. | REQ-V3-INBOX-008 |
| REQ-V3-UI-033 | Event-Driven | **When** a viewer/employee submits a question via `/chat`, the system **shall** call `POST /api/ask` and, on success, show the resulting `ticket_id` + `triage_state` to the viewer as a "내 질문 상태" panel. | REQ-V3-INBOX-030 (ask/route.ts) |
| REQ-V3-UI-034 | Optional | **Where** a viewer visits a ticket detail URL they own, the system **shall** render a minimal "내 질문 상세" view (their question + current triage state + answer if approved), gating all RA-only fields. | REQ-V3-INBOX-010 (own-ticket query layer) |

### Module 5 — Cross-Cutting: i18n, Accessibility, Design Tokens, Error/Empty/Loading

| ID | EARS Pattern | Skeleton | Backend Trace |
|----|-------------|----------|---------------|
| REQ-V3-UI-040 | Ubiquitous | The system **shall** add a new `inbox` i18n namespace to both `messages/ko.json` and `messages/en.json` with keys for: title, columns.{auto,needsReview,escalated,waiting,closed,rejected}, actions.{approve,reject,assign,escalate,refresh}, sla.{overdue,remaining}, empty, loading, errors.{transitionFailed,approveFailed,passwordInvalid,missingFinalAnswer}. | (convention; messages/{ko,en}.json) |
| REQ-V3-UI-041 | Ubiquitous | The system **shall** apply triage-state design tokens per research.md §5.5 (auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500, closed=ink-300, rejected=red-500) consistently across card border, badge, and column header accent. | (design tokens; styles/tokens.css) |
| REQ-V3-UI-042 | Ubiquitous | The system **shall** meet WCAG 2.1 AA: all action buttons keyboard-reachable, ARIA labels on icon-only buttons, color contrast ≥ 4.5:1 for text, focus visible on all interactive elements. | (Charter — medical device software) |
| REQ-V3-UI-043 | Unwanted | **If** the API returns a 403 Forbidden on any inbox endpoint, the system **shall** show an inline "접근 권한이 없습니다" empty state **and shall NOT** crash or show raw error JSON. | REQ-V3-INBOX-009 |
| REQ-V3-UI-044 | Optional | **Where** a column has zero tickets, the system **shall** render an empty-state illustration + the i18n `inbox.empty` message. | (UX convention) |
| REQ-V3-UI-045 | Ubiquitous | The system **shall** use `tanstack-query` with `staleTime: 60_000` and `revalidateOnFocus: true` for all inbox reads, and **shall** provide a manual "새로고침" button in the Kanban header. | (research.md §5.1) |

---

## §4 Backend Traceability Table (UI REQ ↔ Backend REQ ↔ AC)

| UI REQ | Backend REQ | Backend AC Implemented by UI | Backend Source (file:line) |
|--------|-------------|------------------------------|----------------------------|
| REQ-V3-UI-001 | REQ-V3-INBOX-002 | AC-02 (triage_state enum rendering) | types.ts:17 |
| REQ-V3-UI-002 | REQ-V3-INBOX-019, REQ-V3-INBOX-020 | AC-09 (filter by state) | app/api/inbox/route.ts:20-55 |
| REQ-V3-UI-004 | REQ-V3-INBOX-017 | (SLA deadline display) | lib/domains/inbox/sla.ts |
| REQ-V3-UI-010 | REQ-V3-INBOX-019 | AC-09 (detail fetch) | app/api/inbox/[id]/route.ts:11-43 |
| REQ-V3-UI-012, REQ-V3-UI-013 | REQ-V3-INBOX-012, REQ-V3-INBOX-014 | AC-05 (ESIG approve flow) | app/api/inbox/[id]/approve/route.ts:25-144 |
| REQ-V3-UI-014, REQ-V3-UI-015 | (error handling) | AC-05 failure paths | approve/route.ts:82, :134-136 |
| REQ-V3-UI-020, REQ-V3-UI-021 | REQ-V3-INBOX-006 | AC-04 (409 on invalid transition) | types.ts:33-40, app/api/inbox/[id]/triage/route.ts:23-131 |
| REQ-V3-UI-022, REQ-V3-UI-023 | (error handling) | AC-04, AC-10 (IDOR) | triage/route.ts:74-93 |
| REQ-V3-UI-030, REQ-V3-UI-032 | REQ-V3-INBOX-008, REQ-V3-INBOX-009 | AC-03 (403 + audit), AC-07 (RBAC) | lib/auth/permissions.ts:172-177 |
| REQ-V3-UI-033 | REQ-V3-INBOX-030 | AC-13 (ask→ticket creation) | app/api/ask/route.ts |
| REQ-V3-UI-034 | REQ-V3-INBOX-010 | AC-03 (own-ticket query) | lib/domains/inbox/access.ts |
| REQ-V3-UI-043 | REQ-V3-INBOX-009 | AC-03 (403 handling) | (withPermission wrapper) |

**Backend AC NOT implemented by UI** (backend-only, out of UI scope): AC-01, AC-06, AC-08, AC-10, AC-11, AC-12 (all migration / DB-level / audit-log assertions).

---

## §5 Affected Files (Delta Markers — Brownfield)

> All paths are project-root-relative (root-level `app/`, NOT `src/app/`). Verified against filesystem 2026-07-03.

### 5.1 `[NEW]` Files to Create

| Path | Purpose |
|------|---------|
| `app/(app)/inbox/page.tsx` | Kanban board page (client component, 4 columns + filter + manual refresh). |
| `app/(app)/inbox/[id]/page.tsx` | Ticket detail route (question, citations, assignee, ESIG approve dialog, audit timeline). |
| `components/inbox/InboxKanban.tsx` | Kanban board shell (column layout, drag-free). |
| `components/inbox/KanbanColumn.tsx` | Single column renderer (header + ticket list + empty state). |
| `components/inbox/TicketCard.tsx` | Compact card (question excerpt, triage badge, SLA badge, assignee avatar, action menu trigger). |
| `components/inbox/TriageActionMenu.tsx` | Radix DropdownMenu offering only `VALID_TRANSITIONS[currentState]` targets. |
| `components/inbox/ApproveDialog.tsx` | Radix Dialog with password + esigSignature fields, inline 401 handling, atomic submit. |
| `components/inbox/ActivityTimeline.tsx` | Append-only audit log timeline (per-ticket). |
| `components/inbox/SlaBadge.tsx` | SLA relative-time badge with overdue style. |
| `components/inbox/ViewerTicketSummary.tsx` | Minimal own-ticket view for viewers (REQ-V3-UI-034). |
| `lib/queries/useInbox.ts` | tanstack-query hooks: `useInboxTickets(state)`, `useInboxTicket(id)`, `useTriageTransition()`, `useApproveTicket()`. |
| `stores/inbox.ts` | Zustand store (selectedTicketId, showArchived). Follows `stores/project.ts` pattern. `viewMode` (Kanban-vs-list) omitted per Exclusion #10 (list-view excluded). |

> **Component directory decision**: Create new `components/inbox/` (NOT under `components/dashboard/`). Rationale: (1) `components/dashboard/` is a different feature surface; (2) inbox has 8 dedicated components (large enough for its own dir); (3) matches the existing per-domain convention (`components/chat/`, `components/expert-review/`, `components/knowledge-gap/`).

### 5.2 `[MODIFY]` Files

| Path | Change | Convention Evidence |
|------|--------|---------------------|
| `components/shell/Sidebar.tsx` | Add `showInbox?: boolean` prop + render "Inbox" NavItem when true. | Sidebar.tsx L33-75 (`showPredicate`, `showKnowledgeGap`, ... pattern). New entry inserted after "히스토리" (L27) per research.md §5.6. |
| `app/(app)/layout.tsx` | Resolve `showInbox = hasRole(userRole, 'ra-member')` server-side + pass to `<Sidebar showInbox={showInbox}>`. | layout.tsx L23-60 (established server-side `showX` pattern). |
| `app/(app)/chat/page.tsx` | After successful ask.create, surface the resulting `ticket_id` + `triage_state` to the viewer (small "내 질문 상태" panel / toast linking to `/inbox/[id]` if they own it). | (existing chat surface; minimal augmentation) |
| `messages/ko.json` | Add top-level `inbox` namespace. | (verified missing 2026-07-03) |
| `messages/en.json` | Add top-level `inbox` namespace. | (verified missing 2026-07-03) |

### 5.3 `[EXISTING]` Files (Consume, DO NOT Modify)

| Path | Why Touched (read-only) |
|------|-------------------------|
| `app/api/inbox/route.ts` | GET list (consume). |
| `app/api/inbox/[id]/route.ts` | GET detail (consume). |
| `app/api/inbox/[id]/triage/route.ts` | PATCH transition (consume). |
| `app/api/inbox/[id]/approve/route.ts` | POST approve (consume). |
| `app/api/ask/route.ts` | POST viewer question (consume). |
| `lib/domains/inbox/**` (types.ts, state-machine.ts, queries.ts, access.ts, promote.ts, audit.ts, sla.ts) | Types + client-side transition validation reuse (e.g., import `VALID_TRANSITIONS` for the action menu gating). |
| `lib/auth/permissions.ts` | Permission keys (read-only import; no new keys). |
| `lib/auth/with-permission.ts` | Server-side guard wrapper (read-only). |
| `lib/auth/rbac.ts` | `hasRole()` helper (read-only). |

---

## §6 Technology Stack & Dependencies

### 6.1 Confirmed Versions (package.json, 2026-07-03)

| Dependency | Version | Role |
|------------|---------|------|
| `next` | ^15.5.18 | App Router (root-level `app/`). |
| `react` / `react-dom` | ^18.3.1 | UI runtime. |
| `@tanstack/react-query` | ^5.51.0 | Data fetching, cache, `revalidateOnFocus`. |
| `zustand` | ^4.5.4 | UI store (selectedTicketId, showArchived). |
| `tailwindcss` | ^4.0.0-alpha.20 | Styling (alpha, project standard). |
| `@radix-ui/react-dialog` | ^1.1.1 | Approve dialog. |
| `@radix-ui/react-dropdown-menu` | ^2.1.1 | Triage action menu. |
| `@radix-ui/react-tooltip` | ^1.1.2 | SLA + escalation tooltips. |
| `@radix-ui/react-toast` | ^1.2.1 | Success / error toasts. |
| `lucide-react` | ^0.451.0 | Icons. |
| `react-hook-form` | ^7.52.0 | Approve form (password + esigSignature). |
| `next-intl` | ^4.11.0 | i18n (messages/{ko,en}.json). |
| `vitest` / `@testing-library/react` | ^1.6.0 / ^14.3.1 | Component tests. |
| `@playwright/test` | ^1.45.0 | E2E (approve happy path). |
| `@axe-core/playwright` | ^4.11.3 | WCAG axe scan. |
| `@biomejs/biome` | ^1.9.2 | Lint/format (CI gate — L-008/L-013/L-015). |

### 6.2 No New Heavy Dependencies

- **DnD library (`@dnd-kit/core`, `react-beautiful-dnd`)**: NOT added (DnD excluded — §2.2).
- **SWR**: NOT added (tanstack-query is already the project standard).
- **Date library**: Reuse existing project convention (check `lib/` for date utils at run phase; if none, use native `Intl.RelativeTimeFormat`).
- **Charting**: NOT needed for MVP.

---

## §7 Architecture & Patterns

### 7.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ app/(app)/inbox/page.tsx (Client)                               │
│   ├─ useInboxTickets('auto')      ─┐                            │
│   ├─ useInboxTickets('needs-review')│ tanstack-query             │
│   ├─ useInboxTickets('escalated')   │ revalidateOnFocus          │
│   └─ useInboxTickets('waiting')    ─┘ staleTime: 60s             │
│         └─ fetch GET /api/inbox?state=<state>                    │
│                                                                   │
│   TriageActionMenu ─→ useTriageTransition()                      │
│         └─ PATCH /api/inbox/[id]/triage                          │
│         └─ optimistic update + 409 rollback                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ app/(app)/inbox/[id]/page.tsx (Client)                          │
│   ├─ useInboxTicket(id) ── fetch GET /api/inbox/[id]             │
│   ├─ ActivityTimeline   ── (audit_actions via existing audit API)│
│   └─ ApproveDialog                                                     │
│         └─ useApproveTicket() ── POST /api/inbox/[id]/approve    │
│               body: {password, esigSignature}                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 State Management (Zustand) — `stores/inbox.ts`

Minimal UI state only (no server cache duplication — tanstack-query owns server state). `viewMode` (Kanban-vs-list) and `assigneeFilter` are excluded per Exclusion #10 / Exclusion #12 (both deferred to Phase D.2):

```ts
interface InboxStore {
  selectedTicketId: string | null;
  showArchived: boolean;        // toggle closed/rejected visibility (REQ-V3-UI-005)
  setSelectedTicketId: (id: string | null) => void;
  toggleArchived: () => void;
}
```

### 7.3 Optimistic Triage Transition (409-safe)

```ts
useTriageTransition() {
  // 1. capture queryClient cache snapshot for all 4 column queries
  // 2. optimistic: remove card from old-state column, add to new-state column
  // 3. PATCH /api/inbox/[id]/triage { toState, reason }
  // 4. on 409: revert snapshot, show toast "상태 전이 실패"
  // 5. on 404: remove card entirely (IDOR / deleted)
  // 6. on 200: invalidate both column queries to re-sync with server truth
}
```

### 7.4 Role-Gating Pattern (Server-Side + Client-Side)

- **Server-side (layout.tsx)**: `showInbox = hasRole(userRole, 'ra-member')` → Sidebar visibility.
- **Route guard**: `/inbox/page.tsx` server wrapper checks role, redirects viewers → `/chat`.
- **Client-side (UI hide/show)**: `session.user.role` gates the action menu, approve button. **Note**: server-side `withPermission` is the authoritative guard; client-side is UX only.

---

## §8 Risk Analysis & Mitigation

### 8.1 Critical Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **camelCase aliasing mismatch** (L-008/L-013/L-015). UI type definitions must match API response aliases exactly. Local biome 1.9.4 = warning, CI = error. | HIGH | (1) Generate UI types from the same source as backend (`lib/domains/inbox/types.ts` re-export); (2) Run `pnpm ci:lint` locally before commit (NOT just `pnpm lint`); (3) Verify main-branch CI gates green; (4) Code-review for unused imports/vars (the silent CI killer). |
| R2 | **ESIG UX complexity** — password re-entry + esigSignature in one flow. 401 on bad password, 400 on missing `final_answer`. | HIGH | (1) ApproveDialog as a 2-step modal (Step 1: confirm final_answer present, Step 2: password + esigSignature); (2) inline 401 error on password field (REQ-V3-UI-014); (3) blocking 400 message if final_answer missing (REQ-V3-UI-015); (4) disable submit during pending (REQ-V3-UI-013). |
| R3 | **Optimistic triage update + 409 conflict** — multiple RA Leads acting concurrently. | MEDIUM | (1) Optimistic update with snapshot revert on 409 (REQ-V3-UI-022); (2) on 200, invalidate all 4 column queries (re-sync); (3) `staleTime: 60s` bounds staleness. |
| R4 | **IDOR on detail** — backend protects (assertTicketInOrg 404), but UI must not bypass. | HIGH | (1) Always fetch via `GET /api/inbox/[id]` (server-side guard); (2) never accept ticket data from URL params alone; (3) on 404, remove card from cache + log warning (REQ-V3-UI-023). |
| R5 | **i18n namespace missing** — `messages/{ko,en}.json` have no `inbox` namespace (verified 2026-07-03). | MEDIUM | (1) Add `inbox` namespace as the FIRST task in run phase (blocks all UI text); (2) key list in REQ-V3-UI-040. |
| R6 | **Role leakage to viewers** — viewers must NOT reach `/inbox`. | HIGH | (1) Server-side redirect in route guard; (2) `showInbox` Sidebar prop; (3) `hasRole('ra-member')` check; (4) Playwright test: viewer navigating to `/inbox` lands on `/chat`. |
| R7 | **VALID_TRANSITIONS mismatch** (see §9.1) — research.md §2 and SPEC-V3-INBOX-001 §4.3 list transitions that the actual `types.ts:33-40` matrix does NOT allow (e.g., `auto→escalated`, `auto→closed`, `*(any)→rejected`). | HIGH | UI uses the **actual `VALID_TRANSITIONS` constant from `lib/domains/inbox/types.ts`** as the single source of truth for the action menu. Cite types.ts:33-40. Flag in annotation. |

### 8.2 Non-Functional Constraints (Charter / Regulatory)

| Constraint | Source | How Addressed |
|-----------|--------|---------------|
| **Charter 지양-2 (가짜 신뢰 금지)** | product-charter.md | Approve requires ESIG; autoAnswer displayed with citations only (no citation = no display); REQ-V3-UI-011, REQ-V3-UI-013. |
| **Charter 지양-4 (AI 판단 금지)** | product-charter.md | No auto-approve; all transitions human-initiated; button-based (not DnD) for audit clarity; REQ-V3-UI-020. |
| **21 CFR Part 11 §11.10(e)** | SPEC-V3-INBOX-001 §1.3 | Activity timeline shows append-only audit log; REQ-V3-UI-011. |
| **21 CFR Part 11 §11.50/§11.70** | SPEC-V3-INBOX-001 §1.3 | ESIG = password re-auth + signature; REQ-V3-UI-013. |
| **WCAG 2.1 AA** | Charter (medical device software) | REQ-V3-UI-042; `@axe-core/playwright` scan in E2E. |
| **ISO 13485 §4.2.5 (7-yr retention)** | SPEC-V3-INBOX-001 §1.3 | Backend concern; UI only displays (no deletion UI). |

---

## §9 Contract Discrepancies (research.md vs Backend Code)

> The backend code is **authoritative** (PR #322 merged). research.md and SPEC-V3-INBOX-001 §4.3 are descriptive; where they disagree with code, code wins. These must be reconciled in the `spec.md` annotation step.

### 9.1 DISCREPANCY-1: VALID_TRANSITIONS matrix

- **research.md §2 claims**: `auto → {needs-review, escalated, closed}` and `*(any) → rejected (ra-lead only)`.
- **SPEC-V3-INBOX-001 §4.3 claims**: same as research.md (auto→escalated, auto→closed, *(any)→rejected).
- **Actual code** (`lib/domains/inbox/types.ts:33-40`):
  ```ts
  auto: ['needs-review'],                              // ONLY needs-review
  'needs-review': ['escalated', 'waiting', 'closed', 'rejected'],
  escalated: ['waiting', 'closed', 'rejected'],
  waiting: ['needs-review', 'closed'],                 // NO rejected from waiting
  closed: [],
  rejected: [],
  ```
- **Impact on UI**: The TriageActionMenu (`REQ-V3-UI-020`) MUST derive its options from the actual `VALID_TRANSITIONS` constant, NOT from the research.md/SPEC table. Specifically: (1) `auto`-state cards offer ONLY "Needs Review"; (2) `waiting`-state cards do NOT offer "Reject" (must go through needs-review first); (3) there is NO universal "any→rejected" path.
- **Resolution**: UI imports `VALID_TRANSITIONS` from `lib/domains/inbox/types.ts`. Flag this for the SPEC author to reconcile `spec.md` §4.3 in annotation (the SPEC's transition table should be corrected to match code, OR the code is a regression to fix — latter unlikely given PR #322 is the source of truth).

### 9.2 DISCREPANCY-2: Approve endpoint request body

- **SPEC-V3-INBOX-001 §4.5 claims**: `POST /api/inbox/:id/approve` body = `{final_answer, citations[], esig: {password, meaning}}`.
- **research.md §3.4 claims**: body = `{password, esigSignature}`.
- **Actual code** (`app/api/inbox/[id]/approve/route.ts:18-22`):
  ```ts
  const approveTicketInputSchema = z.object({
    password: z.string().min(1, 'Password is required for re-authentication'),
    esigSignature: z.string().min(1, 'ESIG signature is required'),
  });
  ```
- **Impact on UI**: The ApproveDialog (`REQ-V3-UI-013`) sends ONLY `{password, esigSignature}`. The `final_answer` must already be set on the ticket (via a separate UI mechanism — likely a "draft final answer" edit which is **out of Phase D scope** unless the user adds it). If `final_answer` is missing, the approve call returns 400 "Cannot promote" (handled by `REQ-V3-UI-015`).
- **Open Question for annotation**: Does Phase D need a "set final_answer" UI? If yes, that expands scope (new PATCH endpoint or reuse). If no, the approve flow assumes `final_answer` was set by some other path (TRIAGE C-2, or a later Phase D.2). **Default assumption**: Phase D does NOT add final_answer editing; approve is only enabled when `ticket.finalAnswer` is truthy (`REQ-V3-UI-012`).

---

## §10 MX Tag Plan

| Tag | Target | Rationale |
|-----|--------|-----------|
| `@MX:ANCHOR` | `lib/queries/useInbox.ts` — `useInboxTickets`, `useTriageTransition`, `useApproveTicket` | fan_in will reach 3+ (Kanban page, detail page, action menu). Public query API boundary. |
| `@MX:ANCHOR` | `components/inbox/TriageActionMenu.tsx` — transition derivation | Business invariant (uses `VALID_TRANSITIONS`). |
| `@MX:WARN` | `components/inbox/ApproveDialog.tsx` — submit handler | Regulatory-critical (21 CFR Part 11). Atomic submit with 401/400 inline handling. |
| `@MX:WARN` | `useTriageTransition` — optimistic update + 409 rollback | Concurrency-sensitive; incorrect revert = stale UI state. |
| `@MX:NOTE` | `app/(app)/inbox/page.tsx`, `app/(app)/inbox/[id]/page.tsx` | New page entry points; reference SPEC-V3-UI-001. |
| `@MX:NOTE` | `stores/inbox.ts` | New Zustand store; cross-cutting UI state. |
| `@MX:TODO` | (during TDD RED) any hook/component missing tests | Resolved at GREEN. |

---

## §11 Milestones (Priority-Based, No Time Estimates)

> Ordered by dependency. Each milestone is a coherent merge unit.

### M1 — Foundation (Priority: High)
- Add `inbox` i18n namespace to `messages/{ko,en}.json` (REQ-V3-UI-040).
- Create `lib/queries/useInbox.ts` hooks (REQ-V3-UI-002, -010, -013, -021).
- Create `stores/inbox.ts` Zustand store.
- Verify camelCase types match `lib/domains/inbox/types.ts` exports (R1 mitigation).

### M2 — Kanban Board (Priority: High)
- `app/(app)/inbox/page.tsx` + `InboxKanban` + `KanbanColumn` + `TicketCard` + `SlaBadge` (REQ-V3-UI-001..005, -044, -045).
- Sidebar nav entry + layout `showInbox` gating (REQ-V3-UI-030, -031).
- Empty / loading / error states (REQ-V3-UI-003, -043).
- Component tests (Kanban render, role gating, empty state).

### M3 — Triage Action UI (Priority: High)
- `TriageActionMenu` driven by `VALID_TRANSITIONS` (REQ-V3-UI-020, -024).
- `useTriageTransition` with optimistic update + 409/404 handling (REQ-V3-UI-021, -022, -023).
- Component tests (409 rollback, 404 removal, valid-only menu options).

### M4 — Ticket Detail + ESIG Approve (Priority: High)
- `app/(app)/inbox/[id]/page.tsx` + detail layout (REQ-V3-UI-010, -011).
- `ApproveDialog` with 2-step flow, inline 401, blocking 400 (REQ-V3-UI-012..016).
- `ActivityTimeline` (audit-based).
- Component tests (401 inline, 400 blocking, success cache invalidation).
- Playwright E2E: approve happy path (charter 지양-2 / 지양-4 gate).

### M5 — Viewer Integration + Cross-Cutting (Priority: Medium)
- `/chat` ask.create → ticket_id surfacing (REQ-V3-UI-033).
- `ViewerTicketSummary` for own-ticket detail (REQ-V3-UI-034).
- ra-member read-only rendering (REQ-V3-UI-032).
- Design tokens (REQ-V3-UI-041), WCAG axe scan (REQ-V3-UI-042).
- Playwright: viewer redirect from `/inbox` → `/chat`.

### M6 — Quality Gates (Priority: High)
- Full `pnpm ci:lint` + `pnpm ci:test` locally (L-015).
- `pnpm ci:build` (L-012: stop `next dev` first).
- WCAG axe scan clean.
- Pre-submission self-review (simplicity check).

---

## §12 Test Strategy Sketch

### 12.1 Component Tests (Vitest + Testing Library)

| Test | Target REQ | Mock Pattern |
|------|-----------|--------------|
| Kanban renders 4 columns + empty states | REQ-V3-UI-001, -044 | `vi.mock('@/lib/db/client')`, mock fetch per state |
| Role gating: ra-member sees no action menu; ra-lead sees it | REQ-V3-UI-032 | mock `useSession` / `withPermission` (L-009 pattern) |
| TriageActionMenu offers only `VALID_TRANSITIONS[current]` options | REQ-V3-UI-020 | import real `VALID_TRANSITIONS` from types.ts |
| 409 on triage: optimistic update reverted + toast shown | REQ-V3-UI-022 | mock fetch returning 409 |
| 404 on triage: card removed from cache | REQ-V3-UI-023 | mock fetch returning 404 |
| ApproveDialog 401: inline password error, no navigation | REQ-V3-UI-014 | mock fetch returning 401 |
| ApproveDialog 400 "Cannot promote": blocking message | REQ-V3-UI-015 | mock fetch returning 400 |
| Approve success: cache invalidated, navigate to Kanban | REQ-V3-UI-016 | mock fetch 200 |

### 12.2 Route/Integration Tests

- **Pattern (L-009, L-013)**: `vi.mock('@/lib/db/client')` + select-chain mock with camelCase aliases + `withPermission` mock + real `VALID_TRANSITIONS`.
- Verify: viewer GET `/inbox` redirects to `/chat`.
- Verify: viewer GET `/inbox/[own-id]` returns minimal view; GET `/inbox/[other-id]` returns 404.

### 12.3 Playwright E2E

- **Happy path**: RA Lead logs in → Kanban renders → click card → set triage → approve with ESIG → ticket disappears from active columns, appears in archived.
- **WCAG axe scan**: `@axe-core/playwright` on `/inbox` and `/inbox/[id]` — zero critical violations.

### 12.4 Manual / Visual

- Design token consistency (column accent, badge colors).
- Korean + English i18n render (no raw keys).
- Print-friendly detail page (browser print preview, audit evidence use case).

---

## §13 Open Questions for Annotation Step

1. **Q1 (DISCREPANCY-1 resolution)**: Should the `spec.md` requirements cite the actual `VALID_TRANSITIONS` (types.ts:33-40) as authoritative, or should the backend be considered regressed and fixed? **Recommendation**: cite code as authoritative; flag SPEC-V3-INBOX-001 §4.3 for correction in a follow-up sync.
2. **Q2 (DISCREPANCY-2 resolution)**: Does Phase D include a "set final_answer" UI? **Recommendation**: NO — Phase D enables approve only when `finalAnswer` is already truthy. final_answer editing is deferred (TRIAGE C-2 or a later Phase D.2).
3. **Q3 (Activity feed data source)**: Is there an existing audit-log fetch endpoint, or does this SPEC need a thin wrapper (e.g., `GET /api/inbox/[id]/audit`)? **Action**: verify during run phase ANALYZE; if none exists and the activity feed is in scope, add a minimal read endpoint (scope expansion to flag).
4. **Q4 (Viewer "my questions" surface)**: Does the viewer see their questions on `/chat` (inline list) or on a separate `/my-questions` route? **Recommendation**: `/chat` inline panel (least surface area).
5. **Q5 (Assignee filter)**: Is the "filter by assignee=me" in Phase D scope? **Recommendation**: defer to Phase D.2 (MVP = no filter; just `showArchived` toggle).

---

## §14 References

- **Research**: `.moai/specs/SPEC-V3-UI-001/research.md` (deep backend contract verification, 2026-07-03).
- **Backend SPEC**: `.moai/specs/SPEC-V3-INBOX-001/spec.md` v1.1.1 (PR #322, implemented).
- **Backend source of truth**:
  - `lib/domains/inbox/types.ts:17` (TriageState), `:33-40` (VALID_TRANSITIONS).
  - `lib/domains/inbox/state-machine.ts:19-48` (canTransition, assertValidTransition).
  - `app/api/inbox/route.ts:20-55` (GET list).
  - `app/api/inbox/[id]/route.ts:11-43` (GET detail).
  - `app/api/inbox/[id]/triage/route.ts:23-131` (PATCH triage).
  - `app/api/inbox/[id]/approve/route.ts:25-144` (POST approve ESIG).
  - `app/api/ask/route.ts` (POST viewer question).
  - `lib/auth/permissions.ts:172-177` (inbox.view, inbox.manage, ask.create).
- **Convention evidence**:
  - `components/shell/Sidebar.tsx:24-29,33-75` (NAV_ITEMS + showX prop pattern).
  - `app/(app)/layout.tsx:21-60` (server-side role resolution + showX passing).
  - `lib/queries/useDashboardStats.ts`, `stores/project.ts`, `stores/ui.ts` (query + store conventions).
- **Charter**: `~/.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/product-charter.md` (지양-2 citation, 지양-4 RA Lead approve).
- **Lessons**: L-007 (직검), L-008 (noUnusedVariables CI=error), L-009 (full test + staged scope), L-010 (migration 실DB), L-012 (next dev build 금지), L-013 (3중 맹점), L-015 (ci:* local direct check).
