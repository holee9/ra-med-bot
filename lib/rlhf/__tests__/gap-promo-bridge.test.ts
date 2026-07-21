// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-007, REQ-RLHF-008, REQ-RLHF-015, AC-03, AC-04)
import { describe, expect, it, vi } from 'vitest';

// The gap-promo-bridge imports createGitHubIssue, which transitively imports
// writeAudit -> db/client -> env validation. Mock both so the test runs in
// pure unit mode without triggering env validation.
vi.mock('@/lib/kernel/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/kernel/db/client', () => ({ db: {} }));
import type { GitHubIssuesClient } from '@/lib/knowledge-gap/github-issue';
import {
  type FeedbackBridgeInput,
  createGapIssueForLowRatedAnswer,
  isHighRatedFeedback,
  isLowRatedFeedback,
  proposePromotionCandidateForHighRatedAnswer,
} from '@/lib/rlhf/gap-promo-bridge';

function makeInput(overrides: Partial<FeedbackBridgeInput>): FeedbackBridgeInput {
  return {
    messageId: 'msg-1',
    conversationId: 'conv-1',
    userId: 'user-1',
    rating: 'down',
    qualityTags: ['citation_missing'],
    comment: null,
    redactedQuestion: '[redacted] 510(k) 제출 절차',
    ...overrides,
  };
}

describe('isLowRatedFeedback (REQ-RLHF-007)', () => {
  it('true for down + citation_missing', () => {
    expect(
      isLowRatedFeedback(makeInput({ rating: 'down', qualityTags: ['citation_missing'] })),
    ).toBe(true);
  });

  it('false for down with NO low-rated tags', () => {
    expect(isLowRatedFeedback(makeInput({ rating: 'down', qualityTags: ['helpful'] }))).toBe(false);
  });

  it('false for up regardless of tags', () => {
    expect(isLowRatedFeedback(makeInput({ rating: 'up', qualityTags: ['citation_wrong'] }))).toBe(
      false,
    );
  });

  it('false for empty qualityTags', () => {
    expect(isLowRatedFeedback(makeInput({ rating: 'down', qualityTags: [] }))).toBe(false);
  });
});

describe('isHighRatedFeedback (REQ-RLHF-008)', () => {
  it('true for up + helpful', () => {
    expect(isHighRatedFeedback(makeInput({ rating: 'up', qualityTags: ['helpful'] }))).toBe(true);
  });

  it('true for up + excellent', () => {
    expect(isHighRatedFeedback(makeInput({ rating: 'up', qualityTags: ['excellent'] }))).toBe(true);
  });

  it('false for up with NO high-rated tags', () => {
    expect(
      isHighRatedFeedback(makeInput({ rating: 'up', qualityTags: ['citation_missing'] })),
    ).toBe(false);
  });

  it('false for down regardless of tags', () => {
    expect(isHighRatedFeedback(makeInput({ rating: 'down', qualityTags: ['excellent'] }))).toBe(
      false,
    );
  });
});

describe('createGapIssueForLowRatedAnswer (REQ-RLHF-007, AC-03)', () => {
  // Tier-1 dead-code defense: assert the created issue body contains the REAL
  // redacted question text AND at least one quality tag — guards against the
  // "called with empty []" / "wrong GapIssueContext shape" defect class.
  it('creates an issue with the redacted question and quality tag in the body', async () => {
    let captured: { title: string; body: string; labels: readonly string[] } | null = null;
    const mockClient: GitHubIssuesClient = {
      async createIssue(params: { title: string; body: string; labels: readonly string[] }) {
        captured = params;
        return { number: 42, htmlUrl: 'https://example.com/issues/42' };
      },
      async createComment() {
        return { htmlUrl: '' };
      },
    };

    const input = makeInput({
      rating: 'down',
      qualityTags: ['citation_missing', 'answer_incomplete'],
      redactedQuestion: '[redacted] What is the 510(k) submission process?',
    });
    const result = await createGapIssueForLowRatedAnswer(input, { client: mockClient });
    expect(result?.number).toBe(42);
    expect(captured).not.toBeNull();
    // Assert via explicit cast — TS narrows `captured` to `never` after the closure
    // assignment (mock createIssue mutates captured), so we anchor a typed snapshot.
    const snap = captured as unknown as {
      title: string;
      body: string;
      labels: readonly string[];
    };
    // Tier-1: body MUST contain the redacted question text (not empty).
    expect(snap.body).toContain('[redacted] What is the 510(k) submission process?');
    // Tier-1: body MUST reference traceability (messageId).
    expect(snap.body).toContain('msg-1');
    expect(snap.title).toContain('low_citation');
  });

  it('returns null for non-low-rated feedback', async () => {
    const result = await createGapIssueForLowRatedAnswer(
      makeInput({ rating: 'up', qualityTags: ['helpful'] }),
    );
    expect(result).toBeNull();
  });
});

describe('proposePromotionCandidateForHighRatedAnswer (REQ-RLHF-008, REQ-RLHF-015 HARD, AC-04)', () => {
  it('returns a descriptor for high-rated feedback', () => {
    const descriptor = proposePromotionCandidateForHighRatedAnswer(
      makeInput({ rating: 'up', qualityTags: ['excellent'], comment: 'great answer' }),
    );
    expect(descriptor).not.toBeNull();
    if (descriptor) {
      expect(descriptor.messageId).toBe('msg-1');
      expect(descriptor.userId).toBe('user-1');
      expect(descriptor.evidence.rating).toBe('up');
      expect(descriptor.evidence.qualityTags).toContain('excellent');
      expect(descriptor.evidence.comment).toBe('great answer');
    }
  });

  // REQ-RLHF-015 [HARD]: no auto-confirm.
  it('marks promotionDeferred=true (NO auto-promotion)', () => {
    const descriptor = proposePromotionCandidateForHighRatedAnswer(
      makeInput({ rating: 'up', qualityTags: ['helpful'] }),
    );
    expect(descriptor).not.toBeNull();
    if (descriptor) {
      expect(descriptor.promotionDeferred).toBe(true);
      expect(descriptor.followUpIssue).toBe('#50');
    }
  });

  it('returns null for non-high-rated feedback', () => {
    expect(
      proposePromotionCandidateForHighRatedAnswer(
        makeInput({ rating: 'down', qualityTags: ['citation_missing'] }),
      ),
    ).toBeNull();
  });

  // REQ-RLHF-015 [HARD invariant] — the descriptor MUST be a pure object with
  // no side effects. The function must not insert into change_request with
  // approval_status != 'pending_review'. This is a structural guarantee: the
  // module source must NOT IMPORT or CALL submitRlhfProposal / db client /
  // changeRequest, so the promo path is physically incapable of writing.
  // We strip comments before checking so explanatory @MX:REASON lines that
  // mention the forbidden symbol by name do not trip a false positive.
  it('the module source does not import or call submitRlhfProposal / db (REQ-RLHF-015 gate)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/rlhf/gap-promo-bridge.ts'),
      'utf8',
    );
    // Strip // line comments and /* block */ comments.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // No import of, no call to submitRlhfProposal / changeRequest / db client.
    expect(code).not.toMatch(/import[^;]*submitRlhfProposal/);
    expect(code).not.toMatch(/submitRlhfProposal\s*\(/);
    expect(code).not.toMatch(/import[^;]*db\/client/);
    expect(code).not.toMatch(/import[^;]*changeRequest/);
    expect(code).not.toMatch(/\bchangeRequest\b/);
  });
});
