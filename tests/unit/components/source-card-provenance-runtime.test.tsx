/** @vitest-environment jsdom */

// @MX:NOTE [AUTO] C-2 runtime test — SourceCard null-coalesces provenance fields.
// @MX:SPEC SPEC-REGULA-INTEGRATION-001 (REQ-INTEGRATION-001)
//
// Anti-pattern addressed (L-006): tests/unit/provenance.test.ts is source-text
// regex assertions only — it cannot catch a runtime crash when provenance is
// absent. External citations (FDA, EUDAMED) legitimately have undefined
// sourceHost/sourceOwner/sourceRepo/sourceRef/sourcePath. The SourceCard
// null-coalesces these; this test exercises that path for real.
//
// Strategy: render SourceCard with a SourceItem whose provenance fields are
// all undefined/absent (simulating an external citation). Assert:
//   1. No crash (render succeeds).
//   2. The provenance row is hidden (data-testid="citation-provenance" absent).
//   3. The remaining metadata (title, type pill, orgLabel) still renders.

import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useDocViewer is a client hook; stub it so the test never touches routing.
vi.mock('../../hooks/useDocViewer', () => ({
  useDocViewer: () => ({ open: vi.fn() }),
}));

import { SourceCard } from '../../../components/chat/SourceCard';
import type { SourceItem } from '../../../types/streaming';

// A fully-populated internal-SOP source with Git provenance — baseline.
const INTERNAL_SOURCE: SourceItem = {
  id: 'src-internal-1',
  citeIndex: 1,
  orgLabel: 'Acme Internal',
  title: 'Device Quality SOP',
  year: 2025,
  type: 'Internal',
  url: null,
  anchor: '§3.2',
  offset: 1024,
  sourceHost: 'git.internal',
  sourceOwner: 'acme',
  sourceRepo: 'sops',
  sourceRef: 'abcdef1234',
  sourcePath: 'docs/sop.md',
};

// An external citation (FDA/EUDAMED) — provenance fields are undefined.
// This is the case the regex tests in provenance.test.ts cannot exercise.
const EXTERNAL_SOURCE: SourceItem = {
  id: 'src-fda-1',
  citeIndex: 2,
  orgLabel: 'FDA',
  title: '510(k) Guidance',
  year: 2024,
  type: 'Guidance',
  url: 'https://www.fda.gov/example',
  anchor: '',
  offset: 0,
  // All Git provenance fields intentionally absent.
  sourceHost: undefined,
  sourceOwner: undefined,
  sourceRepo: undefined,
  sourceRef: undefined,
  sourcePath: undefined,
};

describe('SourceCard — provenance null-coalescing (C-2 runtime, REQ-INTEGRATION-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the provenance row when Git provenance is present (baseline)', () => {
    render(<SourceCard source={INTERNAL_SOURCE} />);
    const provenance = screen.queryByTestId('citation-provenance');
    expect(provenance).not.toBeNull();
    expect(provenance?.textContent).toContain('acme/sops');
    expect(provenance?.textContent).toContain('@abcdef12');
    expect(provenance?.textContent).toContain(':docs/sop.md');
  });

  it('does NOT crash and hides the provenance row when provenance is absent (external citation)', () => {
    // No throw — render returns without error.
    const { container } = render(<SourceCard source={EXTERNAL_SOURCE} />);

    // Provenance row must be hidden.
    expect(screen.queryByTestId('citation-provenance')).toBeNull();

    // Core metadata still renders.
    expect(screen.getByText('510(k) Guidance')).toBeTruthy();
    expect(screen.getByText('FDA')).toBeTruthy();
    expect(screen.getByText('Guidance')).toBeTruthy();

    // No unguarded access leaked into the DOM as "undefined" / "null" strings.
    const text = container.textContent ?? '';
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
    expect(text).not.toContain('@/undefined');
    expect(text).not.toContain(':undefined');
  });

  it('handles a partially-populated provenance (only sourceHost) without crashing', () => {
    const partial: SourceItem = {
      ...EXTERNAL_SOURCE,
      sourceHost: 'www.fda.gov',
      // repo/owner/ref/path still undefined
    };
    const { container } = render(<SourceCard source={partial} />);

    // Provenance row shows because sourceHost is set.
    const provenance = screen.queryByTestId('citation-provenance');
    expect(provenance).not.toBeNull();
    // Falls back to sourceHost when repo/owner/ref/path are absent.
    expect(provenance?.textContent).toContain('www.fda.gov');

    // No leaked undefined/null strings.
    const text = container.textContent ?? '';
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});
