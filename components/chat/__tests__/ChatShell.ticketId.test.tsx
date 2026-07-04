/** @vitest-environment jsdom */
//
// T-023/T-024 characterization (brownfield safety net).
// REQ-V3-UI-033: viewer question → /api/ask → ticket_id surfacing.
// The /api/ask response (ticketId, camelCase) is wired through useStreamingAnswer
// into an inline "내 질문 상태" panel with a /inbox/[id] link. PR 331 shipped the
// wiring; this test guards the contract against regression.
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-033, AC-UI-009)
// @MX:TEST characterization

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock state so individual tests can flip ticketId/prose without
// re-declaring module mocks.
const mock = vi.hoisted(() => ({
  ticketId: 'it_test-ticket-123' as string | null,
  prose: '모의 답변 텍스트입니다.' as string,
  start: vi.fn(),
}));

vi.mock('@/hooks/useStreamingAnswer', () => ({
  useStreamingAnswer: () => ({
    status: 'idle' as const,
    traceSteps: [],
    prose: mock.prose,
    meta: null,
    structured: {},
    error: null,
    duration_ms: null,
    ticketId: mock.ticketId,
    ragRoute: undefined,
    start: mock.start,
    abort: vi.fn(),
  }),
}));

vi.mock('@/stores/ui', () => ({
  useUIStore: (selector: (s: { currentProjectId: string | null }) => unknown) =>
    selector({ currentProjectId: null }),
}));

vi.mock('@/lib/rlhf/regenerate', () => ({
  fireImplicitRegenerateFeedback: vi.fn(),
}));

// Stub heavy children to isolate ChatShell's own branching logic. Composer
// exposes two trigger buttons so the test can drive inputValue + onSubmit
// without depending on the real Composer's internals.
vi.mock('@/components/chat/Composer', () => ({
  Composer: ({
    onChange,
    onSubmit,
  }: {
    onChange: (v: string) => void;
    onSubmit: () => void;
  }) => (
    <div data-testid="composer-mock">
      <button type="button" onClick={() => onChange('predicate device 검색')}>
        set-input
      </button>
      <button type="button" onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}));

vi.mock('@/components/chat/AnswerBlock', () => ({
  AnswerBlock: () => <div data-testid="answer-block-mock" />,
}));
vi.mock('@/components/chat/Thinking', () => ({ Thinking: () => null }));
vi.mock('@/components/chat/Callout', () => ({ Callout: () => null }));
vi.mock('@/components/chat/SuggestionPill', () => ({ SuggestionPill: () => null }));

import { ChatShell } from '@/components/chat/ChatShell';

describe('ChatShell ticketId surfacing (REQ-V3-UI-033, T-024)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mock.ticketId = 'it_test-ticket-123';
    mock.prose = '모의 답변 텍스트입니다.';
    mock.start.mockReset();
  });

  it('surfaces ticket status panel + /inbox/[id] link after ask submission', () => {
    render(<ChatShell />);

    // Drive the ask path: set non-empty input then submit.
    fireEvent.click(screen.getByText('set-input'));
    fireEvent.click(screen.getByText('submit'));

    expect(mock.start).toHaveBeenCalledTimes(1);

    const panel = screen.getByTestId('chat-ticket-status');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent('내 질문이 RA 인박스에 등록되었습니다');

    const link = screen.getByTestId('chat-ticket-link');
    expect(link).toHaveAttribute('href', '/inbox/it_test-ticket-123');
  });

  it('hides the ticket status panel when ticketId is null', () => {
    // prose stays non-empty so showAnswer is true; only the ticketId gate differs.
    mock.ticketId = null;

    render(<ChatShell />);

    fireEvent.click(screen.getByText('set-input'));
    fireEvent.click(screen.getByText('submit'));

    expect(mock.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('chat-ticket-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-ticket-link')).not.toBeInTheDocument();
  });
});
