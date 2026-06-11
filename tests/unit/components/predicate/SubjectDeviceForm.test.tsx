// @MX:NOTE Unit tests for SubjectDeviceForm — SPEC-REGULA-PREDICATE-001 (Task 9 Item B).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SubjectDeviceForm from '../../../../components/predicate/SubjectDeviceForm';

afterEach(() => cleanup());

const DIMENSIONS = [
  'intended_use',
  'indications',
  'tech_characteristics',
  'materials',
  'performance',
] as const;

describe('SubjectDeviceForm', () => {
  it('renders one textarea per comparison dimension', () => {
    render(<SubjectDeviceForm onSubmit={vi.fn()} />);
    for (const dim of DIMENSIONS) {
      expect(screen.getByTestId(`subject-input-${dim}`)).toBeTruthy();
    }
  });

  it('renders the Build Comparison Table submit button', () => {
    render(<SubjectDeviceForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Build Comparison Table/i })).toBeTruthy();
  });

  it('submits all five dimension values as a record', () => {
    const onSubmit = vi.fn();
    render(<SubjectDeviceForm onSubmit={onSubmit} />);
    for (const dim of DIMENSIONS) {
      fireEvent.change(screen.getByTestId(`subject-input-${dim}`), {
        target: { value: `${dim}-value` },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: /Build Comparison Table/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      intended_use: 'intended_use-value',
      indications: 'indications-value',
      tech_characteristics: 'tech_characteristics-value',
      materials: 'materials-value',
      performance: 'performance-value',
    });
  });

  it('disables the submit button while loading', () => {
    render(<SubjectDeviceForm onSubmit={vi.fn()} isLoading />);
    const button = screen.getByRole('button', { name: /Build Comparison Table/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
