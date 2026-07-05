# SPEC-V3-IMPACT-UI-001 — Research (Codebase Analysis)

---
**SPEC ID:** SPEC-V3-IMPACT-UI-001
**Version:** 0.2.0
**Status:** planned
**Phase:** C-4
**Created:** 2026-07-06
**Author:** manager-spec
**Method:** L-013 direct code inspection (no self-report)
---

## §1 Research Scope

Plan-phase deep codebase analysis to ground the Impact Wizard **frontend** SPEC in verified facts. The backend (SPEC-V3-IMPACT-001, PR #349 merged) is the contract this UI consumes. Every API field, RBAC permission, route, and component pattern referenced in `spec.md` is traceable to a line in this document.

**Out of scope:** backend changes (the backend is FROZEN contract — `app/api/impact-check/route.ts` is post-merge).

## §2 Backend Contract (VERIFIED — `app/api/impact-check/route.ts`)

### 2.1 Endpoint

`POST /api/impact-check` — wrapped by `withPermission('impact.self_check')` (route.ts:32). Anonymous callers are rejected by the auth wrapper before Zod runs.

### 2.2 Request body (Zod schema, route.ts:21-28)

```ts
z.object({
  orgId: z.string(),
  productId: z.string(),
  changeType: z.enum(['bom','sw','sw-minor','label','warn','process','sterile']),
  markets: z.array(z.enum(['us','eu','kr','cn','jp'])),
  changeDetail: z.string().min(1).max(2000),
  assigneeId: z.string().optional(),
})
```

**NOTE:** Backend uses camelCase (`orgId`, `productId`, `changeType`, `changeDetail`, `assigneeId`), NOT the snake_case (`product_id`, `change_category`) that appears in the parent SPEC-V3-IMPACT-001 §API Contract. The UI MUST send camelCase. This is a verified contract drift between the parent SPEC prose and the merged implementation; the UI follows the implementation.

**NOTE:** `changeDetail.min(1)` — backend accepts 1 char minimum. Parent SPEC prose says "10..2000자". The UI will enforce a stricter minimum (10 chars) for usability guidance, but the hard validation floor is 1 char per backend.

### 2.3 Response shape (route.ts:30-44 + response assembly)

```ts
interface ImpactCheckResponse {
  matrix: Array<{ level: string; ref: string; note: string; market: string }>;
  signal: 'green' | 'yellow' | 'red';
  classification: { category: string; confidence: number; reason: string };
  similarCases?: Array<{ id: string; title: string; content: string; similarity: number }>;
  ticketId?: string;
  recommendation: string;  // 'high-confidence-auto-approve' | 'low-confidence-manual-review'
}
```

**Key observations:**
- `matrix` is an **array** (not a keyed object) — each cell carries its own `market` field. UI must index by `market` to render the per-market table.
- `classification.confidence` is a **0..1 float** (route.ts:71 multiplies by 100 only when passing to `calculateSignal`). The UI signal-light logic that compares to 0.7 / 0.9 thresholds MUST use the float directly, NOT multiply.
- `similarCases` is **absent** when `confidence < 0.8` (low-confidence branch). UI must treat absent `similarCases` as "not fetched", distinct from an empty array.
- `ticketId` is **absent** when no `assigneeId` was sent OR confidence ≥ 0.8. UI ticket CTA shows only when `ticketId` is present.
- `recommendation` is the canonical branch indicator — UI should branch on this string, not re-derive from confidence.

### 2.4 Layer flow (route.ts:48-110, verified)

```
parse → Layer 1 (matrix loop) → Layer 2 (LLM classify)
  → calculateSignal(matrix, confidence*100)
  → writeAudit('impact.check')
  → IF confidence >= 0.8: Layer 4 RAG (similarCases)
    ELSE IF assigneeId: Layer 3 ticket (ticketId)
  → response
```

**NOTE:** Layer 3 ticket creation is **gated on `assigneeId` being present** (route.ts:90). If the UI sends no `assigneeId`, low-confidence evaluations return no `ticketId`. The UI MUST either (a) require an assignee selection in the wizard, or (b) accept that low-confidence runs produce no ticket. This is a UX decision the SPEC must surface (see §6 Ambiguities).

### 2.5 Signal rules (verified via AC-IMP-09 + calculateSignal signature)

- **green:** all markets `level='not-required'` AND confidence ≥ 0.9
- **yellow:** some market `level='conditional'` OR 0.7 ≤ confidence < 0.9
- **red:** any market `level='required'` OR confidence < 0.7

The UI's SignalLight component must consume the `signal` field directly (backend-computed) — the UI MUST NOT re-compute, to avoid drift.

### 2.6 RBAC (route.ts:32 + `permissions.ts:582-596` 직검)

> **Role ladder (verified, `lib/auth/rbac.ts:14`):** `Role = 'admin' | 'qa-lead' | 'ra-lead' | 'ra-member' | 'viewer' | 'auditor'`. `employee` 역할은 **존재하지 않는다** — 이전 버전의 본 문서와 parent SPEC prose가 사용한 `employee`는 fabricated. `auditor` (`ROLE_HIERARCHY=0.5`)는 외부 감사자 전용 읽기 전용 역할로 기존 모든 minRole 게이트에서 거부됨.

| Permission | minRole | Granted roles (ladder 기준) | Enforced where |
|---|---|---|---|
| `impact.view` | `ra-member` | ra-member, qa-lead, ra-lead, admin | Page route (server-side gate, REQ-IMP-UI-001). **auditor, viewer는 거부됨.** |
| `impact.self_check` | `viewer` | viewer, ra-member, qa-lead, ra-lead, admin | API route wrapper (withPermission) |
| `impact.ra_escalate` | `ra-member` | ra-member, qa-lead, ra-lead, admin | Future: ticket CTA escalation (not in v1 UI) |

> **게이트 엄격도 역설 (H4):** 페이지 게이트(`impact.view`, minRole=`ra-member`)가 API 게이트(`impact.self_check`, minRole=`viewer`)보다 엄격하다. 따라서 viewer/auditor는 위저드 페이지 자체에 진입할 수 없어 API 호출 기회가 없다. 이는 의도된 동작 — UI는 더 안전한 서버 사이드 게이트를 신뢰한다.

**Page-level gate convention** (verified in `app/(app)/consult/page.tsx:8-13`): server component calls `auth()`, reads `session.user.role`, redirects on insufficient role. The Impact page MUST follow the same pattern.

### 2.7 Audit side-effects (route.ts:73-84)

The route writes `impact.check` audit log on every successful run. The UI does not write audit logs directly. No UI-side audit code is required.

## §3 UI Pattern References (verified)

### 3.1 Consult component pattern (`components/consult/`)

Existing components: `ConsultSessionCard`, `ConsultSessionDetail`, `ConsultSessionList`, `NewSessionDialog`, `QuestionComposer`, `TurnHistoryItem`.

**Conventions observed:**
- Each component is a single `.tsx` file under `components/consult/`.
- Tests live in `components/consult/__tests__/*.test.tsx`.
- Tests use `@vitest-environment jsdom` + RTL + `vi.mock('next-intl')` + `vi.mock('@/lib/queries/useConsult')` pattern (see `ConsultSessionList.test.tsx:14-36`).
- Data fetching via TanStack Query hooks in `lib/queries/useConsult.ts` (not raw `fetch` in components).
- Client/server split: server component page (`app/(app)/consult/page.tsx`) → client component (`ConsultSessionListClient.tsx`) → presentational components.

The Impact wizard MUST mirror this structure: `components/impact/` for presentational pieces, `lib/queries/useImpactCheck.ts` for the POST mutation, server page → client wrapper → wizard component.

### 3.2 Consult page route pattern (`app/(app)/consult/page.tsx`)

```tsx
export default async function ConsultPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;
  if (!userRole || userRole === 'viewer') redirect('/?error=access_denied');
  return <ConsultSessionListClient />;
}
```

Impact page MUST follow: server component, `auth()`, role gate against `impact.view` roles, render client wrapper.

### 3.3 i18n (`next-intl`)

- Messages live in `messages/ko.json` and `messages/en.json`.
- Consult tests mock `useTranslations` (ConsultSessionList.test.tsx:18-20).
- The Impact wizard MUST add an `impact` top-level key to both message files.
- All wizard copy MUST be keyed — no inline Korean/English strings in components (L-008 style discipline).

### 3.4 Design system / tokens

- Tailwind v4 `@theme` tokens in `app/globals.css`: `--color-brand-{50..900}`, plus `--d-pms`, `--d-cc`, `--danger` referenced in parent SPEC retestMatrix market colors.
- Light/dark mode is active (consult components support both).
- Serif/Sans discipline: page titles serif, body sans (consult pattern).
- WCAG 2.1 AA enforced by `ci:contrast` gate.

Signal-light colors: green/yellow/red. The UI MUST NOT use raw `green-500`/`red-500` — it MUST use semantic tokens that map to the brand palette and pass contrast in both light/dark. Exact token names to be chosen at run phase (deferred per "WHAT not HOW" rule).

### 3.5 Test framework

- Vitest + React Testing Library + jsdom.
- Tests live alongside components: `components/impact/__tests__/*.test.tsx`.
- Mock patterns: `vi.mock('next-intl')`, `vi.mock('@/lib/queries/useImpactCheck')`, `vi.mock('next/navigation')`.
- Coverage gate: 85% (parent SPEC quality.yaml).

## §4 Greenfield Status

**Verified:** No `components/impact/` directory exists. No `app/(app)/impact/` route exists. No `useImpactCheck` hook exists. This is a pure greenfield build — no regression risk for UI (backend non-regression was handled in parent SPEC).

## §5 Dependencies

### 5.1 Internal (consumed)
- `POST /api/impact-check` — sole backend dependency (frozen contract, §2).
- `auth()` + role types from `@/lib/auth` — for page-level gate.
- TanStack Query — for the `useImpactCheck` mutation hook.
- `next-intl` — for i18n.

### 5.2 External (UI)
- Radix UI primitives — for accessible multi-step wizard navigation, dialogs, checkboxes (consistent with consult UI).
- Tailwind v4 — styling.

### 5.3 NOT imported
- No SSE/streaming client — the `/api/impact-check` route is a synchronous JSON POST (verified: no `ReadableStream` / `EventSource` in route.ts). The wizard result page is a normal loading → success state, NOT a streaming answer. Do not copy `useStreamingAnswer` from consult — that pattern is for the chat SSE endpoint only.

## §6 Ambiguities & Blockers (must surface in spec.md)

### A1. Product data source — UNRESOLVED
The backend accepts `productId: z.string()` but there is **no products list API** in the codebase and no `products` table in `lib/db/schema.ts` (only `labeling_documents.product_name` text column at schema.ts:2469, and `productStandardsCompliance.productId` text at schema.ts:3231). The wizard Step 1 needs a product picker, but the source of the product list is unclear.

**Options:**
- (a) Step 1 reads from an existing project/portfolio list (e.g., `projects` table or `labeling_documents` distinct `product_name`). **Not verified — needs confirmation.**
- (b) Step 1 is a free-text `productId` input (matches backend's loose schema). Lowest risk, poorest UX.
- (c) A new `GET /api/products` endpoint is added — but that is **out of scope** (backend changes belong to a follow-up SPEC).

**SPEC resolution:** Default to (b) free-text `productId` input for v1, with a NOTE that (a)/(c) are follow-up enhancements. This keeps the UI self-contained and avoids inventing a product list that doesn't exist (L-002 anti-pattern guardrail).

### A2. `assigneeId` and Layer 3 ticket creation — UX DECISION NEEDED
Backend creates a ticket only if `assigneeId` is present (route.ts:90). For ra-member/qa-lead/ra-lead/admin roles (위저드 진입 가능 역할), who should the assignee be?

**Options:**
- (a) The UI omits `assigneeId` → low-confidence runs produce no ticket → user sees "RA review recommended" CTA without a created ticket.
- (b) The UI auto-assigns to a default RA queue (requires a backend route to resolve default assignee — out of scope).
- (c) The UI shows an optional "Assign to" picker visible only to `ra-member+` roles (who can pick themselves or a teammate).

**SPEC resolution:** Default to (a) for v1 — the UI omits `assigneeId` and surfaces the `recommendation='low-confidence-manual-review'` result with a static "Contact RA" CTA. This avoids inventing an assignee-resolution backend. The ticket CTA in the result page links to `/inbox` (existing) rather than a created ticket.

### A3. Phase C-4 label — needs roadmap confirmation
Parent SPEC is C-3. `docs/v3/README.md` lists "Phase 3 · Impact Check" with items 12-14 but does not explicitly label the UI follow-up as "C-4". The orchestrator's task brief assigns `phase: C-4`. Treated as correct per orchestrator instruction; flagged for plan-auditor cross-check.

### A4. `changeDetail` minimum length drift
Parent SPEC prose says 10..2000 chars; backend Zod is `min(1).max(2000)`. UI will enforce 10..2000 client-side (stricter) and surface a helpful counter. If the user pastes <10 chars the UI blocks submit; the backend's `min(1)` is a defense-in-depth floor, not the UX target.

## §7 Plan-auditor Focus Areas

1. **Contract fidelity** — every field name, type, and branch in spec.md MUST trace to §2 of this research. Watch for accidental snake_case drift from the parent SPEC prose.
2. **No streaming** — the result page is a normal async mutation, NOT SSE. Reject any spec language implying `useStreamingAnswer` or `EventSource`.
3. **`similarCases` absent vs empty** — spec MUST distinguish "low-confidence branch (field omitted)" from "high-confidence branch with zero matches (empty array)".
4. **Confidence units** — spec MUST state confidence is 0..1 float, NOT percentage.
5. **No invented endpoints** — the spec MUST NOT reference `/api/products`, `/api/ra/assignees`, or any endpoint not present in the codebase.
6. **Scope discipline** — UI only. Any backend change suggested by §6 ambiguities is out of scope and deferred.

---

**Generated:** 2026-07-06
**Inspection basis:** `app/api/impact-check/route.ts` (post-PR-#349), `components/consult/`, `app/(app)/consult/page.tsx`, `lib/domains/impact/index.ts`, `lib/db/schema.ts`, `messages/ko.json`, parent SPEC `.moai/specs/SPEC-V3-IMPACT-001/{spec,plan,acceptance}.md`.
