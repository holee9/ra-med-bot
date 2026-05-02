// @MX:NOTE Unit tests for SuggestionPill component — REQ-STRUCT-026~027.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuggestionPill } from '../../components/chat/SuggestionPill';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SuggestionPill component (REQ-STRUCT-026)', () => {
  it('renders the pill text', () => {
    render(<SuggestionPill text="510(k) 면제 조건은?" onClick={vi.fn()} />);
    expect(screen.getByText('510(k) 면제 조건은?')).toBeDefined();
  });

  it('has role="button"', () => {
    render(<SuggestionPill text="질문" onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
  });

  it('has aria-label containing the text', () => {
    render(<SuggestionPill text="질문 텍스트" onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('질문 텍스트');
  });

  it('aria-label starts with "이어서 질문하기:"', () => {
    render(<SuggestionPill text="질문" onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/이어서 질문하기:/);
  });
});

describe('SuggestionPill click behavior (REQ-STRUCT-027)', () => {
  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn();
    render(<SuggestionPill text="질문" onClick={mockOnClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not submit form when clicked', () => {
    const mockSubmit = vi.fn();
    render(
      <form onSubmit={mockSubmit}>
        <SuggestionPill text="질문" onClick={vi.fn()} />
      </form>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
