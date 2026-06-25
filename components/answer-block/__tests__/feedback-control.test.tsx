// @MX:NOTE Unit tests for FeedbackControl — SPEC-REGULA-RLHF-001 (REQ-RLHF-003, AC-01).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackControl } from '../feedback-control';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const OK_RESPONSE = {
  ok: true,
  feedbackId: 'fb-1',
  messageId: '00000000-0000-0000-0000-000000000001',
};
function mockFetchOk() {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(OK_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  return fetchSpy;
}

describe('FeedbackControl (REQ-RLHF-003, AC-01)', () => {
  it('renders rating buttons with accessible names', () => {
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.getByRole('button', { name: '유용해요' })).toBeDefined();
    expect(screen.getByRole('button', { name: '아쉬워요' })).toBeDefined();
  });

  it('does not render tags or submit before a rating is chosen', () => {
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);
    expect(screen.queryByTestId('feedback-submit')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /출처 누락/ }).length).toBe(0);
  });

  it('shows 8 quality tags after selecting a rating', () => {
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);
    fireEvent.click(screen.getByRole('button', { name: '아쉬워요' }));
    expect(screen.getByTestId('feedback-tag-citation_missing')).toBeDefined();
    expect(screen.getByTestId('feedback-tag-excellent')).toBeDefined();
    const tagButtons = screen
      .getAllByRole('button')
      .filter((b) => b.dataset.testid?.startsWith('feedback-tag-'));
    expect(tagButtons.length).toBe(8);
  });

  it('submits up-rating feedback with selected tags and forwards the messageId', async () => {
    const fetchSpy = mockFetchOk();
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);

    fireEvent.click(screen.getByRole('button', { name: '유용해요' }));
    fireEvent.click(screen.getByTestId('feedback-tag-helpful'));
    fireEvent.click(screen.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submitted')).toBeDefined();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calls = fetchSpy.mock.calls;
    const init = calls[0]?.[1];
    expect(init).toBeDefined();
    const body = JSON.parse(init?.body as string);
    expect(body.messageId).toBe('00000000-0000-0000-0000-000000000001');
    expect(body.rating).toBe('up');
    expect(body.qualityTags).toEqual(['helpful']);
  });

  it('shows the knowledge-gap acknowledgement for low-rated gap-signal tags', async () => {
    mockFetchOk();
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);

    fireEvent.click(screen.getByRole('button', { name: '아쉬워요' }));
    fireEvent.click(screen.getByTestId('feedback-tag-citation_missing'));
    fireEvent.click(screen.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-gap-ack')).toBeDefined();
    });
  });

  it('does not show the gap acknowledgement for up-rating', async () => {
    mockFetchOk();
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);

    fireEvent.click(screen.getByRole('button', { name: '유용해요' }));
    fireEvent.click(screen.getByTestId('feedback-tag-helpful'));
    fireEvent.click(screen.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submitted')).toBeDefined();
    });
    expect(screen.queryByTestId('feedback-gap-ack')).toBeNull();
  });

  it('shows an error when submit fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'validation_failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);

    fireEvent.click(screen.getByRole('button', { name: '아쉬워요' }));
    fireEvent.click(screen.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error')).toBeDefined();
    });
  });
});

describe('FeedbackControl enum invariant (AC-02)', () => {
  beforeEach(() => {
    mockFetchOk();
  });

  it('only sends enum values — toggling a tag sends exactly that tag', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<FeedbackControl messageId="00000000-0000-0000-0000-000000000001" />);

    fireEvent.click(screen.getByRole('button', { name: '아쉬워요' }));
    fireEvent.click(screen.getByTestId('feedback-tag-answer_wrong'));
    fireEvent.click(screen.getByTestId('feedback-tag-jurisdiction_mismatch'));
    fireEvent.click(screen.getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submitted')).toBeDefined();
    });

    const calls = fetchSpy.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const init = calls[0]?.[1];
    expect(init).toBeDefined();
    const body = JSON.parse(init?.body as string);
    expect(body.qualityTags).toEqual(['answer_wrong', 'jurisdiction_mismatch']);
  });
});
