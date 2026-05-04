// Phase 8E extension tests for router.ts — new intents for org document retrieval
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-068)

import { describe, it, expect } from 'vitest';

describe('intentToCorpora Phase 8E extensions (REQ-DOC-068)', () => {
  it('has past_submission_reuse intent with org submission corpora', async () => {
    const { intentToCorpora } = await import('@/lib/ai/router');
    expect(intentToCorpora['past_submission_reuse']).toBeDefined();
    expect(intentToCorpora['past_submission_reuse']).toContain('org_fda_submissions');
    expect(intentToCorpora['past_submission_reuse']).toContain('org_eu_cer');
    expect(intentToCorpora['past_submission_reuse']).toContain('org_mfds_submissions');
  });

  it('has audit_response_drafting intent with org_audit_responses corpus', async () => {
    const { intentToCorpora } = await import('@/lib/ai/router');
    expect(intentToCorpora['audit_response_drafting']).toBeDefined();
    expect(intentToCorpora['audit_response_drafting']).toContain('org_audit_responses');
  });

  it('existing intents remain unchanged', async () => {
    const { intentToCorpora } = await import('@/lib/ai/router');
    expect(intentToCorpora['regulation-lookup']).toContain('fda');
    expect(intentToCorpora['strategy']).toContain('eu-mdr');
    expect(intentToCorpora['general']).toContain('fda');
  });
});
