/** @vitest-environment jsdom */

/**
 * ExportHub component tests
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom';
import { ExportHub } from '../ExportHub';

const artifact = {
  title: 'Test Answer',
  content: 'Actual selected answer content',
  artifactType: 'answer' as const,
  filenameBase: 'test-answer',
};

describe('ExportHub', () => {
  it('renders export button trigger', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    expect(screen.getByRole('button', { name: /내보내기/i })).toBeInTheDocument();
  });

  it('renders format selection menu when export button is clicked', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    const button = screen.getByRole('button', { name: /내보내기/i });
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders all four format options: DOCX, PDF, Markdown, Email', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    const button = screen.getByRole('button', { name: /내보내기/i });
    fireEvent.click(button);

    expect(screen.getByRole('menuitem', { name: /DOCX/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /이메일/i })).toBeInTheDocument();
  });

  it('disables export button when conversationId is missing', () => {
    render(<ExportHub conversationId="" messageId="test-msg-456" artifact={artifact} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    expect(button).toBeDisabled();
  });

  it('disables export button when messageId is missing', () => {
    render(<ExportHub conversationId="test-conv-123" messageId="" artifact={artifact} />);
    const button = screen.getByRole('button', { name: /내보내기/i });
    expect(button).toBeDisabled();
  });

  it('closes menu when clicking outside', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    const button = screen.getByRole('button', { name: /내보내기/i });
    fireEvent.click(button);

    // Menu should be open
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    // Menu should be closed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when ESC key is pressed', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    const button = screen.getByRole('button', { name: /내보내기/i });
    fireEvent.click(button);

    // Menu should be open
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Press ESC
    fireEvent.keyDown(document, { key: 'Escape' });

    // Menu should be closed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles menu open/close when button is clicked multiple times', () => {
    render(
      <ExportHub conversationId="test-conv-123" messageId="test-msg-456" artifact={artifact} />,
    );
    const button = screen.getByRole('button', { name: /내보내기/i });

    // First click - menu opens
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Second click - menu closes
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
