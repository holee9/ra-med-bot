/** @vitest-environment jsdom */

// @MX:NOTE #264 sub-PR 3/3 — alternate answers implicit-feedback wiring.
// Two test surfaces:
//   1. AnswerBlock — verifies the "Regenerate answer" button invokes onRegenerate
//      when provided and stays disabled (legacy/preview) when not.
//   2. fireImplicitRegenerateFeedback — verifies the implicit_regenerate POST
//      body shape AND that a rejecting fetch is swallowed (fire-and-forget).
// The parent ChatShell composes these two: it passes handleRegenerate (which
// calls the helper then re-asks via start()) as the onRegenerate prop. The
// re-ask-via-existing-send-path is implicitly covered by the composition; it
// is intentionally not duplicated here.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, alternate-answer implicit signal)

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — mirror tests/unit/chat-components.test.tsx for deterministic rendering.
// ---------------------------------------------------------------------------

vi.mock('../../hooks/useDocViewer', () => ({
  useDocViewer: () => ({
    isOpen: false,
    sourceId: null,
    sourceIndex: null,
    targetOffset: null,
    sourceDetail: null,
    isLoading: false,
    error: null,
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});

import { fireImplicitRegenerateFeedback } from '../../../lib/rlhf/regenerate';
import { AnswerBlock } from '../AnswerBlock';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const baseProps = {
  confidence: undefined,
  sources: [],
  prose: '510(k) 제출은 FDA의 시판전 신고 절차입니다.',
  durationMs: 1200 as number | null,
  messageId: 'msg-uuid-123',
  conversationId: 'conv-uuid-456',
};

describe('AnswerBlock — Regenerate button contract', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes onRegenerate when the handler is supplied', () => {
    const onRegenerate = vi.fn();
    render(<AnswerBlock {...baseProps} onRegenerate={onRegenerate} />);
    const btn = screen.getByRole('button', { name: 'Regenerate answer' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('renders the button disabled when no onRegenerate handler is supplied (legacy / preview)', () => {
    render(<AnswerBlock {...baseProps} />);
    const btn = screen.getByRole('button', { name: 'Regenerate answer' });
    expect(btn).toBeDisabled();
  });
});

describe('fireImplicitRegenerateFeedback — implicit_regenerate POST', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts { rating: "down", source: "implicit_regenerate", messageId } and no explicit-only fields', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"feedbackId":"fb-1"}', { status: 200 }));

    await fireImplicitRegenerateFeedback('msg-uuid-123');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [endpoint, init] = firstCall ?? [];
    expect(endpoint).toBe('/api/rlhf/feedback');
    expect(init?.method).toBe('POST');
    const body = JSON.parse((init?.body as string) ?? '{}');
    expect(body).toMatchObject({
      messageId: 'msg-uuid-123',
      rating: 'down',
      source: 'implicit_regenerate',
    });
    // No explicit-only fields leak into the implicit signal.
    expect(body.qualityTags).toBeUndefined();
    expect(body.comment).toBeUndefined();
    // variationDimensions deliberately omitted (scope guard).
    expect(body.variationDimensions).toBeUndefined();
  });

  it('swallows fetch rejection so the caller (re-ask) is never blocked (fire-and-forget)', async () => {
    // A rejected fetch models a network failure / 403 / 404. The helper MUST
    // resolve without throwing — the regenerate re-ask proceeds regardless.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(fireImplicitRegenerateFeedback('msg-uuid-123')).resolves.toBeUndefined();
    // Dev-only diagnostic surfaced — never user-facing.
    expect(warnSpy).toHaveBeenCalled();
  });
});
