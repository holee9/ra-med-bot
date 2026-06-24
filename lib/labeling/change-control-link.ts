// @MX:NOTE [AUTO] REQ-008 — link labeling changes to #54 Change Control.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-008, AC-06)
//
// REUSE (L-002): assessChange already accepts changeType='labeling' — the
// ChangeType union (lib/change-control/types.ts:10) and DEFAULT_VERDICT_HINT
// (lib/change-control/jurisdictions.ts:62) both include 'labeling'. This
// module is a thin wrapper that prepares the ChangeInput and invokes
// assessChange, mirroring how /api/change-control/run/route.ts calls it.

import { type AssessOptions, assessChange } from '@/lib/change-control/engine';
import type { AssessmentOutput } from '@/lib/change-control/types';
import type { LabelingChangeLinkInput } from './types';

/**
 * REQ-008: link a labeling document change to the change-control assessment.
 *
 * Delegates to assessChange with changeType='labeling'. The caller MUST
 * supply a retrieveFn (mirrors the change-control run route boundary —
 * keeps this module pure and testable without the db-client import graph).
 *
 * Returns the AssessmentOutput so the caller can persist or display it.
 */
export async function linkLabelingChangeToChangeControl(
  input: LabelingChangeLinkInput,
  options: AssessOptions,
): Promise<AssessmentOutput> {
  return assessChange(
    {
      changeType: 'labeling',
      description: input.changeDescription,
      // Labeling changes impact the labeling scope specifically.
      impactScope: `Labeling document ${input.documentId}`,
      targetMarkets: input.targetMarkets,
    },
    options,
  );
}
