// @MX:NOTE Unit tests for PromoteButton — SPEC-REGULA-KNOWLEDGE-PROMO-001 (REQ-004, REQ-007, AC-02, AC-03).
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoteButton } from '../promote-button';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const MSG_ID = '00000000-0000-0000-0000-000000000001';

function mockFetchOk(body: unknown = { promotedId: 'pa-1' }, status = 201) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('PromoteButton RBAC (REQ-007, AC-03)', () => {
  it('renders the promote button for ra-lead', () => {
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);
    expect(screen.getByTestId('promote-open')).toBeDefined();
  });

  it('renders the promote button for admin', () => {
    render(<PromoteButton messageId={MSG_ID} viewerRole="admin" />);
    expect(screen.getByTestId('promote-open')).toBeDefined();
  });

  it('renders NOTHING for ra-member (no disabled affordance leaking the action)', () => {
    const { container } = render(<PromoteButton messageId={MSG_ID} viewerRole="ra-member" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('promote-button')).toBeNull();
    expect(screen.queryByTestId('promote-open')).toBeNull();
  });

  it('renders nothing when viewerRole is absent', () => {
    const { container } = render(<PromoteButton messageId={MSG_ID} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PromoteButton promote flow (REQ-004, AC-02)', () => {
  beforeEach(() => {
    mockFetchOk();
  });

  it('opens the dialog on click and focuses the title input', () => {
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);
    fireEvent.click(screen.getByTestId('promote-open'));
    expect(screen.getByTestId('promote-dialog')).toBeDefined();
    expect(screen.getByTestId('promote-title')).toBeDefined();
    // First focusable should be the title input (focus trap seeding).
    expect(document.activeElement).toBe(screen.getByTestId('promote-title'));
  });

  it('submits POST with messageId/title/tags on promote', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);

    fireEvent.click(screen.getByTestId('promote-open'));
    fireEvent.change(screen.getByTestId('promote-title'), {
      target: { value: '510(k) 체크리스트' },
    });
    fireEvent.change(screen.getByTestId('promote-tag-input'), {
      target: { value: '510k' },
    });
    fireEvent.click(screen.getByTestId('promote-tag-add'));
    fireEvent.click(screen.getByTestId('promote-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('promote-dialog')).toBeNull();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call?.[0]).toBe('/api/knowledge-promo/promote');
    const init = call?.[1];
    const body = JSON.parse(init?.body as string);
    expect(body.messageId).toBe(MSG_ID);
    expect(body.title).toBe('510(k) 체크리스트');
    expect(body.tags).toEqual(['510k']);
    expect(body.scope).toBe('message');
    expect(init?.method).toBe('POST');
  });

  it('blocks submit when title is empty (client validation)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);
    fireEvent.click(screen.getByTestId('promote-open'));
    // Submit button is disabled when title is empty.
    expect(screen.getByTestId('promote-submit').hasAttribute('disabled')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('PromoteButton unpromote flow (REQ-014)', () => {
  it('renders the active state when promotedId is provided', () => {
    render(
      <PromoteButton
        messageId={MSG_ID}
        viewerRole="ra-lead"
        promotedId="pa-existing"
        sourceHref={`/chat/${MSG_ID}`}
      />,
    );
    expect(screen.queryByTestId('promote-open')).toBeNull();
    expect(screen.getByTestId('promote-unpromote')).toBeDefined();
    expect(screen.getByTestId('promote-source-link')).toBeDefined();
  });

  it('calls DELETE on unpromote', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, promotedId: 'pa-existing' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" promotedId="pa-existing" />);
    fireEvent.click(screen.getByTestId('promote-unpromote'));
    await waitFor(() => {
      expect(screen.getByTestId('promote-open')).toBeDefined();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call?.[0]).toBe('/api/knowledge-promo/promote/pa-existing');
    expect(call?.[1]?.method).toBe('DELETE');
  });
});

describe('PromoteButton error handling (AC-03)', () => {
  it('surfaces a 403-specific message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);
    fireEvent.click(screen.getByTestId('promote-open'));
    fireEvent.change(screen.getByTestId('promote-title'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByTestId('promote-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('promote-error')).toBeDefined();
    });
    expect(screen.getByTestId('promote-error').textContent).toContain('권한');
  });

  it('surfaces a generic message on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'promote_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(<PromoteButton messageId={MSG_ID} viewerRole="ra-lead" />);
    fireEvent.click(screen.getByTestId('promote-open'));
    fireEvent.change(screen.getByTestId('promote-title'), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByTestId('promote-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('promote-error')).toBeDefined();
    });
  });
});

describe('PromoteButton provenance link (REQ-011)', () => {
  it('renders source link in the active (promoted) state', () => {
    render(
      <PromoteButton
        messageId={MSG_ID}
        viewerRole="ra-lead"
        promotedId="pa-1"
        sourceHref={`/chat/abc#msg-${MSG_ID}`}
      />,
    );
    const link = screen.getByTestId('promote-source-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(`/chat/abc#msg-${MSG_ID}`);
  });
});
