import { describe, expect, it } from 'vitest';
import { FDA_510K_SECTIONS, chunk510k } from '../../../../lib/ingest/chunkers/submission-510k';
import { DocClass } from '../../../../lib/ingest/doc-class';

const SAMPLE_510K = `
Device Description
This device is a Class II medical device used for monitoring.

Intended Use
The device is intended to monitor vital signs in adult patients.

Substantial Equivalence Summary
The device is substantially equivalent to predicate device K123456.

Standards
The device was tested according to IEC 60601-1.

Performance Testing
Bench testing was conducted per ASTM standards.

Biocompatibility
Biocompatibility testing per ISO 10993.

Sterilization
The device is EO sterilized.

Software
Software is classified as Class B per IEC 62304.

EMC
EMC testing conducted per IEC 60601-1-2.

Labeling
Labeling complies with 21 CFR 801.

Comparison Table
See attached comparison table.

Summary Statement
This device is substantially equivalent to K123456.

Substantial Equivalence Discussion
Based on the comparison, the device is substantially equivalent.
`;

describe('chunk510k', () => {
  it('exports FDA_510K_SECTIONS with 13 section headings', () => {
    expect(FDA_510K_SECTIONS).toHaveLength(13);
    expect(FDA_510K_SECTIONS).toContain('Device Description');
    expect(FDA_510K_SECTIONS).toContain('Intended Use');
    expect(FDA_510K_SECTIONS).toContain('Software');
  });

  it('returns array of Chunk objects', () => {
    const chunks = chunk510k(SAMPLE_510K, {});
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('each chunk has text and metadata', () => {
    const chunks = chunk510k(SAMPLE_510K, {});
    for (const chunk of chunks) {
      expect(typeof chunk.text).toBe('string');
      expect(chunk.text.length).toBeGreaterThan(0);
      expect(chunk.metadata).toBeDefined();
      expect(chunk.metadata.docClass).toBe(DocClass.submission_success);
    }
  });

  it('splits on known 510k section headings', () => {
    const chunks = chunk510k(SAMPLE_510K, {});
    const sectionPaths = chunks.map((c) => c.metadata.sectionPath);
    // Should detect at least some of the 13 known sections
    const knownSections = sectionPaths.filter((p) => FDA_510K_SECTIONS.some((s) => p.includes(s)));
    expect(knownSections.length).toBeGreaterThan(0);
  });

  it('handles text without known sections (fallback)', () => {
    const plainText = 'This is some generic regulatory text without any known headings.';
    const chunks = chunk510k(plainText, {});
    expect(chunks.length).toBeGreaterThan(0);
  });
});
