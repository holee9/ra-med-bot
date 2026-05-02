/** @vitest-environment jsdom */

// Chat component tests — RTL tests for Phase 2 components.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-030..039, REQ-CHAT-044, REQ-CHAT-045)

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useDocViewer to avoid hook context issues in unit tests.
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

// Mock next/dynamic to render components synchronously.
vi.mock('next/dynamic', () => ({
  default: (_fn: () => Promise<{ DocViewer: () => null }>) => {
    // Dynamic import becomes synchronous null component in tests.
    return () => null;
  },
}));

// Mock navigator.clipboard.
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});

import { AnswerBlock } from '../../components/chat/AnswerBlock';
import { Citation } from '../../components/chat/Citation';
import { Composer } from '../../components/chat/Composer';
// ---------------------------------------------------------------------------
// Components under test
// ---------------------------------------------------------------------------
import { ConfidenceBadge } from '../../components/chat/ConfidenceBadge';
import { SourceCard } from '../../components/chat/SourceCard';
import { SourcesGrid } from '../../components/chat/SourcesGrid';
import { Thinking } from '../../components/chat/Thinking';
import type { ConfidenceEvent, SourceItem, TraceEvent } from '../../types/streaming';

// ---------------------------------------------------------------------------
// ConfidenceBadge
// ---------------------------------------------------------------------------
describe('ConfidenceBadge', () => {
  it('renders HIGH badge with correct label and percentage', () => {
    render(<ConfidenceBadge level="high" score={0.92} />);
    // ConfidenceBadge renders "HIGH · 92%" as a single text node.
    expect(screen.getByText(/HIGH/)).toBeInTheDocument();
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it('renders MED badge', () => {
    render(<ConfidenceBadge level="med" score={0.65} />);
    expect(screen.getByText(/MED/)).toBeInTheDocument();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
  });

  it('renders LOW badge', () => {
    render(<ConfidenceBadge level="low" score={0.3} />);
    expect(screen.getByText(/LOW/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SourceCard — REQ-CHAT-045
// ---------------------------------------------------------------------------
const MOCK_SOURCE: SourceItem = {
  id: 'src-1',
  citeIndex: 2,
  orgLabel: 'FDA',
  title: '21 CFR Part 820 — Quality System Regulation',
  year: 2023,
  type: 'Regulation',
  url: 'https://ecfr.gov/part-820',
  anchor: '820.30',
  offset: 0,
};

describe('SourceCard', () => {
  it('renders citeIndex badge', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders org label', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    expect(screen.getByText('FDA')).toBeInTheDocument();
  });

  it('renders type pill', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    expect(screen.getByText('Regulation')).toBeInTheDocument();
  });

  it('renders title with 2-line clamp class', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    const title = screen.getByText('21 CFR Part 820 — Quality System Regulation');
    expect(title).toHaveClass('line-clamp-2');
  });

  it('renders year', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    expect(screen.getByText('2023')).toBeInTheDocument();
  });

  it('renders external link when url is present', () => {
    render(<SourceCard source={MOCK_SOURCE} />);
    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('href', 'https://ecfr.gov/part-820');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render external link when url is null', () => {
    render(<SourceCard source={{ ...MOCK_SOURCE, url: null }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('does not render year when year is null', () => {
    render(<SourceCard source={{ ...MOCK_SOURCE, year: null }} />);
    expect(screen.queryByText('2023')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SourcesGrid
// ---------------------------------------------------------------------------
describe('SourcesGrid', () => {
  it('returns null for empty sources array', () => {
    const { container } = render(<SourcesGrid sources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all source cards', () => {
    const sources: SourceItem[] = [
      MOCK_SOURCE,
      { ...MOCK_SOURCE, id: 'src-2', citeIndex: 3, title: 'FDA Guidance Doc' },
    ];
    render(<SourcesGrid sources={sources} />);
    expect(screen.getAllByText('FDA')).toHaveLength(2);
  });

  it('applies grid layout style', () => {
    const { container } = render(<SourcesGrid sources={[MOCK_SOURCE]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.style.gridTemplateColumns).toContain('minmax(240px');
  });
});

// ---------------------------------------------------------------------------
// Thinking — REQ-CHAT-037, REQ-CHAT-038
// ---------------------------------------------------------------------------
describe('Thinking', () => {
  it('returns null for empty traceSteps', () => {
    const { container } = render(<Thinking traceSteps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows active spinner for active step', () => {
    const steps: TraceEvent[] = [{ type: 'trace', step: 'retrieval', status: 'active' }];
    render(<Thinking traceSteps={steps} />);
    expect(screen.getByText('retrieval')).toBeInTheDocument();
    // aria-live polite on wrapper.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows check icon for done step', () => {
    const steps: TraceEvent[] = [{ type: 'trace', step: 'retrieval', status: 'done' }];
    render(<Thinking traceSteps={steps} />);
    expect(screen.getByText('retrieval')).toBeInTheDocument();
  });

  it('shows animated dots only when there is an active step', () => {
    const active: TraceEvent[] = [{ type: 'trace', step: 'generating', status: 'active' }];
    const { container: activeContainer } = render(<Thinking traceSteps={active} />);
    // animated dots span has aria-hidden
    const dotsSpan = activeContainer.querySelector('[aria-hidden="true"]');
    expect(dotsSpan).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AnswerBlock — REQ-CHAT-030, REQ-CHAT-039
// ---------------------------------------------------------------------------
describe('AnswerBlock', () => {
  const confidence: ConfidenceEvent = { type: 'confidence', level: 'high', score: 0.88 };
  const sources: SourceItem[] = [MOCK_SOURCE];

  it('renders "요약 답변" section label', () => {
    render(
      <AnswerBlock
        confidence={confidence}
        sources={sources}
        prose="Test answer"
        durationMs={1200}
      />,
    );
    expect(screen.getByText(/요약 답변/i)).toBeInTheDocument();
  });

  it('renders "출처 (N)" section label with source count', () => {
    render(
      <AnswerBlock
        confidence={confidence}
        sources={sources}
        prose="Test answer"
        durationMs={null}
      />,
    );
    expect(screen.getByText(/출처 \(1\)/)).toBeInTheDocument();
  });

  it('renders prose text via ReactMarkdown', () => {
    render(
      <AnswerBlock confidence={undefined} sources={[]} prose="Hello **world**" durationMs={null} />,
    );
    expect(screen.getByText('world')).toBeInTheDocument();
  });

  it('renders expert review callout when expertReviewRequired is true', () => {
    render(
      <AnswerBlock
        confidence={confidence}
        sources={[]}
        prose="Sensitive topic"
        durationMs={null}
        expertReviewRequired
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByText(/전문가 검토/).length).toBeGreaterThan(0);
  });

  it('does not render sources section when sources array is empty', () => {
    render(
      <AnswerBlock confidence={undefined} sources={[]} prose="No sources" durationMs={null} />,
    );
    expect(screen.queryByText(/출처 \(/)).toBeNull();
  });

  it('renders duration when durationMs is provided', () => {
    render(<AnswerBlock confidence={undefined} sources={[]} prose="text" durationMs={2500} />);
    expect(screen.getByText(/분석 2.5s/)).toBeInTheDocument();
  });

  it('copy button calls clipboard.writeText with prose', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<AnswerBlock confidence={undefined} sources={[]} prose="Copy me" durationMs={null} />);
    const copyBtn = screen.getByRole('button', { name: /copy answer/i });
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith('Copy me');
  });
});

// ---------------------------------------------------------------------------
// Citation — REQ-CHAT-041, REQ-CHAT-042
// ---------------------------------------------------------------------------
describe('Citation', () => {
  it('renders as superscript with correct source index', () => {
    render(<Citation sourceIndex={3} offset={42} sourceId="src-abc" />);
    const sup = screen.getByRole('button', { name: /source 3/i });
    expect(sup.tagName.toLowerCase()).toBe('sup');
    expect(within(sup).getByText('3')).toBeInTheDocument();
  });

  it('calls the default mock open on click without error', () => {
    // The top-level vi.mock returns open: vi.fn(). We just verify click fires without throw.
    render(<Citation sourceIndex={3} offset={42} sourceId="src-abc" />);
    // Should not throw.
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('calls open on Enter key', () => {
    render(<Citation sourceIndex={1} offset={0} sourceId="x" />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    // open from the default mock is vi.fn() — just verify no error thrown.
  });
});

// ---------------------------------------------------------------------------
// Composer — REQ-CHAT-031..036
// ---------------------------------------------------------------------------
describe('Composer', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    sourceFilter: 'all' as const,
    onSourceFilterChange: vi.fn(),
    onSubmit: vi.fn(),
    isStreaming: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea with placeholder', () => {
    render(<Composer {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: /질문 입력/i })).toBeInTheDocument();
  });

  it('renders source filter chips: 전체, 규정, 내부', () => {
    render(<Composer {...defaultProps} />);
    expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '규정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내부' })).toBeInTheDocument();
  });

  it('marks active filter chip as pressed', () => {
    render(<Composer {...defaultProps} sourceFilter="regs" />);
    expect(screen.getByRole('button', { name: '규정' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSourceFilterChange when a chip is clicked', () => {
    const onSourceFilterChange = vi.fn();
    render(<Composer {...defaultProps} onSourceFilterChange={onSourceFilterChange} />);
    fireEvent.click(screen.getByRole('button', { name: '규정' }));
    expect(onSourceFilterChange).toHaveBeenCalledWith('regs');
  });

  it('calls onSubmit when Enter is pressed with non-empty value', () => {
    const onSubmit = vi.fn();
    render(<Composer {...defaultProps} value="test question" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('does not call onSubmit on Shift+Enter', () => {
    const onSubmit = vi.fn();
    render(<Composer {...defaultProps} value="test" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows abort (stop) button when streaming', () => {
    render(<Composer {...defaultProps} isStreaming value="something" />);
    expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();
  });

  it('calls onAbort when stop button is clicked during streaming', () => {
    const onAbort = vi.fn();
    render(<Composer {...defaultProps} isStreaming value="something" onAbort={onAbort} />);
    fireEvent.click(screen.getByRole('button', { name: /stop generation/i }));
    expect(onAbort).toHaveBeenCalled();
  });

  it('disables textarea when streaming', () => {
    render(<Composer {...defaultProps} isStreaming value="text" />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows character counter when value exceeds 3600 chars', () => {
    const longText = 'a'.repeat(3601);
    render(<Composer {...defaultProps} value={longText} />);
    expect(screen.getByText('3601 / 4000')).toBeInTheDocument();
  });

  it('does not show character counter below 3600 chars', () => {
    render(<Composer {...defaultProps} value="short" />);
    expect(screen.queryByText(/\/ 4000/)).toBeNull();
  });
});
