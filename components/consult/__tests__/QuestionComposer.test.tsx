/**
 * @vitest-environment jsdom
 */
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-055/056/057/058/059, AC-CONS-UI-004)
import '@testing-library/jest-dom';
import { QuestionComposer } from '@/components/consult/QuestionComposer';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted refs allow per-test control of mutation state (ApproveDialog pattern).
const { mutateTurnSpy, pendingRef } = vi.hoisted(() => ({
  mutateTurnSpy: vi.fn(),
  pendingRef: { current: false },
}));

vi.mock('@/lib/queries/useConsult', () => ({
  useCreateTurn: () => ({
    mutate: mutateTurnSpy,
    mutateAsync: mutateTurnSpy,
    isPending: pendingRef.current,
    error: null,
  }),
}));

describe('QuestionComposer', () => {
  const mockSessionId = 'session-123';

  beforeEach(() => {
    vi.clearAllMocks();
    pendingRef.current = false;
  });

  it('should render question input with submit button (REQ-V3-UI-055)', () => {
    render(<QuestionComposer sessionId={mockSessionId} />);

    expect(screen.getByTestId('question-composer')).toBeInTheDocument();
    expect(screen.getByTestId('question-input')).toBeInTheDocument();
    expect(screen.getByTestId('question-submit')).toBeInTheDocument();
    expect(screen.getByText('질문 입력 (1-5000자)')).toBeInTheDocument();
  });

  it('should validate question length 1-5000 (REQ-V3-UI-055/E13)', async () => {
    render(<QuestionComposer sessionId={mockSessionId} />);

    const submitButton = screen.getByTestId('question-submit');
    const input = screen.getByTestId('question-input');

    // Empty input - disabled
    expect(submitButton).toBeDisabled();

    // Valid input
    await userEvent.type(input, 'Valid question');
    expect(submitButton).not.toBeDisabled();

    // Show character count
    expect(screen.getByText('14/5000')).toBeInTheDocument();

    // 5001 chars - disabled
    await userEvent.clear(input);
    fireEvent.change(input, { target: { value: 'a'.repeat(5001) } });
    expect(screen.getByText('5001/5000')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should show loading indicator while pending (REQ-V3-UI-057)', () => {
    pendingRef.current = true;

    render(<QuestionComposer sessionId={mockSessionId} />);

    expect(screen.getByTestId('turn-loading')).toHaveTextContent('답변 생성 중...');
    expect(screen.getByTestId('question-submit')).toBeDisabled();
    expect(screen.getByTestId('question-input')).toBeDisabled();
  });
});
