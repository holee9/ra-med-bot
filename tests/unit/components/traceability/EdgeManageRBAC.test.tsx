// @MX:NOTE RBAC test for EdgeManage — SPEC-REGULA-TRACEABILITY-001 (REQ-010, Issue #47).
// Verifies the manage controls are NOT rendered for non-ra-lead (the component
// returns null — never a button that 403s on click).
/** @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/traceability/client', () => ({
  EDGE_RELATIONS: ['derived_from', 'cites', 'reviewed_by', 'exported_in', 'mitigates', 'satisfies'],
  writeEdge: vi.fn(async () => ({ created: true })),
}));

import { EdgeManage } from '../../../../components/traceability/EdgeManage';

afterEach(() => cleanup());

describe('EdgeManage RBAC gating (REQ-010)', () => {
  it('renders the edge manage form for ra-lead (canManage=true)', () => {
    render(<EdgeManage fromNodeId="00000000-0000-0000-0000-000000000001" canManage />);
    expect(screen.getByLabelText('근거 연결 관리')).toBeTruthy();
    expect(screen.getByLabelText('대상 노드 UUID')).toBeTruthy();
  });

  it('renders nothing for ra-member (canManage=false) — no button that 403s', () => {
    const { container } = render(
      <EdgeManage fromNodeId="00000000-0000-0000-0000-000000000001" canManage={false} />,
    );
    // The whole control is hidden — no form, no button.
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByLabelText('근거 연결 관리')).toBeNull();
    expect(screen.queryByText('연결 생성')).toBeNull();
  });

  it('renders nothing by default (omitted prop = least-privileged)', () => {
    const { container } = render(<EdgeManage fromNodeId="00000000-0000-0000-0000-000000000001" />);
    expect(container.querySelector('form')).toBeNull();
  });
});
