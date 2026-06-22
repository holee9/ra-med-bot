/** @vitest-environment jsdom */

import '@testing-library/jest-dom';
import { RagRouteBadge } from '@/components/chat/RagRouteBadge';
import type { RagRouteEvent } from '@/types/streaming';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('RagRouteBadge', () => {
  it('renders local path label', () => {
    const route: RagRouteEvent = { type: 'rag_route', path: 'local' };
    render(<RagRouteBadge route={route} />);
    expect(screen.getByRole('status')).toHaveTextContent('고객 Runtime');
  });

  it('renders hybrid path label', () => {
    const route: RagRouteEvent = { type: 'rag_route', path: 'hybrid' };
    render(<RagRouteBadge route={route} />);
    expect(screen.getByRole('status')).toHaveTextContent('하이브리드');
  });

  it('renders regula path label', () => {
    const route: RagRouteEvent = { type: 'rag_route', path: 'regula' };
    render(<RagRouteBadge route={route} />);
    expect(screen.getByRole('status')).toHaveTextContent('Regula');
  });

  it('shows fallback indicator when fallback=true', () => {
    const route: RagRouteEvent = {
      type: 'rag_route',
      path: 'local',
      fallback: true,
      fallback_reason: 'timeout',
    };
    render(<RagRouteBadge route={route} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('폴백');
    expect(badge).toHaveAttribute('title', '응답 지연으로 대체 경로 사용');
  });

  it('has aria-label with path name', () => {
    const route: RagRouteEvent = { type: 'rag_route', path: 'hybrid' };
    render(<RagRouteBadge route={route} />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('하이브리드'),
    );
  });

  it('no title when no fallback_reason', () => {
    const route: RagRouteEvent = { type: 'rag_route', path: 'regula' };
    render(<RagRouteBadge route={route} />);
    expect(screen.getByRole('status')).not.toHaveAttribute('title');
  });
});
