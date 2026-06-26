// @MX:NOTE [AUTO] Unit tests for transition-calculator.ts — SPEC-REGULA-STANDARDS-001 (AC-05).
// Pure date arithmetic — no DB, no I/O. AC-05: D-6 transition alert fires correctly.

import { describe, expect, it } from 'vitest';
import { calculateTransitionMilestones, getTransitionState } from '../transition-calculator';

describe('calculateTransitionMilestones', () => {
  it('returns explicit DoW-based D-12/D-6/D-3 milestones', () => {
    const dow = new Date('2027-01-15T00:00:00Z');
    const oj = new Date('2024-01-15T00:00:00Z');
    const m = calculateTransitionMilestones(oj, dow);

    expect(m.dow).toEqual(dow);
    // D-12 = 2026-01-15, D-6 = 2026-07-15, D-3 = 2026-10-15 (approx, month math).
    expect(m.d12?.getUTCFullYear()).toBe(2026);
    expect(m.d12?.getUTCMonth()).toBe(0); // January
    expect(m.d6?.getUTCMonth()).toBe(6); // July
    expect(m.d3?.getUTCMonth()).toBe(9); // October
  });

  it('falls back to 5-year transition when DoW is null (MDR Art. 120)', () => {
    const oj = new Date('2024-01-15T00:00:00Z');
    const m = calculateTransitionMilestones(oj, null);
    // 5 years = 60 months from OJ publication.
    expect(m.dow?.getUTCFullYear()).toBe(2029);
    expect(m.dow?.getUTCMonth()).toBe(0);
  });

  it('returns all-null milestones when both dates are null', () => {
    const m = calculateTransitionMilestones(null, null);
    expect(m.d12).toBeNull();
    expect(m.d6).toBeNull();
    expect(m.d3).toBeNull();
    expect(m.dow).toBeNull();
  });

  it('accepts ISO date strings', () => {
    const m = calculateTransitionMilestones('2024-01-15', '2027-01-15');
    expect(m.dow).toEqual(new Date('2027-01-15T00:00:00Z'));
  });
});

describe('getTransitionState — AC-05 D-6 alert fires', () => {
  const milestones = calculateTransitionMilestones('2024-01-15', '2027-01-15');

  it('returns null tier before D-12 (too early to alert)', () => {
    // Before D-12 (2026-01-15).
    const state = getTransitionState(milestones, new Date('2025-06-01T00:00:00Z'));
    expect(state.currentTier).toBeNull();
    expect(state.daysToDow).toBeGreaterThan(365);
  });

  it('returns info tier between D-12 and D-6', () => {
    // Between D-12 (2026-01-15) and D-6 (2026-07-15).
    const state = getTransitionState(milestones, new Date('2026-03-01T00:00:00Z'));
    expect(state.currentTier).toBe('info');
    expect(state.daysToDow).toBeGreaterThan(180);
  });

  it('AC-05: returns warn tier at D-6 (6 months before DoW)', () => {
    // D-6 ≈ 2026-07-15. Test a date just after D-6.
    const state = getTransitionState(milestones, new Date('2026-08-01T00:00:00Z'));
    expect(state.currentTier).toBe('warn');
    expect(state.daysToDow).toBeGreaterThan(90);
    expect(state.daysToDow).toBeLessThanOrEqual(180);
  });

  it('returns critical tier between D-3 and DoW', () => {
    // D-3 ≈ 2026-10-15.
    const state = getTransitionState(milestones, new Date('2026-11-01T00:00:00Z'));
    expect(state.currentTier).toBe('critical');
    expect(state.daysToDow).toBeGreaterThan(0);
    expect(state.daysToDow).toBeLessThanOrEqual(90);
  });

  it('returns critical tier after DoW (within 365-day grace)', () => {
    const state = getTransitionState(milestones, new Date('2027-02-01T00:00:00Z'));
    expect(state.currentTier).toBe('critical');
    expect(state.daysToDow).toBeLessThan(0);
  });

  it('returns null tier past 365-day grace (historical row, no alert)', () => {
    const state = getTransitionState(milestones, new Date('2028-03-01T00:00:00Z'));
    expect(state.currentTier).toBeNull();
    expect(state.daysToDow).toBeLessThan(-365);
  });

  it('handles null milestones gracefully', () => {
    const state = getTransitionState(
      { d12: null, d6: null, d3: null, dow: null },
      new Date('2027-01-01T00:00:00Z'),
    );
    expect(state.currentTier).toBeNull();
    expect(state.daysToDow).toBeNull();
  });
});
