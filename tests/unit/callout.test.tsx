// @MX:NOTE Unit tests for Callout component — REQ-STRUCT-025.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Callout } from '../../components/chat/Callout';

afterEach(() => {
  cleanup();
});

describe('Callout component (REQ-STRUCT-025)', () => {
  it('renders title and children', () => {
    render(
      <Callout variant="info" title="안내 메시지">
        <span>내용입니다</span>
      </Callout>,
    );
    expect(screen.getByText('안내 메시지')).toBeDefined();
    expect(screen.getByText('내용입니다')).toBeDefined();
  });

  it('applies info variant classes', () => {
    const { container } = render(
      <Callout variant="info" title="Info">
        body
      </Callout>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-brand-50/);
    expect(el.className).toMatch(/border-brand-200/);
  });

  it('applies warn variant classes', () => {
    const { container } = render(
      <Callout variant="warn" title="경고">
        body
      </Callout>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent-50/);
    expect(el.className).toMatch(/border-accent-400/);
  });

  it('applies expert variant classes', () => {
    const { container } = render(
      <Callout variant="expert" title="전문가 검토">
        body
      </Callout>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-accent-100/);
    expect(el.className).toMatch(/border-accent-600/);
  });

  it('renders all 3 variants without crashing', () => {
    for (const variant of ['info', 'warn', 'expert'] as const) {
      const { unmount } = render(
        <Callout variant={variant} title="Test">
          body
        </Callout>,
      );
      expect(screen.getByText('Test')).toBeDefined();
      unmount();
    }
  });
});
