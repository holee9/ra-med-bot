// @MX:NOTE Unit tests for MockDataDisclosure — TASK-003.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MockDataDisclosure } from '../../../components/ui/MockDataDisclosure';

afterEach(() => {
  cleanup();
});

describe('MockDataDisclosure', () => {
  it('renders the default Korean disclosure message', () => {
    render(<MockDataDisclosure />);
    const el = screen.getByTestId('mock-data-disclosure');
    expect(el.textContent).toMatch(/시뮬레이션 데이터/);
    expect(el.textContent).toMatch(/데모 용도/);
  });

  it('honors a custom message', () => {
    render(<MockDataDisclosure message="Simulated data only." />);
    expect(screen.getByTestId('mock-data-disclosure').textContent).toMatch(/Simulated data only\./);
  });

  it('uses warn token palette (amber/accent)', () => {
    render(<MockDataDisclosure />);
    const el = screen.getByTestId('mock-data-disclosure');
    expect(el.className).toMatch(/bg-accent-50/);
    expect(el.className).toMatch(/border-accent-400/);
    expect(el.className).toMatch(/text-accent-800/);
  });

  it('exposes role="note" for assistive tech', () => {
    render(<MockDataDisclosure />);
    expect(screen.getByRole('note')).toBeDefined();
  });

  it('appends extra className', () => {
    render(<MockDataDisclosure className="my-2" />);
    const el = screen.getByTestId('mock-data-disclosure');
    expect(el.className).toMatch(/my-2/);
  });
});
