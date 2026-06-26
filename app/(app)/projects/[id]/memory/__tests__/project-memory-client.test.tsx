// @MX:NOTE Component test for ProjectMemoryClient — SPEC-REGULA-PROJECT-MEMORY-001 (REQ-005, REQ-006, REQ-013, REQ-014, AC-04).
// @vitest-environment jsdom
//
// Covers:
// - RBAC UI gating: ra-lead sees Create/Edit/Invalidate/Approve; ra-member sees read-only.
// - Charter [지양-4] / REQ-005: pending AI suggestions show a clear "review required"
//   state with an explicit Approve action (NO auto-apply, NO bulk approve).
// - REQ-013: sourceConversation link present when sourceConversationId is set.
// - REQ-012: same-key supersession via PATCH (invalidate old + create new).
// - Empty-state for zero memories / zero pending.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectMemoryClient from '../ProjectMemoryClient';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const PROJECT_ID = '00000000-0000-0000-0000-0000000000a1';
const CONV_ID = '00000000-0000-0000-0000-0000000000c1';

const ACTIVE_MEMORIES = {
  memories: [
    {
      id: 'mem-1',
      memoryType: 'device_classification',
      key: 'device_class',
      value: 'Class IIa',
      createdAt: '2026-06-10T03:00:00.000Z',
    },
    {
      id: 'mem-2',
      memoryType: 'target_markets',
      key: 'target_markets',
      value: 'KR, US, EU',
      createdAt: '2026-06-12T03:00:00.000Z',
    },
  ],
};

const PENDING_SUGGESTIONS = {
  suggestions: [
    {
      id: 'sug-1',
      memoryType: 'risk_class',
      key: 'risk_class',
      value: 'Class IIa (제안됨)',
      sourceConversationId: CONV_ID,
      createdAt: '2026-06-20T03:00:00.000Z',
    },
  ],
};

function mockRoutes(active = ACTIVE_MEMORIES, pending = PENDING_SUGGESTIONS) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : ((input as Request).url ?? '');
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.startsWith('/api/project-memory/suggest/approve')) {
      return new Response(JSON.stringify({ id: 'sug-1', status: 'active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('/api/project-memory/suggest')) {
      return new Response(JSON.stringify(pending), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('/api/project-memory/') && method === 'DELETE') {
      return new Response(JSON.stringify({ invalidatedId: 'mem-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('/api/project-memory/') && method === 'PATCH') {
      return new Response(JSON.stringify({ invalidatedId: 'mem-1', newId: 'mem-3' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('/api/project-memory') && method === 'POST') {
      return new Response(JSON.stringify({ id: 'mem-new', status: 'active' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.startsWith('/api/project-memory')) {
      return new Response(JSON.stringify(active), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  });
}

describe('ProjectMemoryClient RBAC gating (REQ-006, AC-04)', () => {
  beforeEach(() => {
    mockRoutes();
  });

  it('shows Create button for ra-lead', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('memory-create-open')).toBeDefined();
    });
  });

  it('shows Create button for admin', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="admin" />);
    await waitFor(() => {
      expect(screen.getByTestId('memory-create-open')).toBeDefined();
    });
  });

  it('hides Create/Edit/Invalidate/Approve for ra-member (read-only)', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-member" />);
    await waitFor(() => {
      expect(screen.queryByTestId('memory-create-open')).toBeNull();
    });
    // Active memories still render (read-only view).
    expect(screen.queryByTestId('memory-edit')).toBeNull();
    expect(screen.queryByTestId('memory-invalidate')).toBeNull();
  });
});

describe('Active memory list (REQ-006, AC-01)', () => {
  beforeEach(() => {
    mockRoutes();
  });

  it('groups memories by memoryType', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-member" />);
    await waitFor(() => {
      // Filter chip + group heading both render the label — multiple is expected.
      expect(screen.getAllByText('디바이스 분류').length).toBeGreaterThan(0);
      expect(screen.getAllByText('목표 시장').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('KR, US, EU')).toBeDefined();
    expect(screen.getAllByTestId('memory-card').length).toBeGreaterThanOrEqual(2);
  });

  it('filters by memoryType chip', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-member" />);
    await waitFor(() => {
      expect(screen.getByText('Class IIa')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('filter-device_classification'));
    await waitFor(() => {
      expect(screen.getByText('Class IIa')).toBeDefined();
      expect(screen.queryByText('KR, US, EU')).toBeNull();
    });
  });
});

describe('Pending AI suggestions (Charter [지양-4], REQ-005, REQ-014)', () => {
  beforeEach(() => {
    mockRoutes();
  });

  it('renders pending section with explicit "검토 필요" state for ra-lead', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('pending-section')).toBeDefined();
    });
    // REQ-005: clear "AI suggested — review required" marker.
    expect(screen.getByTestId('pending-review-required')).toBeDefined();
    expect(screen.getByTestId('pending-approve')).toBeDefined();
  });

  it('shows sourceConversation provenance link for pending suggestion (REQ-013)', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('pending-source-link')).toBeDefined();
    });
  });

  it('does NOT render a bulk "approve all" button (Charter [지양-4] per-item review)', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('pending-section')).toBeDefined();
    });
    expect(screen.queryByTestId('pending-approve-all')).toBeNull();
  });

  it('hides the Approve button for ra-member', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-member" />);
    await waitFor(() => {
      expect(screen.queryByTestId('pending-approve')).toBeNull();
    });
    // Pending section still visible (read-only review queue).
    expect(screen.getByTestId('pending-section')).toBeDefined();
  });

  it('calls POST /api/project-memory/suggest/approve on Approve click (REQ-014)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('pending-approve')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('pending-approve'));
    await waitFor(() => {
      const approveCall = fetchSpy.mock.calls.find(
        ([url, init]) =>
          typeof url === 'string' &&
          url.startsWith('/api/project-memory/suggest/approve') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(approveCall).toBeDefined();
    });
  });
});

