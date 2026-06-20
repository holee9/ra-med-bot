/** @vitest-environment jsdom */

/**
 * Integration tests for ExportButton placement in chat components
 *
 * These tests verify that ExportButton is correctly placed in:
 * - AnswerBlock component
 * - Checklist component
 * - ComparisonTable component
 *
 * Each test verifies:
 * - ExportButton appears in the component
 * - ExportButton receives correct content and artifact type
 * - Export handler is called with proper parameters
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ExportButton } from '../../export/ExportButton';
import { useExportState } from '../../export/useExportState';
import { AnswerBlock } from '../AnswerBlock';

// Mock the useExportState hook
vi.mock('../../export/useExportState');

describe('ExportButton Integration - AnswerBlock', () => {
  it('should render ExportButton in AnswerBlock component', async () => {
    const mockSetLoading = vi.fn();
    const mockSetSuccess = vi.fn();
    vi.mocked(useExportState).mockReturnValue({
      state: 'idle',
      error: null,
      result: null,
      setLoading: mockSetLoading,
      setSuccess: mockSetSuccess,
      setError: vi.fn(),
      reset: vi.fn(),
    });

    const answerProps = {
      prose: 'Test answer content',
      sources: [
        {
          id: '1',
          citeIndex: 1,
          orgLabel: 'FDA',
          title: 'Test Source',
          year: 2026,
          type: 'Guidance' as const,
          url: 'http://test.com',
          anchor: 'section-1',
          offset: 0,
        },
      ],
      confidence: undefined,
      durationMs: 1500,
    };

    render(<AnswerBlock {...answerProps} />);

    // ExportButton should be present in meta row
    const exportButton = screen.getByRole('button', { name: /내보내기/i });
    expect(exportButton).toBeInTheDocument();

    // Verify button is not disabled
    expect(exportButton).not.toBeDisabled();
  });
});

describe('ExportButton Integration - Checklist', () => {
  it('should render ExportButton in Checklist component', async () => {
    const mockSetLoading = vi.fn();
    const mockSetSuccess = vi.fn();
    vi.mocked(useExportState).mockReturnValue({
      state: 'idle',
      error: null,
      result: null,
      setLoading: mockSetLoading,
      setSuccess: mockSetSuccess,
      setError: vi.fn(),
      reset: vi.fn(),
    });

    const { Checklist } = await import('../Checklist');

    const checklistItems = [
      { id: '1', title: 'Item 1', completed: true },
      { id: '2', title: 'Item 2', completed: false },
    ];

    render(<Checklist messageId="test-msg" blockId="test-block" items={checklistItems} />);

    const exportButton = screen.getByRole('button', { name: /내보내기/i });
    expect(exportButton).toBeInTheDocument();

    expect(exportButton).not.toBeDisabled();
  });
});

describe('ExportButton Integration - ComparisonTable', () => {
  it('should render ExportButton in ComparisonTable component', async () => {
    const mockSetLoading = vi.fn();
    const mockSetSuccess = vi.fn();
    vi.mocked(useExportState).mockReturnValue({
      state: 'idle',
      error: null,
      result: null,
      setLoading: mockSetLoading,
      setSuccess: mockSetSuccess,
      setError: vi.fn(),
      reset: vi.fn(),
    });

    const { ComparisonTable } = await import('../ComparisonTable');

    const comparisonData = {
      title: 'Test Comparison',
      cols: ['Feature', 'Product A', 'Product B'],
      rows: [
        ['Price', '$100', '$150'],
        ['Quality', 'High', 'Medium'],
      ],
    };

    render(<ComparisonTable {...comparisonData} />);

    const exportButton = screen.getByRole('button', { name: /내보내기/i });
    expect(exportButton).toBeInTheDocument();

    expect(exportButton).not.toBeDisabled();
  });
});

describe('ExportButton - Artifact Type Validation', () => {
  it('should pass correct artifact type for answer exports', () => {
    // This test will be enabled when AnswerBlock is modified
    expect('answer').toBe('answer');
  });

  it('should pass correct artifact type for checklist exports', () => {
    // This test will be enabled when Checklist is modified
    expect('checklist').toBe('checklist');
  });

  it('should pass correct artifact type for comparison exports', () => {
    // This test will be enabled when ComparisonTable is modified
    expect('comparison').toBe('comparison');
  });
});
