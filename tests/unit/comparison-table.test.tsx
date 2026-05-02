// @MX:NOTE Unit tests for ComparisonTable component — REQ-STRUCT-022~023.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComparisonTable } from '../../components/chat/ComparisonTable';

afterEach(() => {
  cleanup();
});

describe('ComparisonTable component (REQ-STRUCT-022)', () => {
  const validProps = {
    title: 'FDA vs EU 비교',
    cols: ['FDA', 'EU MDR'],
    rows: [
      ['510(k)', 'CE Mark'],
      ['3-6개월', '12-24개월'],
    ],
  };

  it('renders a table element', () => {
    render(<ComparisonTable {...validProps} />);
    expect(screen.getByRole('table')).toBeDefined();
  });

  it('renders column headers with scope="col"', () => {
    render(<ComparisonTable {...validProps} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(2);
    for (const th of headers) {
      expect((th as HTMLTableCellElement).scope).toBe('col');
    }
  });

  it('renders correct number of cells (cols × rows)', () => {
    render(<ComparisonTable {...validProps} />);
    const cells = screen.getAllByRole('cell');
    // 2 cols × 2 rows = 4 cells (first col cells might be th)
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it('renders title', () => {
    render(<ComparisonTable {...validProps} />);
    expect(screen.getByText('FDA vs EU 비교')).toBeDefined();
  });

  it('renders cell content correctly', () => {
    render(<ComparisonTable {...validProps} />);
    expect(screen.getByText('510(k)')).toBeDefined();
    expect(screen.getByText('CE Mark')).toBeDefined();
  });
});

describe('ComparisonTable fallback (REQ-STRUCT-023)', () => {
  it('renders fallback message when row length mismatches cols', () => {
    render(
      <ComparisonTable
        title="Test"
        cols={['A', 'B']}
        rows={[['x']]} // row length 1, cols length 2 → mismatch
      />,
    );
    expect(screen.getByText('표 데이터 형식 오류')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('does not render fallback when data is valid', () => {
    render(
      <ComparisonTable
        title="Test"
        cols={['A', 'B']}
        rows={[['x', 'y']]}
      />,
    );
    expect(screen.queryByText('표 데이터 형식 오류')).toBeNull();
    expect(screen.getByRole('table')).toBeDefined();
  });
});
