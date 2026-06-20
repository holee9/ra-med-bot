/** @vitest-environment jsdom */

/**
 * ExportButton component tests
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ExportButton } from '../ExportButton';

describe('ExportButton', () => {
  it('renders button with "내보내기" text', () => {
    render(<ExportButton onClick={() => {}} disabled={false} isOpen={false} />);
    expect(screen.getByRole('button', { name: /내보내기/i })).toBeInTheDocument();
  });

  it('renders FileText icon', () => {
    render(<ExportButton onClick={() => {}} disabled={false} isOpen={false} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<ExportButton onClick={() => {}} disabled={true} isOpen={false} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    expect(button).toBeDisabled();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<ExportButton onClick={handleClick} disabled={false} isOpen={false} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    button.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows active state when isOpen is true', () => {
    render(<ExportButton onClick={() => {}} disabled={false} isOpen={true} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
