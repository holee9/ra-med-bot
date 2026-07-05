---
id: SPEC-V3-UI-001
version: 0.2.0
status: draft
created: 2026-07-03
updated: 2026-07-05
author: manager-spec
priority: high
issue_number: 326
---

# SPEC-V3-UI-001 — Compact Spec (Run Phase Load)

> 본 문서는 run phase 로딩 최적화 버전이다. REQ, AC 요약, 수정 파일, Exclusions만 포함한다(원본: spec.md / acceptance.md / plan.md). 토큰 약 30% 절감.

## Requirements (EARS — 41 REQs, 6 modules)

### Module 1 — Kanban Board Rendering & Data Fetching

- **REQ-V3-UI-001** (Ubiquitous): The system **shall** render a 4-column Kanban (`auto`/`needs-review`/`escalated`/`waiting`) for `inbox.view`(ra-member+) on `/inbox`. Terminal states(`closed`/`rejected`) are NOT columns.
- **REQ-V3-UI-002** (Event-Driven): **When** Kanban mounts/regains focus, the system **shall** fetch 4 columns in parallel via `GET /api/inbox?state=<state>&limit=50`.
- **REQ-V3-UI-003** (State-Driven): **While** query loading → skeleton per column; **while** query errored → error state + retry button.
- **REQ-V3-UI-004** (Optional): **Where** `slaDeadline` exists → SLA badge with relative time; overdue style when `slaDeadline < now`.
- **REQ-V3-UI-005** (Ubiquitous): Terminal-state tickets rendered ONLY via "archived" filter, never as columns.

### Module 2 — Ticket Detail & ESIG Approve

- **REQ-V3-UI-010** (Event-Driven): **When** card clicked → navigate to `/inbox/[id]`, fetch `GET /api/inbox/[id]`.
- **REQ-V3-UI-011** (Ubiquitous): Detail page **shall** display: question, autoAnswer(+citations), raAssignee, escalateTo, slaDeadline, triageState, approvedBy/At, finalAnswer, audit timeline.
- **REQ-V3-UI-012** (State-Driven): **While** user is `ra-lead`/`admin` AND `finalAnswer` set AND non-terminal → show "Approve (ESIG)".
- **REQ-V3-UI-013** (Event-Driven): **When** approve submitted → `POST /api/inbox/[id]/approve` with body `{password, esigSignature}` (approve/route.ts:19-22); disable submit + "서명 중..." pending.
- **REQ-V3-UI-014** (Unwanted): **If** 401 invalid password → inline "비밀번호가 올바르지 않습니다" on password field; **SHALL NOT** navigate or show generic toast.
- **REQ-V3-UI-015** (Unwanted): **If** 400 "Cannot promote" (missing final_answer) → blocking message "먼저 최종 답변을 설정하세요"; **SHALL NOT** auto-retry.
- **REQ-V3-UI-016** (Event-Driven): **When** 200 → invalidate `/inbox` cache + navigate to Kanban + success toast.

### Module 3 — Triage Action UI

- **REQ-V3-UI-020** (State-Driven): **While** `ra-lead`/`admin` AND non-terminal → per-card action menu offering ONLY transitions in `VALID_TRANSITIONS[currentState]` (types.ts:33-40, code-authoritative).
- **REQ-V3-UI-021** (Event-Driven): **When** transition picked → optimistic update + `PATCH /api/inbox/[id]/triage` `{toState, reason?}`.
- **REQ-V3-UI-022** (Unwanted): **If** 409 → revert optimistic + toast "상태 전이 실패 — 새로고침 후 다시 시도하세요".
- **REQ-V3-UI-023** (Unwanted): **If** 404 (IDOR/not-in-org) → remove card from cache + console warning.
- **REQ-V3-UI-024** (Optional): **Where** target is `rejected`/`escalated` → prompt for optional `reason` (max 500 chars).

### Module 4 — Role-Based Access & Viewer

- **REQ-V3-UI-030** (Ubiquitous): Server-gate `/inbox` — only `ra-member`/`ra-lead`/`admin`; `viewer`/`employee` redirect → `/chat`.
- **REQ-V3-UI-031** (Ubiquitous): Sidebar "Inbox" entry shown only when role is `ra-member`+ (via `showInbox` prop from layout.tsx).
- **REQ-V3-UI-032** (State-Driven): **While** `ra-member` (not `ra-lead`) → hide all `inbox.manage` actions; Kanban read-only.
- **REQ-V3-UI-033** (Event-Driven): **When** viewer submits question via `/chat` → `POST /api/ask`; on success show `ticket_id` + `triage_state` in inline "내 질문 상태" panel.
- **REQ-V3-UI-034** (Optional): **Where** viewer visits own ticket URL → minimal "내 질문 상세" (question + triageState + approved answer if any); RA-only fields gated.

### Module 5 — Cross-Cutting

