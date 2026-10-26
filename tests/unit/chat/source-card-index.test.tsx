// @MX:NOTE [AUTO] #541 — 외부 보강 소스의 citeIndex 9000+ 표기 재번째 사용자 친화 번호로.
/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const openMock = vi.fn();

vi.mock('@/hooks/useDocViewer', () => ({
  useDocViewer: () => ({ open: openMock }),
}));

import { SourceCard } from '@/components/chat/SourceCard';

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: 'src-1',
    citeIndex: 9003,
    orgLabel: 'FDA 510(k) Database',
    title: 'KXXXXXX',
    year: 2003,
    type: 'Guidance',
    url: null,
    anchor: 'KXXXXXX',
    offset: 0,
    ...overrides,
  };
}

describe('SourceCard display index (#541)', () => {
  it('renders 9000+ external citeIndex as compact badge, not raw 9003', () => {
    render(<SourceCard source={source() as never} />);
    expect(screen.queryByText('9003')).not.toBeInTheDocument();
  });

  it('renders 1-based RAG citeIndex verbatim', () => {
    render(<SourceCard source={source({ citeIndex: 2 }) as never} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('click still opens the doc viewer with the RAW citeIndex (citation mapping integrity)', () => {
    render(<SourceCard source={source() as never} />);
    const btn = screen.getAllByRole('button')[0];
    if (!btn) throw new Error('button missing');
    fireEvent.click(btn);
    expect(openMock).toHaveBeenCalledWith(9003, 0, 'src-1');
  });
});
