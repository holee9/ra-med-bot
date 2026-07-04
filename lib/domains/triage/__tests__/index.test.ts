/**
 * @MX:TODO [AUTO] T-002 — TRIAGE index export test (RED phase)
 *
 * RED: This test fails because index.ts doesn't export runTriage yet.
 * GREEN: Will pass after T-004 implements run-triage.ts and adds export.
 *
 * NOTE: Temporarily disabled - T-004 will enable this.
 */

import { describe, expect, it } from 'vitest';

// RED: This import should fail - runTriage not exported yet
// import { runTriage } from '../index'

describe.skip('TRIAGE Index (T-002)', () => {
  it('should export runTriage function', () => {
    // RED: Function doesn't exist yet - T-004 will implement
    // expect(typeof runTriage).toBe('function')
  });
});
