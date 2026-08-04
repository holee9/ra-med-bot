// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/cer/meddev-stages (SPEC-REGULA-CER-001).
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-001~011)

import { describe, expect, it } from 'vitest';
import { CER_STAGES, type CerStageId, getStage, isLastStage } from '../meddev-stages';

describe('meddev-stages (SPEC-REGULA-CER-001)', () => {
  it('exposes the 10-stage canonical CER outline in order', () => {
    expect(CER_STAGES).toHaveLength(10);
    expect(CER_STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('getStage returns the matching stage for a valid id', () => {
    const s1 = getStage(1);
    expect(s1.id).toBe(1);
    expect(typeof s1.title).toBe('string');
    expect(getStage(10).id).toBe(10);
  });

  it('getStage throws on an unknown id', () => {
    expect(() => getStage(99 as CerStageId)).toThrow(/Unknown CER stage id/);
  });

  it('isLastStage is true only for stage 10', () => {
    expect(isLastStage(10)).toBe(true);
    expect(isLastStage(1)).toBe(false);
  });
});