- **REQ-V3-UI-040** (Ubiquitous): Add `inbox` i18n namespace to `messages/{ko,en}.json` — keys: title, columns.{auto,needsReview,escalated,waiting,closed,rejected}, actions.{approve,reject,assign,escalate,refresh}, sla.{overdue,remaining}, empty, loading, errors.{transitionFailed,approveFailed,passwordInvalid,missingFinalAnswer}.
- **REQ-V3-UI-041** (Ubiquitous): Apply triage-state design tokens consistently — auto=brand-300, needs-review=amber-500, escalated=orange-500, waiting=blue-500, closed=ink-300, rejected=red-500.
- **REQ-V3-UI-042** (Ubiquitous): Meet WCAG 2.1 AA — keyboard-reachable, ARIA labels on icon-only buttons, contrast ≥ 4.5:1, focus visible.
- **REQ-V3-UI-043** (Unwanted): **If** 403 → inline "접근 권한이 없습니다"; **SHALL NOT** crash or show raw JSON.
- **REQ-V3-UI-044** (Optional): **Where** column has 0 tickets → empty-state illustration + i18n `inbox.empty`.
- **REQ-V3-UI-045** (Ubiquitous): Use `tanstack-query` with `staleTime: 60_000` + `revalidateOnFocus: true` for all inbox reads; provide manual "새로고침" button.

### Module 6 — Consult (Power Chat) Session History UI

- **REQ-V3-UI-050** (Ubiquitous): The system **shall** render consult session list on `/consult` for `consult.session.view`(ra-member+). ra-member sees own sessions; ra-lead/admin sees all org.
- **REQ-V3-UI-051** (Event-Driven): **When** consult list mounts/regains focus, fetch via `GET /api/consult/sessions?limit=50&offset=0`. Pagination via "Load More" button.
- **REQ-V3-UI-052** (Event-Driven): **When** "New Session" clicked → show dialog + `POST /api/consult/sessions` `{title:1-200, projectId?, locale?}`.
- **REQ-V3-UI-053** (Event-Driven): **When** session create succeeds(201) → navigate to `/consult/[sessionId]`.
- **REQ-V3-UI-054** (Event-Driven): **When** session card clicked → navigate to `/consult/[sessionId]` + fetch `GET /api/consult/sessions/[sessionId]`. Render turns turnNumber ASC.
- **REQ-V3-UI-055** (State-Driven): **While** on session detail, show question input(1-5000 chars) + submit button.
- **REQ-V3-UI-056** (Event-Driven): **When** question submitted → `POST /api/consult/sessions/[sessionId]/turns` `{question}` + disable submit.
- **REQ-V3-UI-057** (State-Driven): **While** turn creating → show "답변 생성 중..." + do NOT append to history.
- **REQ-V3-UI-058** (Event-Driven): **When** turn succeeds(201) → append turn to history + render answer/citations/confidence.
- **REQ-V3-UI-059** (Unwanted): **If** turn fails(400) → show error BUT still render turn in history (RA feedback).
- **REQ-V3-UI-060** (Unwanted): **If** session 404 (not-found/cross-user) → show "세션을 찾을 수 없습니다" + redirect to `/consult`.
- **REQ-V3-UI-061** (Optional): **Where** turn has citations → reuse `Citation`/`SourcesGrid` components.
- **REQ-V3-UI-062** (Ubiquitous): Add "Consult" to Sidebar with `showConsult` prop(ra-member+). Follow `showInbox` pattern.

---

## Code-Authoritative Contracts (§7 of spec.md)

1. **VALID_TRANSITIONS** — `lib/domains/inbox/types.ts:33-40` is the single source. `auto:['needs-review']` only; `waiting:['needs-review','closed']` (no rejected); no universal any→rejected.
2. **Approve body** — `app/api/inbox/[id]/approve/route.ts:19-22` Zod schema: `{password, esigSignature}` ONLY. NOT `{final_answer, citations[], esig:{...}}` (SPEC-V3-INBOX-001 §4.5 text is wrong; code wins).
3. **Phase D excludes** final_answer editing UI — approve enabled only when `finalAnswer` is truthy (REQ-V3-UI-012).

---

## Acceptance Criteria Summary (13 scenarios — see acceptance.md for full GWT)

| AC | Scenario | REQs |
|----|----------|------|
| AC-UI-001 | Kanban renders 4 cols; viewer blocked; ra-member+ sees; Sidebar gating | 001, 030, 031 |
| AC-UI-002 | Parallel fetch 4 cols; revalidateOnFocus; manual refresh button | 002, 045 |
| AC-UI-003 | TriageActionMenu shows only VALID_TRANSITIONS-allowed; ra-member read-only | 020 |
| AC-UI-004 | Optimistic transition + 409 rollback + toast; 200 invalidates both cols | 021, 022 |
| AC-UI-005 | IDOR 404 → card removed from cache + console warn | 023 |
| AC-UI-006 | ApproveDialog 2-step; 401 inline password error; submit disabled during pending | 012, 013, 014 |
| AC-UI-007 | 400 "Cannot promote" → blocking message; no auto-retry | 015 |
| AC-UI-008 | 200 → cache invalidated + navigate Kanban + success toast | 016 |
| AC-UI-009 | Viewer ask.create → ticket_id+triage_state inline panel; own-ticket minimal; other 404 | 033, 034 |
| AC-UI-010 | i18n ko/en via next-intl; axe 0 critical; design tokens consistent; 403 inline | 040, 041, 042, 043 |
| AC-UI-011 | SLA badge: relative time; overdue style when slaDeadline < now; absent when null | 004 |
| AC-UI-012 | Terminal states only via showArchived toggle; never as Kanban columns | 005 |
| AC-UI-013 | reason prompt (max 500 chars) for rejected/escalated targets; optional; skipped for other targets | 024 |