describe('Create flow (REQ-007, ra-lead only)', () => {
  beforeEach(() => {
    mockRoutes();
  });

  it('opens create dialog and submits POST with memoryType/key/value', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getByTestId('memory-create-open')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('memory-create-open'));
    expect(screen.getByTestId('memory-dialog')).toBeDefined();

    fireEvent.change(screen.getByTestId('memory-key'), { target: { value: 'predicate' } });
    fireEvent.change(screen.getByTestId('memory-value'), { target: { value: 'Predicate ABC' } });
    fireEvent.click(screen.getByTestId('memory-submit'));

    await waitFor(() => {
      const postCall = fetchSpy.mock.calls.find(
        ([url, init]) =>
          typeof url === 'string' &&
          url === '/api/project-memory' &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      if (!postCall) throw new Error('POST call not captured');
      const body = JSON.parse((postCall[1] as RequestInit).body as string);
      expect(body.projectId).toBe(PROJECT_ID);
      expect(body.key).toBe('predicate');
      expect(body.value).toBe('Predicate ABC');
    });
  });
});

describe('Edit + Invalidate (REQ-008, REQ-009, REQ-012, ra-lead only)', () => {
  beforeEach(() => {
    mockRoutes();
  });

  it('PATCHes on edit submit (REQ-012 supersession)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getAllByTestId('memory-edit').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByTestId('memory-edit')[0] as HTMLElement);
    fireEvent.change(screen.getByTestId('memory-value'), {
      target: { value: 'Class IIb (수정)' },
    });
    fireEvent.click(screen.getByTestId('memory-submit'));

    await waitFor(() => {
      const patchCall = fetchSpy.mock.calls.find(
        ([url, init]) =>
          typeof url === 'string' &&
          url.startsWith('/api/project-memory/') &&
          (init as RequestInit | undefined)?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
    });
  });

  it('DELETEs on invalidate click (REQ-009 soft-invalidate)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.getAllByTestId('memory-invalidate').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByTestId('memory-invalidate')[0] as HTMLElement);

    await waitFor(() => {
      const deleteCall = fetchSpy.mock.calls.find(
        ([url, init]) =>
          typeof url === 'string' &&
          url.startsWith('/api/project-memory/') &&
          (init as RequestInit | undefined)?.method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
    });
  });
});

describe('Empty state', () => {
  beforeEach(() => {
    mockRoutes({ memories: [] }, { suggestions: [] });
  });

  it('shows empty-state message when no memories and no suggestions', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-member" />);
    await waitFor(() => {
      expect(screen.getByTestId('memory-empty')).toBeDefined();
    });
  });

  it('hides pending section when no suggestions', async () => {
    render(<ProjectMemoryClient projectId={PROJECT_ID} viewerRole="ra-lead" />);
    await waitFor(() => {
      expect(screen.queryByTestId('pending-section')).toBeNull();
    });
  });
});
