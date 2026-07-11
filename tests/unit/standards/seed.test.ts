// @MX:NOTE [AUTO] Unit tests for standards catalog seed data.
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-004/005/006/008, AC-01, Issue #402)
// @MX:REASON STANDARDS_CATALOG_SEED is a data table. Tests assert: every
//   entry has valid required fields, body is one of the 5 allowed values,
//   recognitionStatus is one of the 4 allowed values, scopeKeywords is a
//   non-empty string array, and source='seed'. Also checks the known
//   duplicate standardNumber (ISO 13485:2016 appears twice — documented).

import { describe, expect, it } from 'vitest';

import { STANDARDS_CATALOG_SEED, type SeedStandard } from '@/lib/standards/seed';

const ALLOWED_BODIES = ['ISO', 'IEC', 'CEN', 'ASTM', 'other'] as const;
const ALLOWED_RECOGNITION = ['recognized', 'not_recognized', 'withdrawn', 'unknown'] as const;

describe('STANDARDS_CATALOG_SEED — data integrity', () => {
  it('exports a non-empty array of seed entries', () => {
    expect(Array.isArray(STANDARDS_CATALOG_SEED)).toBe(true);
    expect(STANDARDS_CATALOG_SEED.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry satisfies the SeedStandard shape', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(typeof entry.standardNumber).toBe('string');
      expect(entry.standardNumber.length).toBeGreaterThan(0);
      expect(typeof entry.title).toBe('string');
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.version).toBe('string');
      expect(typeof entry.status).toBe('string');
      expect(typeof entry.euHarmonized).toBe('boolean');
      expect(typeof entry.source).toBe('string');
      expect(Array.isArray(entry.scopeKeywords)).toBe(true);
    }
  });

  it('every entry has body in the allowed set', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(ALLOWED_BODIES).toContain(entry.body);
    }
  });

  it('every entry has recognitionStatus in the allowed set', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(ALLOWED_RECOGNITION).toContain(entry.recognitionStatus);
    }
  });

  it('every entry has source="seed"', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(entry.source).toBe('seed');
    }
  });

  it('every entry has at least one scope keyword', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(entry.scopeKeywords.length).toBeGreaterThanOrEqual(1);
      // Each keyword is a non-empty string.
      for (const kw of entry.scopeKeywords) {
        expect(typeof kw).toBe('string');
        expect(kw.length).toBeGreaterThan(0);
      }
    }
  });

  it('every entry has a non-empty version string', () => {
    for (const entry of STANDARDS_CATALOG_SEED) {
      expect(entry.version.length).toBeGreaterThan(0);
    }
  });
});

describe('STANDARDS_CATALOG_SEED — known standards present', () => {
  it('includes ISO 14971:2019 (risk management)', () => {
    const found = STANDARDS_CATALOG_SEED.find((s) => s.standardNumber === 'ISO 14971:2019');
    expect(found).toBeDefined();
    expect(found?.scopeKeywords).toContain('risk');
    expect(found?.euHarmonized).toBe(true);
  });

  it('includes IEC 62304 software lifecycle', () => {
    const found = STANDARDS_CATALOG_SEED.find((s) => s.standardNumber.startsWith('IEC 62304'));
    expect(found).toBeDefined();
    expect(found?.body).toBe('IEC');
  });

  it('includes at least one IEC 60601 series part (electrical safety)', () => {
    const series = STANDARDS_CATALOG_SEED.filter((s) => s.standardNumber.startsWith('IEC 60601'));
    expect(series.length).toBeGreaterThanOrEqual(3);
  });

  it('includes at least 3 ISO 10993 biocompatibility parts', () => {
    const series = STANDARDS_CATALOG_SEED.filter((s) => s.standardNumber.startsWith('ISO 10993'));
    expect(series.length).toBeGreaterThanOrEqual(3);
  });

  it('includes ISO 13485 (QMS)', () => {
    const found = STANDARDS_CATALOG_SEED.find((s) => s.standardNumber === 'ISO 13485:2016');
    expect(found).toBeDefined();
    expect(found?.scopeKeywords).toContain('QMS');
  });

  it('includes sterilization standards (ISO 11135 / 11137)', () => {
    const has11135 = STANDARDS_CATALOG_SEED.some((s) => s.standardNumber.startsWith('ISO 11135'));
    const has11137 = STANDARDS_CATALOG_SEED.some((s) => s.standardNumber.startsWith('ISO 11137'));
    expect(has11135).toBe(true);
    expect(has11137).toBe(true);
  });
});

describe('STANDARDS_CATALOG_SEED — duplicate detection', () => {
  it('has the documented ISO 13485:2016 duplicate (two entries, same number)', () => {
    // The seed intentionally includes a second ISO 13485:2016 entry (documented
    // in the source as "(duplicate reference)"). This test documents that fact
    // so a future cleanup is a deliberate decision, not an accidental removal.
    const dups = STANDARDS_CATALOG_SEED.filter((s) => s.standardNumber === 'ISO 13485:2016');
    expect(dups.length).toBe(2);
  });

  it('does NOT have unintended duplicate standardNumbers (other than ISO 13485)', () => {
    const counts = new Map<string, number>();
    for (const s of STANDARDS_CATALOG_SEED) {
      counts.set(s.standardNumber, (counts.get(s.standardNumber) ?? 0) + 1);
    }
    const dups = [...counts.entries()].filter(([, n]) => n > 1);
    // Only ISO 13485:2016 is allowed to be duplicated.
    for (const [num] of dups) {
      expect(num).toBe('ISO 13485:2016');
    }
  });
});

describe('STANDARDS_CATALOG_SEED — type export', () => {
  it('SeedStandard type is constructible and satisfies the interface', () => {
    const sample: SeedStandard = {
      standardNumber: 'TEST 1:2024',
      title: 'Test Standard',
      version: '2024',
      body: 'ISO',
      status: 'current',
      recognitionStatus: 'recognized',
      euHarmonized: true,
      source: 'seed',
      scopeKeywords: ['test'],
    };
    expect(sample.standardNumber).toBe('TEST 1:2024');
  });
});
