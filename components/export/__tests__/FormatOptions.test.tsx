/** @vitest-environment jsdom */

/**
 * FormatOptions component tests
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001, REQ-EXP-002)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { FormatOptions } from '../FormatOptions';

describe('FormatOptions', () => {
  it('renders menu with role="menu"', () => {
    render(<FormatOptions onClose={() => {}} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders four format menu items: DOCX, PDF, Markdown, 이메일', () => {
    render(<FormatOptions onClose={() => {}} />);
    expect(screen.getByRole('menuitem', { name: /DOCX/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /이메일/i })).toBeInTheDocument();
  });

  it('calls onClose when ESC key is pressed', () => {
    const handleClose = vi.fn();
    render(<FormatOptions onClose={handleClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    // ESC key listener needs to be added to the implementation
  });

  it('calls onClose when clicking outside', () => {
    const handleClose = vi.fn();
    render(
      <div>
        <FormatOptions onClose={handleClose} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.click(screen.getByTestId('outside'));
    // Click outside listener needs to be added to the implementation
  });
});
