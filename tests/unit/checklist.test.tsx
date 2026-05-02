// @MX:NOTE Unit tests for Checklist component — REQ-STRUCT-019~020.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checklist } from '../../components/chat/Checklist';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseItems = [
  { id: 'item-1', title: '21 CFR §807.81(a) 요구사항 검토', completed: false },
  { id: 'item-2', title: '기술 파일 준비', ref: '21 CFR §807.81', completed: true },
  { id: 'item-3', title: 'FDA 제출 전 검토', completed: false },
];

describe('Checklist component (REQ-STRUCT-019)', () => {
  it('renders 3 checkboxes for 3 items', () => {
    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);
  });

  it('renders item titles', () => {
    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} />);
    expect(screen.getByText('21 CFR §807.81(a) 요구사항 검토')).toBeDefined();
    expect(screen.getByText('기술 파일 준비')).toBeDefined();
  });

  it('renders ref badge for items with ref', () => {
    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} />);
    expect(screen.getByText('21 CFR §807.81')).toBeDefined();
  });

  it('reflects completed state on checkbox', () => {
    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // item-2 is completed
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    // item-1 is not completed
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
  });

  it('does not render checkboxes when readOnly=true (or disables them)', () => {
    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} readOnly />);
    const checkboxes = screen.getAllByRole('checkbox');
    // In readOnly mode, checkboxes should be disabled
    for (const checkbox of checkboxes) {
      expect((checkbox as HTMLInputElement).disabled).toBe(true);
    }
  });
});

describe('Checklist optimistic update (REQ-STRUCT-020)', () => {
  it('toggles checkbox optimistically on click', async () => {
    // Mock fetch to prevent actual network call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);

    render(<Checklist blockId="block-1" messageId="msg-1" items={baseItems} />);

    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0] as HTMLInputElement;
    expect(firstCheckbox.checked).toBe(false);

    fireEvent.click(firstCheckbox);

    // After click, optimistic update should have toggled the checkbox
    expect(firstCheckbox.checked).toBe(true);
  });
});
