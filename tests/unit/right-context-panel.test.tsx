// @MX:NOTE Unit tests for RightContextPanel — REQ-STRUCT-029~033.
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RightContextPanel } from '../../components/chat/RightContextPanel';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RightContextPanel (REQ-STRUCT-029)', () => {
  it('renders 3 section headers in correct order', () => {
    const { container } = render(
      <RightContextPanel currentProjectId={null} latestMessageId={null} />,
    );

    const headers = container.querySelectorAll('[data-section-header]');
    expect(headers.length).toBe(3);

    const texts = Array.from(headers).map((h) => h.textContent ?? '');
    expect(texts[0]).toMatch(/현재 프로젝트/);
    expect(texts[1]).toMatch(/활용 출처/);
    expect(texts[2]).toMatch(/관련 규제 업데이트/);
  });

  it('renders section headers (case-insensitive match for uppercase styling)', () => {
    render(<RightContextPanel currentProjectId={null} latestMessageId={null} />);
    expect(screen.getByText(/현재 프로젝트/i)).toBeDefined();
    expect(screen.getByText(/활용 출처/i)).toBeDefined();
    expect(screen.getByText(/관련 규제 업데이트/i)).toBeDefined();
  });

  it('does not make any API calls (Phase 3 skeleton only) (REQ-STRUCT-029)', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(<RightContextPanel currentProjectId="proj-1" latestMessageId="msg-1" />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('RightContextPanel project section (REQ-STRUCT-030)', () => {
  it('renders placeholder when currentProjectId is null', () => {
    render(<RightContextPanel currentProjectId={null} latestMessageId={null} />);
    expect(screen.getByText('프로젝트를 선택하세요')).toBeDefined();
  });

  it('renders loading placeholder when currentProjectId is non-null', () => {
    render(<RightContextPanel currentProjectId="proj-123" latestMessageId="msg-1" />);
    expect(screen.getByText(/Phase 4/i)).toBeDefined();
  });
});

describe('RightContextPanel sources section (REQ-STRUCT-031)', () => {
  it('renders 5 loading skeleton rows', () => {
    const { container } = render(
      <RightContextPanel currentProjectId={null} latestMessageId="msg-1" />,
    );
    const skeletonRows = container.querySelectorAll('[data-skeleton="source-row"]');
    expect(skeletonRows.length).toBe(5);
  });
});

describe('RightContextPanel updates section (REQ-STRUCT-032)', () => {
  it('renders 3 loading skeleton cards', () => {
    const { container } = render(
      <RightContextPanel currentProjectId={null} latestMessageId={null} />,
    );
    const skeletonCards = container.querySelectorAll('[data-skeleton="update-card"]');
    expect(skeletonCards.length).toBe(3);
  });
});
