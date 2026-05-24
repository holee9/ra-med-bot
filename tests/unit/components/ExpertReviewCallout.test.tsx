// @MX:NOTE [AUTO] T-007 TDD tests — ExpertReviewCallout component.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-027)
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('ExpertReviewCallout (REQ-ENTERPRISE-027)', () => {
  it('has data-testid="expert-review-callout"', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    const { container } = render(
      <ExpertReviewCallout
        conversationId="conv-001"
        messageId="msg-001"
        reason="의료기기 허가 절차 관련 검토 필요"
      />,
    );
    const el = container.querySelector('[data-testid="expert-review-callout"]');
    expect(el).not.toBeNull();
  });

  it('shows "전문가 검토가 필요합니다" text', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    render(
      <ExpertReviewCallout
        conversationId="conv-001"
        messageId="msg-001"
        reason="의료기기 허가 절차"
      />,
    );
    expect(screen.getByText(/전문가 검토가 필요합니다/)).toBeDefined();
  });

  it('renders the reason text', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    const reason = '특수 의료기기 분류 검토 필요';
    render(<ExpertReviewCallout conversationId="conv-001" messageId="msg-001" reason={reason} />);
    expect(screen.getByText(reason)).toBeDefined();
  });

  it('has amber/yellow background styling', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    const { container } = render(
      <ExpertReviewCallout conversationId="conv-001" messageId="msg-001" reason="검토" />,
    );
    const el = container.querySelector('[data-testid="expert-review-callout"]') as HTMLElement;
    expect(el).not.toBeNull();
    // Should have amber/accent or yellow background classes
    expect(el.className).toMatch(/accent|amber|yellow/);
  });

  it('has data-testid="send-review-btn" button', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    const { container } = render(
      <ExpertReviewCallout conversationId="conv-001" messageId="msg-001" reason="검토" />,
    );
    const btn = container.querySelector('[data-testid="send-review-btn"]');
    expect(btn).not.toBeNull();
  });

  it('send-review-btn is enabled initially', async () => {
    const { ExpertReviewCallout } = await import('@/components/expert-review/ExpertReviewCallout');
    render(
      <ExpertReviewCallout conversationId="conv-001" messageId="msg-001" reason="검토" />,
    );
    const btn = screen.getByTestId('send-review-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
