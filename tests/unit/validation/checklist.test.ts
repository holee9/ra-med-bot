// @MX:NOTE [AUTO] Unit tests for checklist (SPEC-REGULA-VALIDATION-001 M5, AC-8).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-013, AC-8, Issue #49)
// @MX:REASON AC-8 gate: checklist 항목 누락 시 sign-off 409 + 실패 항목 목록.
//   buildChecklist computes canonical state; isChecklistSatisfied / unmetItems
//   drive the 409 response shape.

import {
  CHECKLIST_IDS,
  CHECKLIST_TITLES,
  EMPTY_CHECKLIST,
  buildChecklist,
  isChecklistSatisfied,
  unmetItems,
} from '@/lib/validation/checklist';
import { describe, expect, it } from 'vitest';

describe('sign-off checklist (AC-8)', () => {
  it('exposes exactly 5 canonical items', () => {
    expect(CHECKLIST_IDS).toEqual([
      'iq:pass',
      'oq:pass',
      'pq:pass',
      'changes:resolved',
      'report:exported',
    ]);
  });

  it('EMPTY_CHECKLIST has all items with met=false', () => {
    expect(EMPTY_CHECKLIST).toHaveLength(5);
    expect(EMPTY_CHECKLIST.every((i) => i.met === false)).toBe(true);
  });

  it('every CHECKLIST_ID has a title', () => {
    for (const id of CHECKLIST_IDS) {
      expect(CHECKLIST_TITLES[id]).toBeTruthy();
    }
  });

  it('buildChecklist reflects each input flag', () => {
    const all = buildChecklist({
      hasIqPass: true,
      hasOqPass: true,
      hasPqPass: true,
      rerunGatePassed: true,
      reportExported: true,
    });
    expect(all.every((i) => i.met)).toBe(true);
    expect(isChecklistSatisfied(all)).toBe(true);
    expect(unmetItems(all)).toEqual([]);
  });

  it('buildChecklist with all-false marks every item unmet', () => {
    const none = buildChecklist({
      hasIqPass: false,
      hasOqPass: false,
      hasPqPass: false,
      rerunGatePassed: false,
      reportExported: false,
    });
    expect(isChecklistSatisfied(none)).toBe(false);
    expect(unmetItems(none).map((i) => i.id)).toEqual([
      'iq:pass',
      'oq:pass',
      'pq:pass',
      'changes:resolved',
      'report:exported',
    ]);
  });

  it('partial failure surfaces only the unmet items (AC-8 payload shape)', () => {
    const partial = buildChecklist({
      hasIqPass: true,
      hasOqPass: false,
      hasPqPass: true,
      rerunGatePassed: false,
      reportExported: true,
    });
    expect(isChecklistSatisfied(partial)).toBe(false);
    const unmet = unmetItems(partial);
    expect(unmet.map((i) => i.id)).toEqual(['oq:pass', 'changes:resolved']);
  });

  it('isChecklistSatisfied is false for empty array (defensive)', () => {
    expect(isChecklistSatisfied([])).toBe(false);
  });
});
