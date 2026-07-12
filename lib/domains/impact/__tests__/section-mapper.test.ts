// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/domains/impact/section-mapper (SPEC-REGULA-IMPACT-001).
// @MX:SPEC SPEC-REGULA-IMPACT-001
//
// Pure heuristic mapping — no DB/IO. Covers: empty hint, each impact-type branch,
// the Class III extra-scrutiny branch (non-clinical), and the no-match fallback.

import { describe, expect, it } from 'vitest';
import { mapSections } from '../section-mapper';

describe('mapSections (SPEC-REGULA-IMPACT-001)', () => {
  it('returns [] when impactTypeHint is null', async () => {
    expect(
      await mapSections({ region: 'US', impactTypeHint: null, impactAnalysisText: null }, 'II'),
    ).toEqual([]);
  });

  it('maps a labeling hint to IFU + 510(k) sections', async () => {
    const result = await mapSections(
      { region: 'US', impactTypeHint: 'labeling', impactAnalysisText: null },
      'II',
    );
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.document_type)).toEqual(expect.arrayContaining(['IFU', '510(k)']));
  });

  it('adds a PMA extra-scrutiny section for Class III + non-clinical hint', async () => {
    const result = await mapSections(
      { region: 'US', impactTypeHint: 'software', impactAnalysisText: null },
      'Class III',
    );
    expect(result.length).toBe(3);
    expect(result.some((s) => s.document_type === 'PMA')).toBe(true);
  });

  it('does NOT add the PMA extra for a Class III clinical hint', async () => {
    const result = await mapSections(
      { region: 'US', impactTypeHint: 'clinical', impactAnalysisText: null },
      'Class III',
    );
    expect(result.every((s) => s.document_type !== 'PMA')).toBe(true);
  });

  it('returns [] when no impact-type key matches the hint', async () => {
    expect(
      await mapSections(
        { region: 'US', impactTypeHint: 'unrecognized', impactAnalysisText: null },
        'II',
      ),
    ).toEqual([]);
  });

  it('matches case-insensitively', async () => {
    const result = await mapSections(
      { region: 'US', impactTypeHint: 'CYBERSECURITY', impactAnalysisText: null },
      'II',
    );
    expect(result.some((s) => s.document_type === 'Cybersecurity Documentation')).toBe(true);
  });
});
