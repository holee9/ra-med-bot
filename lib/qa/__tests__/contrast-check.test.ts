// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/qa/contrast-check pure functions (SPEC-REGULA-VALIDATION-002).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (#368, REQ-ENTERPRISE-048)
//
// Tests the pure WCAG math/parsing helpers. runContrastCheck (fs-based) is
// covered by the CI integration test; not exercised here.

import { describe, expect, it } from 'vitest';
import {
  channelLuminance,
  contrastRatio,
  extractHexValue,
  relativeLuminance,
} from '../contrast-check';

describe('contrast-check pure helpers (SPEC-REGULA-VALIDATION-002)', () => {
  it('channelLuminance returns 0 for black and 1 for white', () => {
    expect(channelLuminance(0)).toBeCloseTo(0, 5);
    expect(channelLuminance(255)).toBeCloseTo(1, 5);
  });

  it('relativeLuminance is 0 for #000000 and 1 for #ffffff (with or without #)', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('contrastRatio is 21 for black/white and 1 for identical colors', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#abcdef', '#abcdef')).toBeCloseTo(1, 5);
  });

  it('extractHexValue resolves a direct hex and returns null for var()/no-match', () => {
    expect(extractHexValue('--color-brand-500: #2563eb', '--color-brand-500')).toBe('#2563eb');
    expect(extractHexValue('--color-x: var(--other)', '--color-x')).toBeNull();
    expect(extractHexValue('no token here', '--color-missing')).toBeNull();
  });

  it('a known AA-pass pair exceeds 4.5', () => {
    // brand-800 (~dark) on brand-50 (~light) — high contrast.
    expect(contrastRatio('#1e3a5f', '#f0f7ff')).toBeGreaterThan(4.5);
  });
});
