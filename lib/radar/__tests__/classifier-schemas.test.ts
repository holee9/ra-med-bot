// @MX:NOTE [AUTO] Unit tests for radar classifier Zod schemas (coverage 402).
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004..009)

import { describe, expect, it } from 'vitest';
import {
  TIER1_SYSTEM_PROMPT,
  TIER2_SYSTEM_PROMPT,
  TIER3_SYSTEM_PROMPT,
} from '../classifier-prompts';
import { ImpactTypeEnum, Tier1Schema, Tier2Schema, Tier3Schema } from '../classifier-schemas';

describe('Tier1Schema (binary relevance)', () => {
  it('accepts a valid {relevant, confidence} object', () => {
    const r = Tier1Schema.parse({ relevant: true, confidence: 0.95 });
    expect(r.relevant).toBe(true);
    expect(r.confidence).toBe(0.95);
  });

  it('rejects confidence out of [0,1]', () => {
    expect(() => Tier1Schema.parse({ relevant: true, confidence: 1.5 })).toThrow();
    expect(() => Tier1Schema.parse({ relevant: false, confidence: -0.1 })).toThrow();
  });

  it('rejects missing relevant', () => {
    expect(() => Tier1Schema.parse({ confidence: 0.5 })).toThrow();
  });
});

describe('Tier2Schema (device class + categories)', () => {
  it('accepts a full classification', () => {
    const r = Tier2Schema.parse({
      device_class: 'II',
      product_categories: ['imaging'],
      confidence: 0.8,
    });
    expect(r.device_class).toBe('II');
    expect(r.product_categories).toEqual(['imaging']);
  });

  it('defaults product_categories to [] when omitted', () => {
    const r = Tier2Schema.parse({ confidence: 0.5 });
    expect(r.product_categories).toEqual([]);
  });

  it('accepts unknown device_class', () => {
    expect(Tier2Schema.parse({ device_class: 'unknown', confidence: 0.1 }).device_class).toBe(
      'unknown',
    );
  });
});

describe('Tier3Schema (impact type)', () => {
  it('accepts each ImpactTypeEnum value', () => {
    for (const t of ['guidance', 'recall', 'legislation', 'enforcement_action', 'informational']) {
      expect(Tier3Schema.parse({ impact_type: t, confidence: 0.7 }).impact_type).toBe(t);
    }
  });

  it('rejects an invalid impact_type', () => {
    expect(() => Tier3Schema.parse({ impact_type: 'bogus', confidence: 0.7 })).toThrow();
  });
});

describe('classifier-prompts (few-shot constants exported)', () => {
  it('exports TIER1/TIER2/TIER3 system prompts as non-empty strings', () => {
    expect(typeof TIER1_SYSTEM_PROMPT).toBe('string');
    expect(TIER1_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(typeof TIER2_SYSTEM_PROMPT).toBe('string');
    expect(TIER2_SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(typeof TIER3_SYSTEM_PROMPT).toBe('string');
    expect(TIER3_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it('TIER1 prompt instructs JSON-only response', () => {
    expect(TIER1_SYSTEM_PROMPT).toContain('JSON');
  });
});
