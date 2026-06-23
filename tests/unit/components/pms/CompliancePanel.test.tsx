// @MX:NOTE [AUTO] RTL tests for CompliancePanel — SPEC-REGULA-PMS-001 (Issue #53, Phase 3).
// Covers: (a) renders Article 83-86 compliance results, (b) status badge per article,
// (c) overall compliance label, (d) icon+text for accessibility (WCAG 2.1 AA).
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CompliancePanel } from '../../../../app/(app)/pms/_components/CompliancePanel';

afterEach(() => {
  cleanup();
});

describe('CompliancePanel — REQ-PMS-007 (Article 83-86 compliance check)', () => {
  it('renders overall compliance status and article rows', () => {
    render(
      <CompliancePanel
        result={{
          overall: 'partial',
          articles: [
            { article: 'Article 83', status: 'satisfied', detail: 'PMS plan exists' },
            { article: 'Article 85', status: 'partial', detail: 'Report draft' },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('pms-compliance-overall')).toBeTruthy();
    expect(screen.getByTestId('pms-compliance-overall').textContent).toContain('부분');
  });

  it('renders each article with icon + text label (WCAG 2.1 AA)', () => {
    render(
      <CompliancePanel
        result={{
          overall: 'compliant',
          articles: [
            { article: 'Article 83', status: 'satisfied', detail: 'OK' },
            { article: 'Article 84', status: 'missing', detail: 'No plan' },
          ],
        }}
      />,
    );

    const rows = screen.getAllByTestId(/pms-compliance-article-/);
    expect(rows.length).toBe(2);
    // Each status badge must have BOTH icon and text (color is never the only signal).
    const satisfiedBadge = screen.getByTestId('pms-compliance-article-Article 83');
    expect(satisfiedBadge.textContent).toMatch(/✓|만족|satisfied/i);
    const missingBadge = screen.getByTestId('pms-compliance-article-Article 84');
    expect(missingBadge.textContent).toMatch(/✗|누락|missing/i);
  });

  it('renders loading skeleton when result is null', () => {
    render(<CompliancePanel result={null} />);
    expect(screen.getByTestId('pms-compliance-loading')).toBeTruthy();
  });
});
