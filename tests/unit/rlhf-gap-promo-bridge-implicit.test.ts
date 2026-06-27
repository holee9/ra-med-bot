// @MX:NOTE [AUTO] Direct bridge-level implicit-feedback suppression test.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-007, REQ-RLHF-008, REQ-RLHF-015)
// @MX:REASON
//   Issue #264 expert-security finding M-1 (defense-in-depth): the route-level
//   `&& !isImplicit` guards (route.ts:318/320) hold today, but the bridges
//   accepting `isImplicit` without acting on it was dead-code-adjacent. The
//   bridges now self-suppress on `isImplicit` so the [지양-2] invariant
//   ("no auto gap/promo from implicit signals") holds at TWO layers. This
//   suite calls the bridge functions DIRECTLY (no route, no HTTP, no db mock)
//   and asserts the suppression independent of the route guard. A regression
//   that removes the bridge-level guard but keeps the route guard will pass
//   rlhf-implicit-feedback.test.ts but fail HERE.

import { describe, expect, it, vi } from 'vitest';

// Stub the GitHub issue client so the gap bridge's external side effect (the
// network call) is intercepted. Returning null mirrors "GitHub unconfigured".
vi.mock('@/lib/knowledge-gap/github-issue', () => ({
  createGitHubIssue: vi.fn().mockResolvedValue(null),
}));

import { createGitHubIssue } from '@/lib/knowledge-gap/github-issue';
import {
  type FeedbackBridgeInput,
  createGapIssueForLowRatedAnswer,
  proposePromotionCandidateForHighRatedAnswer,
} from '@/lib/rlhf/gap-promo-bridge';

const LOW_RATED_INPUT: FeedbackBridgeInput = {
  messageId: '11111111-1111-4111-8111-111111111111',
  conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'user-a',
  rating: 'down',
  qualityTags: ['citation_missing'],
  comment: null,
  redactedQuestion: '[REDACTED] 510(k) submission steps',
};

const HIGH_RATED_INPUT: FeedbackBridgeInput = {
  messageId: '22222222-2222-4222-8222-222222222222',
  conversationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: 'user-b',
  rating: 'up',
  qualityTags: ['helpful'],
  comment: null,
  redactedQuestion: '[REDACTED] EU MDR file structure',
};

describe('Issue #264 expert-security M-1: bridge-level implicit suppression', () => {
  it('createGapIssueForLowRatedAnswer returns null for implicit downvote WITHOUT calling GitHub', async () => {
    const result = await createGapIssueForLowRatedAnswer({
      ...LOW_RATED_INPUT,
      isImplicit: true,
    });
    expect(result).toBeNull();
    // The external side effect MUST NOT fire — implicit signals never create
    // gap issues, even though rating='down' + citation_missing would otherwise
    // satisfy isLowRatedFeedback.
    expect(createGitHubIssue).not.toHaveBeenCalled();
  });

  it('proposePromotionCandidateForHighRatedAnswer returns null for implicit upvote', () => {
    // An implicit path with rating='up' is atypical (regeneration forces down),
    // but the bridge must self-suppress regardless — it cannot trust the
    // caller's rating when isImplicit=true.
    const result = proposePromotionCandidateForHighRatedAnswer({
      ...HIGH_RATED_INPUT,
      isImplicit: true,
    });
    expect(result).toBeNull();
  });

  it('createGapIssueForLowRatedAnswer STILL creates a gap issue for EXPLICIT low-rated feedback (no regression)', async () => {
    // The isImplicit guard must not over-suppress: explicit low-rated feedback
    // still routes to createGitHubIssue as before.
    await createGapIssueForLowRatedAnswer({ ...LOW_RATED_INPUT });
    expect(createGitHubIssue).toHaveBeenCalledTimes(1);
  });

  it('proposePromotionCandidateForHighRatedAnswer STILL produces a descriptor for EXPLICIT high-rated feedback (no regression)', () => {
    const result = proposePromotionCandidateForHighRatedAnswer({ ...HIGH_RATED_INPUT });
    expect(result).not.toBeNull();
    expect(result?.promotionDeferred).toBe(true);
  });

  it('isImplicit defaults to undefined (falsy) when omitted — explicit path unaffected', async () => {
    // Confirms the optional field does not flip behavior for existing callers
    // that do not pass isImplicit.
    await createGapIssueForLowRatedAnswer({ ...LOW_RATED_INPUT });
    expect(createGitHubIssue).toHaveBeenCalled();
  });
});
