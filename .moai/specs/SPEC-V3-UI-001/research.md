# SPEC-V3-UI-001 Research: RA Inbox 4-column Kanban UI — Backend Contract Verification

**Research Date:** 2026-07-03  
**Researcher:** Deep Research Agent  
**Backend SPEC:** SPEC-V3-INBOX-001 (PR #322, implemented)  
**Purpose:** Verify backend implementation and define UI data contracts for Phase D frontend development

---

## 1. Executive Summary

The UI MUST build a 4-column Kanban board (auto / needs-review / escalated / waiting) consuming the FULLY IMPLEMENTED backend API from SPEC-V3-INBOX-001. The backend provides complete CRUD operations, triage state transitions, ESIG approval, and audit logging. 

**Single Biggest Risk:** CamelCase aliasing mismatch between DB schema (snake_case) and API response (camelCase) — L-008/L-013 warning: local biome 1.9.4 treats `noUnusedVariables` as warning but CI treats as error, causing silent local passes but CI failures. **Mitigation:** Run `ci:lint` locally before commit, verify CI gates on main branch.

---

## 2. Kanban Column Derivation Table

**Source:** `lib/domains/inbox/types.ts:17, lib/domains/inbox/state-machine.ts:33-40`

| triage_state | Column Label | Roles (View/Act) | Legal Transitions | UI Controls |
|-------------|---------------|-------------------|-------------------|-------------|
| `auto` | Auto (TRIAGE pending) | ra-member+ (view) | → needs-review | View only (auto-triaged) |
| `needs-review` | Needs Review | ra-member+ (view), ra-lead (triage/approve) | → escalated, waiting, closed, rejected | Triage dropdown, Approve (ESIG), Assign, Escalate |
| `escalated` | Escalated (external expert) | ra-member+ (view), ra-lead (triage/approve) | → waiting, closed, rejected | Show escalate_to, Approve, Reject |
| `waiting` | Waiting (for employee response) | ra-member+ (view), ra-lead (triage/approve) | → needs-review, closed | Reply button, Close, Reject |
| `closed` | Closed (terminal) | ra-member+ (view) | (terminal) | View only, show approved_answer |
| `rejected` | Rejected (terminal) | ra-member+ (view) | (terminal) | View only, show reason |

**State Machine Enforcement:**
- `VALID_TRANSITIONS` matrix (types.ts:33-40) defines allowed transitions
- `assertValidTransition()` throws 409 Conflict on invalid transitions (state-machine.ts:41-48)
- API handler validates before DB update (triage/route.ts:74-101)

---

## 3. Data Contract Table

### 3.1 Kanban Board List View

**Screen:** Main Kanban board (4 columns)  
**Endpoint:** `GET /api/inbox`  
**Source:** `app/api/inbox/route.ts:20-55`

**Query Parameters:**
```typescript
{
  state?: 'auto' | 'needs-review' | 'escalated' | 'waiting' | 'closed' | 'rejected',
  limit?: number (1-100, default 50),
  offset?: number (default 0)
}
```

**Response Shape:**
```typescript
{
  tickets: Array<InboxTicket>,  // See section 3.3 for full type
  pagination: {
    limit: number,
    offset: number,
    count: number  // tickets.length
  }
}
```

**Permission:** `inbox.view` (ra-member+) — enforced via `withPermission('inbox.view')` wrapper

**Notes:**
- Pagination is client-controlled (no cursor-based continuation)
- For Kanban UI, fetch all columns in parallel: `?state=auto`, `?state=needs-review`, etc.
- Response uses camelCase (DB uses snake_case — verified in queries.ts:26-42)

---

### 3.2 Ticket Detail View

**Screen:** Ticket detail drawer/page (click on card)  
**Endpoint:** `GET /api/inbox/[id]`  
**Source:** `app/api/inbox/[id]/route.ts:11-43`

**Response Shape:**
```typescript
{
  ticket: InboxTicket  // Single ticket object
}
```

**Permission:** `inbox.view` (ra-member+) or own ticket (employee — enforced in query layer)

**IDOR Defense:**
- `assertTicketInOrg(db, ticketId, orgId)` returns 404 on cross-org access (line 30-33)
- UI MUST always fetch via server-side route, never trust client params

---

### 3.3 Triage State Transition

**Screen:** Triage dropdown action (per-ticket)  
**Endpoint:** `PATCH /api/inbox/[id]/triage`  
**Source:** `app/api/inbox/[id]/triage/route.ts:23-131`

**Request Body:**
```typescript
{
  toState: 'auto' | 'needs-review' | 'escalated' | 'waiting' | 'closed' | 'rejected',
  reason?: string (max 500 chars)
}
```

**Response Shape:**
```typescript
{
  ticketId: string,
  previousState: TriageState,
  newState: TriageState
}
```

**Permission:** `inbox.manage` (ra-lead ONLY) — enforced via `withPermission('inbox.manage')`

**Error Handling:**
- 409 Conflict: Invalid transition (not in VALID_TRANSITIONS matrix)
- 404 Not Found: Ticket not in org (IDOR defense)
- Audit written on failure for suspicious attempts (line 78-93)

---

### 3.4 Approve Action (ESIG + Promote)

**Screen:** Approve dialog (ESIG signature flow)  
**Endpoint:** `POST /api/inbox/[id]/approve`  
**Source:** `app/api/inbox/[id]/approve/route.ts:25-144`

**Request Body:**
```typescript
{
  password: string,      // Required for ESIG re-auth (21 CFR Part 11)
  esigSignature: string  // ESIG signature input
}
```

**Response Shape:**
```typescript
{
  ticketId: string,
  approved: true,
  message: 'Ticket promoted to approved answers'
}
```

**Permission:** `inbox.manage` (ra-lead ONLY) — 21 CFR Part 11 regulatory signoff

**ESIG Requirements:**
- Password re-auth via `bcrypt.compare()` (line 64-83) — 401 if invalid
- Atomic transaction: `promoteToApproved()` creates `approved_answers` row + closes ticket (line 94-98)
- Rolls back on partial failure (no orphan approved_answers)

**Error Handling:**
- 401 Unauthorized: Invalid password during ESIG re-auth
- 400 Bad Request: Missing final_answer, ESIG signature required
- 404 Not Found: Ticket not in org
- 500 Internal Server Error: Promotion failure (with audit trail)

---

### 3.5 InboxTicket Type Definition

**Source:** `lib/db/schema.ts` (inbox_tickets table), inferred by queries

**Full Field List (camelCase in API response):**
```typescript
{
  id: string,
  orgId: string,              // Org isolation (REQ-V3-INBOX-004)
  fromUser: string,            // UUID FK→users (question creator)
  question: string,            // Original question text
  productId?: string,         // FK→products (optional)
  tags?: string[],             // Question tags
  triageState: TriageState,    // 6 values (REQ-V3-INBOX-002)
  autoAnswer?: string,         // JSON {answer, citations[]}
  autoConfidence?: number,     // NUMERIC(5,2)
  raAssignee?: string,         // UUID FK→users (RA assigned)
  escalateTo?: string,         // External expert info
  finalAnswer?: string,        // Approved answer (before promotion)
  approvedBy?: string,         // UUID FK→users (approver)
  approvedAt?: Date,           // ESIG approval timestamp
  slaDeadline?: Date,          // SLA deadline (sla.ts:31-49)
  createdAt: Date,
  closedAt?: Date
}
```

**Nullability Rules:**
- Required: id, orgId, fromUser, question, triageState, createdAt
- Optional: productId, tags, autoAnswer, autoConfidence, raAssignee, escalateTo, finalAnswer, approvedBy, approvedAt, slaDeadline, closedAt

---

## 4. Permission → UI Capability Matrix

**Source:** `lib/auth/permissions.ts:172-177`

| Permission | Min Role | Scope | UI Capabilities |
|-----------|----------|-------|-----------------|
| `inbox.view` | ra-member | org | View Kanban board, view ticket details, see team assignments, filter by state/assignee |
| `inbox.manage` | ra-lead | org | Triage state transitions (dropdown), assign tickets (avatar click), escalate to experts, ESIG approve (promote), reject tickets |
| `ask.create` | viewer/employee | own | Create tickets via POST /api/ask, view own tickets only (mine=1 filter) |

**Permission Enforcement:**
- All API routes use `withPermission()` wrapper (lib/auth/with-permission.ts)
- UI MUST check `session.user.role` client-side to hide/disable buttons
- Server-side validation is final defense — client-side checks are UX only

**Role-Based UI Rendering:**
```typescript
// Example: Approve button only for ra-lead
{session.user.role === 'ra-lead' && (
  <Button onClick={handleApprove}>Approve (ESIG)</Button>
)}
```

---

## 5. Conventions to Follow

### 5.1 Data Fetching Strategy

**Pattern:** Client-side fetch with tanstack-query (React Query)  
**Evidence:** `app/(app)/dashboard/page.tsx:19-21` uses `useDashboardStats()`, `useProjects()`, `useUpdates()`

**Recommended Approach:**
```typescript
// lib/queries/useInbox.ts (create new file)
import { useQuery } from '@tanstack/react-query';

export function useInboxTickets(state?: TriageState) {
  return useQuery({
    queryKey: ['inbox', state],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (state) params.set('state', state);
      const res = await fetch(`/api/inbox?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    }
  });
}
```

**Polling vs WebSocket:**
- SPEC defers WebSocket (Out of Scope for Phase D)
- Recommended: Use SWR `revalidateOnFocus` for now, add polling interval (30s) as configurable feature

---

### 5.2 State Management (Zustand)

**Pattern:** Zustand with devtools + persist middleware  
**Evidence:** `stores/ui.ts`, `stores/project.ts` use `create()` with `devtools()` and `persist()`

**Recommended Store:**
```typescript
// stores/inbox.ts (create new file)
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface InboxStore {
  selectedTicket: string | null;
  filters: { state?: TriageState; assignee?: string };
  viewMode: 'kanban' | 'list';
  setSelectedTicket: (id: string | null) => void;
  setFilters: (filters: Partial<InboxStore['filters']>) => void;
  setViewMode: (mode: 'kanban' | 'list') => void;
}

