## SPEC-REGULA-TRACEABILITY-001 Progress

- Started: 2026-06-23
- Branch: feat/issue-47 (base: main)
- Issue: #47
- Mode: TDD (Brownfield Enhancement), Full SPEC single implementation

### Discovery (pre-Phase 1)
- schema.ts audit: 53 pgTable, 18 pgEnum. All traceability node tables already exist:
  source_sections, messages/message_blocks/message_sources, workflow_runs, expert_reviews,
  submission_packages/submission_interactions, risk_items/risk_controls/risk_gspr_mappings,
  regulatory_updates/regulatory_impact_assessments/impact_action_items, audit_logs.
- #36 Review Ops / #37 Submission Lifecycle OPEN but tables present -> read-only linking, not a hard blocker.
- Next migration: 0068. New enums: evidence_node_type, evidence_edge_relation + audit_action extension.
- Regression checkpoints: permissions count, audit_action enum, enterprise-migrations count.

### DEFERRED — AC-05 trigger unwired (W1, evaluator-active condition)
- **Item**: `onSourceSectionSuperseded` / `onRegulatoryUpdateSuperseded` hooks are
  defined in `lib/traceability/hooks.ts` but have ZERO call sites.
- **Reason**: The supersession WRITE path (`source_sections.superseded_by` column
  update) does not exist yet — it is Issue #45's job (delta-sync). The manual
  `staleReason` param on `POST /api/traceability/edges` is the interim workaround.
- **Scope discipline**: This is an acceptable deferral because the hook itself is
  fully implemented, tested (`stale-propagation.test.ts`), and audited. Only the
  trigger wiring is pending — and that trigger depends on #45's write path.
- **Tracking**:
  - `@MX:TODO` added at `lib/traceability/hooks.ts:29`.
  - Follow-up GitHub issue created: "[Traceability] wire stale-propagation hook
    into delta-sync supersession write (dependency on #45)".
- **References**: #47 (this SPEC), #45 (delta-sync dependency).

### Review Fixes Applied (Phase 2.8b — evaluator + security)
- C1: `verifyAnswerEdges` wired into `lib/knowledge-gap/replay.ts` (REQ-011).
- C2: Matrix filters (jurisdiction/product/packageId/riskLevel) applied in
  `lib/traceability/matrix.ts` `loadDeliverables` (REQ-005).
- C3: `unresolved_review` false positive fixed — `buildMatrix` auto-loads
  referenced nodes so the reviewerId check works in the DB path (REQ-006).
- H1: Route-level IDOR test added (`tests/unit/api/traceability-edges-route.test.ts`).
- H2: `writeAudit` accepts `tx`; edge create/delete + audit wrapped in
  `db.transaction` (21 CFR Part 11 atomicity).
- M2: Stale-propagation error in edge-create route caught + audited (never 500).
- W2: PDF export test asserts non-empty bytes (not just "didn't throw").
- L3: `Content-Disposition` filename sanitized (`sanitizeFilename`).
- L4: DB-sourced values Markdown-escaped (`escapeMd`).

