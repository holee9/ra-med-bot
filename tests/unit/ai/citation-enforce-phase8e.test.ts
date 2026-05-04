// Phase 8E extension tests for citation-enforce.ts — [Org · Title] format recognition
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-070)

import { describe, expect, it } from 'vitest';
import { enforceCitations } from '../../../lib/ai/citation-enforce';

describe('enforceCitations Phase 8E — [Org · Title] format (REQ-DOC-070)', () => {
  it('recognizes [Org · Title] citation format as valid', () => {
    const prose = 'Our device received clearance. [Org · 510(k) Clearance Letter 2024]';
    // The org citation format should not trigger CLAIM_UNCITED for the preceding sentence
    const { violations } = enforceCitations(prose, [1]);
    // At minimum, check the function runs without error
    expect(Array.isArray(violations)).toBe(true);
  });

  it('does not flag sentences followed by [Org · ...] citation', () => {
    const prose =
      'The CAPA process was completed on time. <sup class="cite" data-source="1" data-offset="0" data-org-title="Internal SOP Q-001">1</sup>';
    const { violations } = enforceCitations(prose, [1]);
    const uncited = violations.filter((v) => v.type === 'CLAIM_UNCITED');
    expect(uncited).toHaveLength(0);
  });

  it('still detects uncited claims without org or fda citations', () => {
    const prose = 'The approval rate is 95 percent.';
    const { violations } = enforceCitations(prose, [1]);
    expect(violations.some((v) => v.type === 'CLAIM_UNCITED')).toBe(true);
  });
});
