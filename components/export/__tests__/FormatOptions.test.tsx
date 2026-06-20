/** @vitest-environment jsdom */

/**
 * FormatOptions component tests
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001, REQ-EXP-002)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { FormatOptions } from '../FormatOptions';

const artifact = {
  title: 'Test Answer',
  content: 'Actual selected answer content',
  artifactType: 'answer' as const,
  filenameBase: 'test-answer',
};

describe('FormatOptions', () => {
  it('renders menu with role="menu"', () => {
    render(<FormatOptions artifact={artifact} onClose={() => {}} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders four format menu items: DOCX, PDF, Markdown, 이메일', () => {
    render(<FormatOptions artifact={artifact} onClose={() => {}} />);
    expect(screen.getByRole('menuitem', { name: /DOCX/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /이메일/i })).toBeInTheDocument();
  });

  it('calls onClose when ESC key is pressed', () => {
    const handleClose = vi.fn();
    render(<FormatOptions artifact={artifact} onClose={handleClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside', () => {
    const handleClose = vi.fn();
    render(
      <div>
        <FormatOptions artifact={artifact} onClose={handleClose} />
        <div data-testid="outside">Outside</div>
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(handleClose).toHaveBeenCalled();
  });
});
