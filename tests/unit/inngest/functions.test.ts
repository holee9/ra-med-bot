// @MX:NOTE [AUTO] Unit tests for the Inngest function registry (lib/inngest/functions.ts).
// @MX:SPEC SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001 / SPEC-REGULA-KNOWLEDGE-GAP-001 / SPEC-REGULA-STANDARDS-001 / SPEC-REGULA-KNOWLEDGE-PROMO-001 / Issue #402 (coverage ratchet-up).
// Verifies the `functions` array is a non-empty array of registered Inngest functions
// and that every expected function (by id) is present — the serve endpoint relies on
// this single source of truth for registration.

import { describe, expect, it } from 'vitest';

import { functions } from '@/lib/inngest/functions';

describe('inngest function registry (lib/inngest/functions.ts)', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(functions)).toBe(true);
    expect(functions.length).toBeGreaterThan(0);
  });

  it('every entry is a registered Inngest function (has id + name + triggers)', () => {
    for (const fn of functions) {
      // Inngest functions expose id() and a name getter; opts.triggers is the
      // registration config. These three together confirm a real registration.
      expect(typeof fn.id).toBe('function');
      expect(typeof fn.id()).toBe('string');
      expect(fn.id().length).toBeGreaterThan(0);
      expect(typeof fn.name).toBe('string');
      expect(fn.name.length).toBeGreaterThan(0);
      expect(Array.isArray(fn.opts?.triggers)).toBe(true);
      expect((fn.opts?.triggers ?? []).length).toBeGreaterThan(0);
    }
  });

  it('includes every expected registered function id (single source of truth)', () => {
    const ids = functions.map((fn) => fn.id());
    // Mirror the order in lib/inngest/functions.ts — adding a function without
    // registering it here is a registration bug (serve endpoint would miss it).
    expect(ids).toEqual([
      'digest-weekly-cron',
      'knowledge-gap-daily-digest',
      'docingest-upload-processed',
      'standards-revision-daily',
      'audit-chain-verify-daily',
      'messages-embedding-backfill',
      'knowledge-sources-orphan-cleanup',
    ]);
  });

  it('all function ids are unique (no accidental duplicate registration)', () => {
    const ids = functions.map((fn) => fn.id());
    expect(new Set(ids).size).toBe(ids.length);
  });
});