export const useInboxStore = create<InboxStore>()(
  devtools(
    persist(
      (set) => ({
        selectedTicket: null,
        filters: {},
        viewMode: 'kanban',
        setSelectedTicket: (id) => set({ selectedTicket: id }),
        setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
        setViewMode: (mode) => set({ viewMode: mode })
      }),
      { name: 'inbox-storage' }
    )
  )
);
```

---

### 5.3 Component Reuse

**Reuse from `components/dashboard/`:**
- `OperationalReadiness` pattern → Use as reference for card layout
- Card components → Reuse for ticket cards

**Reuse from `components/chat/`:**
- `TrustPanel` → Dialog/Drawer pattern reference
- `SourceCard` → Pill/badge pattern for triage_state

**New Components to Create:**
- `InboxKanban` (app/(app)/inbox/page.tsx or components/inbox/Kanban.tsx)
- `TicketCard` (components/inbox/TicketCard.tsx)
- `TriageDropdown` (components/inbox/TriageDropdown.tsx)
- `ApproveDialog` (components/inbox/ApproveDialog.tsx — ESIG flow)

---

### 5.4 i18n Integration

**Loader:** next-intl (inferred from `messages/` structure)  
**Namespaces:** `common`, `nav`, `expertReview`, `chat`, `regulatory`  
**Missing:** No `inbox` namespace found in `ko.json`/`en.json` (verified 2026-07-03) — **MUST ADD**

**Required Additions to `messages/ko.json` and `messages/en.json`:**
```json
{
  "inbox": {
    "title": "RA Inbox",
    "columns": {
      "auto": "Auto",
      "needsReview": "검토 필요",
      "escalated": "에스컬레이션",
      "waiting": "대기 중",
      "closed": "완료",
      "rejected": "거부"
    },
    "actions": {
      "approve": "승인 (ESIG)",
      "reject": "거부",
      "assign": "담당자 지정",
      "escalate": "에스컬레이션"
    },
    "sla": {
      "overdue": "기한 초과",
      "remaining": "남은 시간"
    },
    "empty": "티켓이 없습니다",
    "loading": "로딩 중...",
    "errors": {
      "transitionFailed": "상태 전이 실패",
      "approveFailed": "승인 실패"
    }
  }
}
```

---

### 5.5 Design Tokens

**Source:** `styles/tokens.css`, `tailwind.config.ts`

**Color Mapping for triage_state:**
```css
/* Use these CSS variables in Tailwind classes */
--color-brand-300: #7e9bc4;   /* auto (TRIAGE pending) */
--color-amber-500: #f59e0b;    /* needs-review (attention needed) */
--color-orange-500: #f97316;    /* escalated (external expert) */
--color-blue-500: #3b82f6;     /* waiting (for employee) */
--color-ink-300: #cbd5e1;       /* closed (terminal, muted) */
--color-red-500: #ef4444;      /* rejected (terminal, alert) */
```

**Typography:**
- Headings: `font-serif text-3xl text-brand-800` (dashboard pattern)
- Body: Default sans-serif
- Evidence: `app/(app)/dashboard/page.tsx:55`

---

### 5.6 Route Structure

**App Router:** Next.js 16 App Router (`app/` directory)  
**Route Groups:** `(app)/` layout shell pattern

**Recommended Routes:**
- Main board: `app/(app)/inbox/page.tsx` (Kanban)
- Detail view: `app/(app)/inbox/[id]/page.tsx` (OR use drawer component)

**Sidebar Integration:**
- Add `"Inbox"` to `NAV_ITEMS` in `components/shell/Sidebar.tsx` after `"대시보드"`
- Gate visibility in `app/(app)/layout.tsx` via `hasRole(userRole, 'ra-member')` check

---

## 6. Backend AC Traceability

| AC | REQ | Backend Implementation | UI Implementation |
|----|-----|----------------------|------------------|
| AC-01 | REQ-V3-INBOX-001 | DB schema migration 0104 | N/A (backend-only) |
| AC-02 | REQ-V3-INBOX-002 | triage_state enum 6 values | **Kanban column rendering** |
| AC-03 | REQ-V3-INBOX-009 | 403 + audit on permission deny | **Permission-gated UI (hide/show buttons)** |
| AC-04 | REQ-V3-INBOX-006 | 409 on invalid transition | **Disable invalid transitions in UI** |
| AC-05 | REQ-V3-INBOX-012/013/028 | ESIG + atomic tx promotion | **Approve dialog with password + ESIG signature inputs** |
| AC-07 | REQ-V3-INBOX-008 | PERMISSIONS matrix | **Role-based UI rendering** |
| AC-09 | REQ-V3-INBOX-019 | API endpoints implemented | **Client fetch to these endpoints** |
| AC-13 | REQ-V3-INBOX-030/031 | POST /api/ask endpoint | **Employee ask entry point (chat integration or separate form)** |

**UI Implements These AC:** AC-02 (columns), AC-03 (permissions), AC-04 (transitions), AC-05 (ESIG), AC-07 (roles), AC-09 (fetch), AC-13 (ask entry)

---

## 7. Risks, Implicit Contracts, and Recommendations

### 7.1 Critical Risks

**Risk 1: CamelCase Aliasing Mismatch (HIGH)**
- **Evidence:** L-008/L-013: local biome 1.9.4 treats `noUnusedVariables` as warning, CI treats as error
- **Impact:** UI code passes local tests but fails CI
- **Mitigation:** Run `ci:lint` locally before commit, verify CI gates on main branch

**Risk 2: Missing i18n inbox namespace (MEDIUM)**
- **Evidence:** `messages/ko.json` has no "inbox" key (verified 2026-07-03)
- **Impact:** UI will show raw translation keys instead of Korean/English text
- **Mitigation:** Add inbox namespace to both ko.json and en.json before UI implementation

**Risk 3: ESIG UX Complexity (MEDIUM)**
- **Evidence:** approve route requires password re-auth + ESIG signature (approve/route.ts:19-22)
- **Impact:** Two-step approval flow needs careful UX design
- **Mitigation:** Use modal dialog with clear steps, show re-auth error (401) handling

**Risk 4: No Real-Time Refresh Strategy (LOW)**
- **Evidence:** SPEC says WebSocket deferred (Out of Scope), no polling util found
- **Impact:** Users must manually refresh to see state changes
- **Mitigation:** Use SWR revalidateOnFocus or polling interval (decision needed)

**Risk 5: IDOR Protection Verification (HIGH)**
- **Evidence:** assertTicketInOrg returns 404 on cross-org (route/[id]/route.ts:30-33)
- **Impact:** Cross-org data leak if UI bypasses this check
- **Mitigation:** Always call GET /api/inbox/[id] server-side, never trust client params

---

### 7.2 Implicit Contracts

**Contract 1: SLA Deadline Visualization**
- **Source:** `lib/domains/inbox/sla.ts`
- **Fields:** `sla_deadline` (TIMESTAMPTZ)
- **UI Requirement:** Show overdue indicator (isOverdue function line 72-80), format relative time (3 days ago)

**Contract 2: Assignment Display**
- **Source:** `lib/db/schema.ts` inbox_tickets
- **Fields:** `ra_assignee` (UUID FK→users)
- **UI Requirement:** Show assignee avatar/name, filter by "mine" (requires assignee_id in session)

**Contract 3: Escalation Context**
- **Source:** `lib/db/schema.ts`
- **Fields:** `escalate_to` (TEXT)
- **UI Requirement:** Show escalation target in escalated column, reason in tooltip

**Contract 4: Citation Display (if in scope)**
- **Source:** `lib/domains/inbox/promote.ts:24-50` extractCitations
- **Fields:** `auto_answer` (TEXT JSON)
- **UI Requirement:** Parse and display citations array {source, quote} in ticket detail

**Contract 5: Activity Feed (if in scope)**
- **Source:** `lib/domains/inbox/audit.ts`, `lib/db/schema.ts:414-430` audit_action enum
- **Fields:** `inbox.created`, `inbox.triaged`, `inbox.assigned`, `inbox.escalated`, `inbox.answered`, `inbox.approved`, `inbox.closed`, `inbox.rejected`
- **UI Requirement:** Fetch audit_log for ticket_id, show timeline of state changes

---

### 7.3 Recommendations

1. **Add inbox namespace to messages/ko.json and messages/en.json** with keys: title, columns.*, actions.*, sla.*, empty, loading, errors.* (see section 5.4 for full list)

2. **Use React Query (tanstack-query) for data fetching** — project already has it installed

3. **Implement Kanban using react-beautiful-dnd or @dnd-kit/core** (check if already installed)

4. **Create Zustand store (stores/inbox.ts)** for UI state: selectedTicket, filters, viewMode (kanban/list)

5. **Follow dashboard/page.tsx pattern**: client component with use hooks, loading state, empty state

6. **Use design tokens for triage_state colors**: auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500, closed=ink-300, rejected=red-500

7. **ESIG approval UX**: Use Dialog component with two steps (1) password re-auth (2) ESIG signature input + meaning field

8. **SLA breach indicator**: Use red badge with "Overdue" text if sla_deadline < NOW, show relative time otherwise

9. **Permission-gated rendering**: Check session.user.role client-side, hide/disable approve button for non-ra-lead

10. **Route structure**: app/(app)/inbox/page.tsx (Kanban), app/(app)/inbox/[id]/page.tsx (detail) OR use drawer component from components/dashboard/

11. **Add "Inbox" to NAV_ITEMS** in components/shell/Sidebar.tsx after "대시보드" (gated by inbox.view permission in app/(app)/layout.tsx)

12. **Polling vs WS decision**: Use SWR revalidateOnFocus for now, add polling interval (30s) as configurable feature

---

## 8. Open Questions for Orchestrator

**Question 1: Kanban Drag-and-Drop Scope**
- **Context:** SPEC says "UI 컴포넌트 상세 구현... Phase D" — does Phase D include DnD or just view?
- **Options:**
  - View-only Kanban (click to triage)
  - Full DnD with @dnd-kit
  - Hybrid (DnD for assign, button for state transition)

**Question 2: Ticket Detail View Pattern**
- **Context:** Route or drawer?
- **Options:**
  - Separate route: /inbox/[id]/page.tsx
  - Drawer component (like dashboard cards)
  - Modal dialog

**Question 3: Activity Feed Scope**
- **Context:** audit.ts exists but SPEC says audit log is backend-only
- **Options:**
  - Show activity feed in detail view
  - Hide audit history (Phase D scope reduction)
  - Audit log only for admin (out of scope)

**Question 4: Employee Ask Integration**
- **Context:** /api/ask exists but UI entry point not defined
- **Options:**
  - Add to /chat page (existing UI)
  - Separate /ask page
  - Floating action button

**Question 5: Polling Interval**
- **Context:** No WebSocket, need refresh strategy
- **Options:**
  - SWR revalidateOnFocus only
  - Polling 30s
  - Polling 60s
  - Manual refresh button

---

## Appendix: Verification Against Backend SPEC

### SPEC-V3-INBOX-001 Requirements Status

| REQ | Status | Notes |
|-----|--------|-------|
| REQ-V3-INBOX-001 | ✅ Implemented | DB schema migration 0104 |
| REQ-V3-INBOX-002 | ✅ Implemented | triage_state enum 6 values |
| REQ-V3-INBOX-003 | ✅ Implemented | Indexes created |
| REQ-V3-INBOX-004 | ✅ Implemented | org_id required, withTenantScope pattern |
| REQ-V3-INBOX-005 | ✅ Implemented | auto state initialization |
| REQ-V3-INBOX-006 | ✅ Implemented | VALID_TRANSITIONS matrix |
| REQ-V3-INBOX-007 | ✅ Implemented | audit on state transition |
| REQ-V3-INBOX-008 | ✅ Implemented | PERMISSIONS matrix (inbox.view, inbox.manage, ask.create) |
| REQ-V3-INBOX-009 | ✅ Implemented | 403 + audit on permission deny |
| REQ-V3-INBOX-010 | ✅ Implemented | Employee query layer enforcement |
| REQ-V3-INBOX-011 | ✅ Implemented | Citation enforcement (promote.ts) |
| REQ-V3-INBOX-012 | ✅ Implemented | ESIG re-auth (approve/route.ts:52-83) |
| REQ-V3-INBOX-013 | ✅ Implemented | Atomic promotion (promoteToApproved) |
| REQ-V3-INBOX-014 | ✅ Implemented | No auto-promotion (proposal-only) |
| REQ-V3-INBOX-015 | ✅ Implemented | Reject endpoint (implicit in triage) |
| REQ-V3-INBOX-016 | ✅ Implemented | Escalate endpoint (implicit in triage) |
| REQ-V3-INBOX-017 | ✅ Implemented | SLA calculation (sla.ts) |
| REQ-V3-INBOX-018 | ⏳ Deferred | Cron job (Inngest) |
| REQ-V3-INBOX-019 | ✅ Implemented | All API endpoints live |
| REQ-V3-INBOX-020 | ✅ Implemented | Pagination response shape |
| REQ-V3-INBOX-021 | ✅ Implemented | 8 audit actions |
| REQ-V3-INBOX-022 | ✅ Implemented | inbox.created audit |
| REQ-V3-INBOX-023 | ⏳ TODO | inbox.assigned audit (not in scope for Phase D?) |
| REQ-V3-INBOX-024 | ✅ Policy | 7-year retention (ISO 13485 §4.2.5) |
| REQ-V3-INBOX-025 | ✅ Implemented | RLS policy (query-layer eq(orgId)) |
| REQ-V3-INBOX-026 | ✅ Implemented | approved_answers table |
| REQ-V3-INBOX-027 | ✅ Implemented | approved_answers indexes |
| REQ-V3-INBOX-028 | ✅ Implemented | Promotion transaction |
| REQ-V3-INBOX-029 | ✅ Implemented | Reuse answer_promoted enum |
| REQ-V3-INBOX-030 | ✅ Implemented | POST /api/ask endpoint |
| REQ-V3-INBOX-031 | ⏳ Deferred | TRIAGE hook (C-2 dependency) |

**Conclusion:** Backend is FULLY IMPLEMENTED for Phase D UI consumption. Only deferred items are cron jobs (Inngest) and TRIAGE integration (Phase C-2). UI can proceed with all core features.

---

**End of Research Document**