**Edge cases (11)**: empty board, network error, concurrent 409, session expiry mid-ESIG, stale cache on focus, IDOR, approve browser-close, missing final_answer 400, viewer forced redirect, 50+ tickets pagination limit, activity-feed audit endpoint absence (Q3 scope expansion flag).

---

## Files to Modify

### `[NEW]` Create (12 files)

- `app/(app)/inbox/page.tsx` — Kanban board page (client).
- `app/(app)/inbox/[id]/page.tsx` — Ticket detail route.
- `components/inbox/InboxKanban.tsx` — Kanban shell.
- `components/inbox/KanbanColumn.tsx` — Single column renderer.
- `components/inbox/TicketCard.tsx` — Compact card.
- `components/inbox/TriageActionMenu.tsx` — Radix DropdownMenu, VALID_TRANSITIONS-driven.
- `components/inbox/ApproveDialog.tsx` — Radix Dialog, password + esigSignature, 2-step.
- `components/inbox/ActivityTimeline.tsx` — Audit log timeline.
- `components/inbox/SlaBadge.tsx` — SLA relative-time + overdue.
- `components/inbox/ViewerTicketSummary.tsx` — Viewer own-ticket minimal view.
- `lib/queries/useInbox.ts` — tanstack-query hooks (useInboxTickets, useInboxTicket, useTriageTransition, useApproveTicket).
- `stores/inbox.ts` — Zustand store (selectedTicketId, showArchived).

### `[MODIFY]` Edit (5 files)

- `components/shell/Sidebar.tsx` — Add `showInbox?: boolean` prop + "Inbox" NavItem (after "히스토리", L33-75 pattern).
- `app/(app)/layout.tsx` — Resolve `showInbox = hasRole(userRole, 'ra-member')` server-side, pass to Sidebar (L21-60 pattern).
- `app/(app)/chat/page.tsx` — Surface ticket_id + triage_state after ask.create (inline panel).
- `messages/ko.json` — Add `inbox` namespace (verified missing 2026-07-03).
- `messages/en.json` — Add `inbox` namespace (verified missing 2026-07-03).

### `[EXISTING]` Consume, DO NOT Modify

- `app/api/inbox/route.ts`, `app/api/inbox/[id]/route.ts`, `app/api/inbox/[id]/triage/route.ts`, `app/api/inbox/[id]/approve/route.ts`, `app/api/ask/route.ts`.
- `lib/domains/inbox/**` (types.ts, state-machine.ts, queries.ts, access.ts, promote.ts, audit.ts, sla.ts).
- `lib/auth/permissions.ts`, `lib/auth/with-permission.ts`, `lib/auth/rbac.ts`.

---

## Exclusions (12 items — HARD scope boundaries)

1. WebSocket realtime (`/api/inbox/subscribe`).
2. Drag-and-drop column moves (ESIG needs password; WCAG; Charter 지양-4).
3. Bulk actions (multi-select triage/approve).
4. Auto-polling (interval-based refetch).
5. New backend APIs (exception: Q3 audit wrapper if needed, scope-expansion flag).
6. New permissions (reuse inbox.view / inbox.manage / ask.create).
7. TRIAGE auto-answer injection UI (SPEC-V3-TRIAGE-001 C-2).
8. Consult 고급 기능 (DELETE soft-delete UI, 실시간 streaming, 세션 제목 편집, 검색/필터링).
9. Admin audit-log viewer (separate `app/(app)/audit/`).
10. Kanban list-view toggle (MVP Kanban-only).
11. final_answer editing UI (deferred to TRIAGE C-2 / Phase D.2; Q2 decision).
12. Assignee filter (deferred to Phase D.2; Q5 decision — MVP only `showArchived` toggle).

---

## Quality Gates (run phase)

- TS: 0 new errors (`pnpm ci:typecheck`).
- Biome: CI threshold (`pnpm ci:lint` — L-008/L-015 local direct check).
- Tests: 80%+ coverage on new components/hooks.
- E2E: approve happy path, viewer redirect.
- WCAG axe: 0 critical on `/inbox`, `/inbox/[id]`, ApproveDialog.
- Lighthouse a11y ≥ 90.
- Build: stop `next dev` before `pnpm build` (L-012).
- All `pnpm ci:*` local green before merge (L-015).
