/**
 * @vitest-environment jsdom
 */
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-054/058/059/060/061, AC-CONS-UI-003/005)
import '@testing-library/jest-dom';
import { ConsultSessionDetail } from '@/components/consult/ConsultSessionDetail';
import { TurnHistoryItem } from '@/components/consult/TurnHistoryItem';
import type { Role } from '@/lib/kernel/auth/rbac';
import type { ConsultSession, ConsultTurn } from '@/lib/queries/useConsult';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// QuestionComposer (rendered inside ConsultSessionDetail for non-viewer) uses
// useCreateTurn — mock it so no QueryClientProvider is required (ApproveDialog pattern).
vi.mock('@/lib/queries/useConsult', async () => {
  const actual = await vi.importActual<typeof import('@/lib/queries/useConsult')>(
    '@/lib/queries/useConsult',
  );
  return {
    ...actual,
    useCreateTurn: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    }),
  };
});

describe('TurnHistoryItem', () => {
  const mockTurn: ConsultTurn = {
    id: 'turn-1',
    sessionId: 'session-123',
    turnNumber: 1,
    question: 'What is RA?',
    answer: 'Regulatory Affairs...',
    citations: [{ sourceId: 'src-1', text: 'Regulatory guidance' }],
    sources: [{ id: 'src-1', title: 'Guide 1' }],
    confidence: 0.85,
    error: null,
    createdAt: '2026-01-01T01:00:00Z',
  };

  it('should render turn with question, answer (REQ-V3-UI-058)', () => {
    render(<TurnHistoryItem turn={mockTurn} />);

    expect(screen.getByTestId('turn-question')).toHaveTextContent('Q: What is RA?');
    expect(screen.getByTestId('turn-answer')).toHaveTextContent('A: Regulatory Affairs...');
    expect(screen.getByTestId('turn-timestamp')).toBeInTheDocument();
  });

  it('should render error turn with error message (REQ-V3-UI-059)', () => {
    const errorTurn: ConsultTurn = {
      ...mockTurn,
      answer: null,
      error: 'no_citations',
    };

    render(<TurnHistoryItem turn={errorTurn} />);

    expect(screen.getByTestId('turn-error')).toHaveTextContent('답변 생성 실패: no_citations');
    expect(screen.queryByTestId('turn-answer')).not.toBeInTheDocument();
  });
});

describe('ConsultSessionDetail', () => {
  const mockSession: ConsultSession = {
    id: 'session-123',
    orgId: 'org-1',
    userId: 'user-1',
    projectId: null,
    title: 'Test Session',
    locale: 'ko',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  };

  const mockTurns: ConsultTurn[] = [
    {
      id: 'turn-1',
      sessionId: 'session-123',
      turnNumber: 1,
      question: 'Q1',
      answer: 'A1',
      citations: [],
      sources: [],
      confidence: 0.8,
      error: null,
      createdAt: '2026-01-01T01:00:00Z',
    },
  ];

  it('should render session metadata and turns in turnNumber order (REQ-V3-UI-054)', () => {
    render(
      <ConsultSessionDetail
        session={mockSession}
        turns={mockTurns}
        userRole={'ra-member' as Role}
      />,
    );

    expect(screen.getByTestId('consult-session-title')).toHaveTextContent('Test Session');
    expect(screen.getByTestId('consult-session-meta')).toBeInTheDocument();
    expect(screen.getByTestId('consult-turns-history')).toBeInTheDocument();
    expect(screen.getByTestId('turn-item')).toBeInTheDocument();
  });

  it('should not show QuestionComposer for viewer role', () => {
    render(
      <ConsultSessionDetail session={mockSession} turns={mockTurns} userRole={'viewer' as Role} />,
    );

    expect(screen.queryByTestId('question-composer')).not.toBeInTheDocument();
  });

  it('should show QuestionComposer for ra-member', () => {
    render(
      <ConsultSessionDetail
        session={mockSession}
        turns={mockTurns}
        userRole={'ra-member' as Role}
      />,
    );

    expect(screen.getByTestId('question-composer')).toBeInTheDocument();
  });
});
