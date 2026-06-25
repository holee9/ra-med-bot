// @MX:NOTE [AUTO] DDD PRESERVE — characterization test for consult.ts knowledge-gap hook.
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35, T1.3)
// @MX:REASON Before hooking detectKnowledgeGap into the RAG pipeline (IMPROVE phase),
//          we capture the structural invariants the hook MUST NOT break:
//          1. The consult generator still imports and calls detectKnowledgeGap.
//          2. The hook is wired AFTER message persistence so unanswered_queue.message_id
//             can satisfy its FK to messages.id.
//          3. Gap capture is non-fatal — wrapped in try/catch (stream never throws on gap failure).
//          4. SSE event types union is unchanged (no new event type introduced).
//          5. messages.knowledgeGapRequired is set (REQ-KNOWLEDGE-GAP-003).
//
//          A full runtime characterization (LLM + DB mocks over the async generator)
//          is out of scope for unit tests; the integration test in Phase 5 (T5.3)
//          covers the end-to-end gap-capture flow.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../');
const CONSULT = path.join(ROOT, 'lib/ai/consult.ts');
const SOURCE = readFileSync(CONSULT, 'utf8');

describe('consult.ts knowledge-gap hook — DDD PRESERVE characterization (T1.3)', () => {
  it('consult.ts file exists', () => {
    expect(existsSync(CONSULT)).toBe(true);
  });

  it('imports detectKnowledgeGap + captureKnowledgeGap from knowledge-gap/detector', () => {
    expect(SOURCE).toMatch(
      /import\s+\{\s*captureKnowledgeGap,\s*detectKnowledgeGap\s*\}\s+from\s+['"]\.\.\/knowledge-gap\/detector['"]/,
    );
  });

  it('invokes detectKnowledgeGap with the 4 signal dimensions', () => {
    // All 4 design.md §2.1 conditions must be passed into the detector.
    expect(SOURCE).toMatch(/detectKnowledgeGap\(\{[\s\S]*?confidenceScore/);
    expect(SOURCE).toMatch(/detectKnowledgeGap\(\{[\s\S]*?confidenceLevel/);
    expect(SOURCE).toMatch(/detectKnowledgeGap\(\{[\s\S]*?citationCoverageBelow80/);
    expect(SOURCE).toMatch(/detectKnowledgeGap\(\{[\s\S]*?topChunksLength/);
    expect(SOURCE).toMatch(/detectKnowledgeGap\(\{[\s\S]*?llmFailed/);
  });

  it('captures the gap via captureKnowledgeGap when a reason is detected', () => {
    expect(SOURCE).toMatch(/captureKnowledgeGap\(\{[\s\S]*?orgId/);
    expect(SOURCE).toMatch(/captureKnowledgeGap\(\{[\s\S]*?conversationId/);
    expect(SOURCE).toMatch(/captureKnowledgeGap\(\{[\s\S]*?messageId/);
    expect(SOURCE).toMatch(/captureKnowledgeGap\(\{[\s\S]*?originalQuestion/);
    expect(SOURCE).toMatch(/captureKnowledgeGap\(\{[\s\S]*?reason:\s*gapReason/);
  });

  it('persists the assistant message before inserting the FK-dependent gap row', () => {
    const persistIndex = SOURCE.indexOf('await persistMessage({');
    const captureIndex = SOURCE.indexOf('await captureKnowledgeGap({');

    expect(persistIndex).toBeGreaterThanOrEqual(0);
    expect(captureIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeLessThan(captureIndex);
  });

  it('wraps gap capture in try/catch so stream is never broken by gap failure', () => {
    // Non-fatal invariant: the hook MUST NOT propagate errors into the SSE stream.
    expect(SOURCE).toMatch(/try\s*\{[\s\S]*?captureKnowledgeGap[\s\S]*?\}\s*catch/);
    expect(SOURCE).toMatch(/knowledge gap capture failed \(non-fatal\)/);
  });

  it('sets messages.knowledgeGapRequired when a gap is detected (REQ-KNOWLEDGE-GAP-003)', () => {
    expect(SOURCE).toMatch(/knowledgeGapRequired:\s*true/);
  });

  it('suppresses structured block persistence and expert-review side effects in replay mode', () => {
    expect(SOURCE).toMatch(/if\s*\(!signal\?\.aborted\s*&&\s*!isReplay\)\s*\{/);
    // H-1 fix: the expert-review branch was renamed to
    // `effectiveRequiresExpertReview` so the post-rerank invariant gate can
    // also force the safety net. The structural invariant (branch contains an
    // `!isReplay` guard) is preserved.
    expect(SOURCE).toMatch(
      /if\s*\(effectiveRequiresExpertReview\)\s*\{[\s\S]*?if\s*\(!isReplay\)\s*\{/,
    );
  });

  it('does NOT introduce a new StreamEvent type (SSE contract preserved)', () => {
    // The hook must not yield any new event type — it is a silent side effect.
    const streamingTypes = readFileSync(path.join(ROOT, 'types/streaming.ts'), 'utf8');
    const eventTypesBefore = streamingTypes.match(/type:\s*'[a-z_]+'/g) ?? [];
    // No knowledge-gap-specific event type should exist in the streaming contract.
    expect(eventTypesBefore.some((t) => t.includes('gap'))).toBe(false);
  });
});
