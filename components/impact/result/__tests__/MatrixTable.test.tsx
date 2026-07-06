/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatrixTable } from '../MatrixTable';
import type { MatrixItem } from '../MatrixTable';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('MatrixTable', () => {
  const mockMatrix: MatrixItem[] = [
    { level: 'required', ref: '21 CFR 820.30', note: 'Validation required', market: 'us' },
    { level: 'conditional', ref: 'MDR Annex II', note: 'Technical file', market: 'eu' },
    { level: 'not-required', ref: 'N/A', note: 'No requirement', market: 'kr' },
  ];

  describe('AC-IMP-UI-07: renders matrix data', () => {
    it('should render matrix table with testid', () => {
      render(<MatrixTable matrix={mockMatrix} />);
      const table = screen.getByTestId('matrix-table');
      expect(table).toBeInTheDocument();
    });

    it('should render all matrix rows', () => {
      render(<MatrixTable matrix={mockMatrix} />);

      expect(screen.getByText('us')).toBeInTheDocument();
      expect(screen.getByText('eu')).toBeInTheDocument();
      expect(screen.getByText('kr')).toBeInTheDocument();
    });

    it('should render ref and note for each row', () => {
      render(<MatrixTable matrix={mockMatrix} />);

      expect(screen.getByText('21 CFR 820.30')).toBeInTheDocument();
      expect(screen.getByText('Validation required')).toBeInTheDocument();
      expect(screen.getByText('MDR Annex II')).toBeInTheDocument();
      expect(screen.getByText('Technical file')).toBeInTheDocument();
    });

    it('should apply emphasis style for required level', () => {
      render(<MatrixTable matrix={mockMatrix} />);

      const requiredRow = screen.getByText('Validation required');
      expect(requiredRow).toBeInTheDocument();
      // Required level should have red emphasis styling
      expect(requiredRow.closest('tr')).toHaveClass('border-l-4');
    });

    it('should apply emphasis style for conditional level', () => {
      render(<MatrixTable matrix={mockMatrix} />);

      const conditionalRow = screen.getByText('Technical file');
      expect(conditionalRow).toBeInTheDocument();
      // Conditional level should have yellow emphasis styling
      expect(conditionalRow.closest('tr')).toHaveClass('border-yellow-500');
    });

    it('should apply neutral emphasis for not-required level', () => {
      render(<MatrixTable matrix={mockMatrix} />);

      const notRequiredRow = screen.getByText('No requirement');
      expect(notRequiredRow).toBeInTheDocument();
      // Not-required should have neutral gray styling
      expect(notRequiredRow.closest('tr')).toHaveClass('border-gray-300');
    });
  });

  describe('Edge cases', () => {
    it('should render empty table when matrix array is empty', () => {
      render(<MatrixTable matrix={[]} />);
      const table = screen.getByTestId('matrix-table');
      expect(table).toBeInTheDocument();
      expect(screen.getByText('result.matrixHeader')).toBeInTheDocument();
    });

    it('should handle matrix with multiple markets', () => {
      const multiMarketMatrix: MatrixItem[] = [
        { level: 'required', ref: 'US FDA 21 CFR 820', note: 'US requirement', market: 'us' },
        { level: 'required', ref: 'EU MDR', note: 'EU requirement', market: 'eu' },
        { level: 'conditional', ref: 'MFDS', note: 'KR requirement', market: 'kr' },
      ];

      render(<MatrixTable matrix={multiMarketMatrix} />);

      expect(screen.getByText('US FDA 21 CFR 820')).toBeInTheDocument();
      expect(screen.getByText('EU MDR')).toBeInTheDocument();
      expect(screen.getByText('MFDS')).toBeInTheDocument();
    });
  });
});
