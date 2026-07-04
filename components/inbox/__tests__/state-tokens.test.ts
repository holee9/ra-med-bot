import { describe, expect, it } from 'vitest';
import { STATE_TOKENS } from '../state-tokens';

describe('state-tokens (T-027, REQ-V3-UI-041)', () => {
  const STATES = ['auto', 'needs-review', 'escalated', 'waiting', 'closed', 'rejected'] as const;

  it('provides border/badge/accent/label for all 6 triage states', () => {
    for (const state of STATES) {
      const token = STATE_TOKENS[state];
      expect(token).toBeDefined();
      expect(token.border).toMatch(/^border-/);
      expect(token.badge).toMatch(/^bg-/);
      expect(token.accent).toMatch(/^bg-/);
      expect(token.label).toBeTruthy();
    }
  });

  it('uses 6 distinct border colors (one per state)', () => {
    const borders = STATES.map((s) => STATE_TOKENS[s].border);
    expect(new Set(borders).size).toBe(borders.length);
  });

  it('uses 6 distinct accent colors (column header differentiation)', () => {
    const accents = STATES.map((s) => STATE_TOKENS[s].accent);
    expect(new Set(accents).size).toBe(accents.length);
  });
});
