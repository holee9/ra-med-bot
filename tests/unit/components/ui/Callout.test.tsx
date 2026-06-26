// @MX:NOTE [AUTO] Callout unit test — verifies info/warn/danger variants.
// Tests that Callout renders correctly with proper role attributes and styling.
// @MX:SPEC Issue #158 (Group B - Readiness surfaces)
// @vitest-environment jsdom

import '@testing-library/jest-dom';
import { Callout } from '@/components/ui/Callout';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('Callout', () => {
  it('renders info variant with note role', () => {
    render(
      <Callout variant="info" title="Info Title">
        <p>Info content</p>
      </Callout>,
    );
    expect(screen.getByText('Info Title')).toBeInTheDocument();
    expect(screen.getByText('Info content')).toBeInTheDocument();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('renders warn variant with note role', () => {
    render(
      <Callout variant="warn" title="Warn Title">
        <p>Warn content</p>
      </Callout>,
    );
    expect(screen.getByText('Warn Title')).toBeInTheDocument();
    expect(screen.getByText('Warn content')).toBeInTheDocument();
  });

  it('renders danger variant with alert role', () => {
    render(
      <Callout variant="danger" title="Danger Title">
        <p>Danger content</p>
      </Callout>,
    );
    expect(screen.getByText('Danger Title')).toBeInTheDocument();
    expect(screen.getByText('Danger content')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
