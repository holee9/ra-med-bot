// @MX:NOTE [AUTO] Unit tests for orphan-cleanup cron registration (Issue 313).
// @MX:SPEC Issue 313 — orphan sources sunset (21 CFR Part 11 audit-material) / Issue #402 (coverage ratchet-up).
// @MX:REASON The handler body is orchestrator-like (Inngest step.run orchestration,
//   lazy imports of db/schema/audit/drizzle-orm, withTenantScope RLS scoping).
//   Driving it to completion requires the Inngest step-execution engine
//   (createExecution) which is an integration concern, not a unit surface.
//   These tests cover the testable surface: the exported cron schedule constant
//   and the Inngest function registration metadata (id/name/triggers/cron).
//   The handler logic (orphan detection query, per-org sunset loop, error
//   isolation, audit write) is exercised via the real-DB E2E suite instead.
// @MX:TODO #402-deep — Add handler-level tests via Inngest createExecution or
//   @inngest/test harness when available. The handler's branches (empty orgs,
//   per-org orphan detection, per-org error isolation, audit meta shape) are
//   the remaining untested surface.

import { describe, expect, it } from 'vitest';

import {
  ORPHAN_CLEANUP_CRON_SCHEDULE,
  knowledgeSourcesOrphanCleanupFn,
} from '@/lib/inngest/knowledge-sources/orphan-cleanup';

describe('ORPHAN_CLEANUP_CRON_SCHEDULE', () => {
  it('is a daily 03:00 UTC cron expression', () => {
    // 5-field POSIX cron: minute hour day-of-month month day-of-week.
    // 0 3 * * * = 03:00 every day. Daily cadence matches Issue 313 design
    // (orphan accumulation is gradual — no urgency).
    expect(ORPHAN_CLEANUP_CRON_SCHEDULE).toBe('0 3 * * *');
    expect(ORPHAN_CLEANUP_CRON_SCHEDULE.split(' ')).toHaveLength(5);
  });
});

describe('knowledgeSourcesOrphanCleanupFn (registration metadata)', () => {
  it('is a registered Inngest function', () => {
    expect(typeof knowledgeSourcesOrphanCleanupFn.id).toBe('function');
    expect(knowledgeSourcesOrphanCleanupFn.id()).toBe('knowledge-sources-orphan-cleanup');
    expect(typeof knowledgeSourcesOrphanCleanupFn.name).toBe('string');
    expect(knowledgeSourcesOrphanCleanupFn.name.length).toBeGreaterThan(0);
  });

  it('has a human-readable name', () => {
    // The name appears in the Inngest Cloud UI — assert it is meaningful.
    expect(knowledgeSourcesOrphanCleanupFn.name).toBe('Daily Orphan Sources Cleanup');
  });

  it('is triggered by the daily 03:00 UTC cron (single source of truth)', () => {
    const triggers = knowledgeSourcesOrphanCleanupFn.opts?.triggers;
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers).toHaveLength(1);
    const trigger = triggers?.[0];
    expect(trigger).toBeTruthy();
    // The cron trigger must match the exported constant — if they drift, the
    // cron would fire at an unexpected time. Both must reference the same value.
    expect(trigger).toMatchObject({ cron: ORPHAN_CLEANUP_CRON_SCHEDULE });
  });

  it('does not register an onFailure handler (no retry-side-effects configured)', () => {
    // Confirms the fn opts shape — there is no failure handler attached, so
    // a failed run relies on Inngest's default retry policy for the steps.
    expect(knowledgeSourcesOrphanCleanupFn.opts?.onFailure).toBeUndefined();
  });
});
