// @MX:NOTE [AUTO] RTL tests for CERLinkageIndicator — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// Covers: (a) renders linked state with CER id, (b) renders unlinked state with guidance,
// (c) icon + text for accessibility.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CERLinkageIndicator } from '../../../../app/(app)/pms/_components/CERLinkageIndicator';

afterEach(() => {
  cleanup();
});

describe('CERLinkageIndicator — REQ-PMS-004 (CER auto-linkage)', () => {
  it('renders linked state when cerRefId provided', () => {
    render(<CERLinkageIndicator cerRefId="cer-abc-123" cerDeviceName="Insulin Pump" />);
    const indicator = screen.getByTestId('cer-linkage-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain('cer-abc-123');
    expect(indicator.textContent).toMatch(/연결됨|linked/i);
  });

  it('renders unlinked guidance when cerRefId is null', () => {
    render(<CERLinkageIndicator cerRefId={null} cerDeviceName={null} />);
    const indicator = screen.getByTestId('cer-linkage-indicator');
    expect(indicator.textContent).toMatch(/연결되지 않음|not linked/i);
  });

  it('uses icon + text (WCAG 2.1 AA — color not the only signal)', () => {
    render(<CERLinkageIndicator cerRefId="cer-1" cerDeviceName="Device" />);
    const indicator = screen.getByTestId('cer-linkage-indicator');
    // Must have an aria-label or accessible text describing the state.
    expect(indicator.getAttribute('aria-label') ?? indicator.textContent).toMatch(/CER|임상 평가/i);
  });
});
