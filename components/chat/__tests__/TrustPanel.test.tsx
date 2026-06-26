// @MX:NOTE TrustPanel tests — render, collapse/expand, honest states.
// @MX:SPEC Issue #158

/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ConfidenceEvent, RagRouteEvent, SourceItem } from '../../../types/streaming';
import { TrustPanel } from '../TrustPanel';

describe('TrustPanel', () => {
  const mockConfidence: ConfidenceEvent = {
    type: 'confidence',
    level: 'high',
    score: 0.85,
  };

  const mockLowConfidence: ConfidenceEvent = {
    type: 'confidence',
    level: 'low',
    score: 0.5,
  };

  const mockSources: SourceItem[] = [
    {
      id: '1',
      citeIndex: 1,
      orgLabel: 'FDA',
      title: '21 CFR 820',
      year: 2023,
      type: 'Regulation',
      url: 'https://www.fda.gov',
      anchor: '820.30',
      offset: 120,
    },
    {
      id: '2',
      citeIndex: 2,
      orgLabel: 'Internal',
      title: 'SOP-001',
      year: 2024,
      type: 'Internal',
      url: null,
      anchor: '3.2',
      offset: 450,
    },
  ];

  const mockRagRoute: RagRouteEvent = {
    type: 'rag_route',
    path: 'hybrid',
  };

  it('renders all trust signals', () => {
    // Use low confidence to auto-expand panel
    render(
      <TrustPanel
        confidence={mockLowConfidence}
        sources={mockSources}
        reviewStatus="approved"
        signatureExists={true}
        ragRoute={mockRagRoute}
      />,
    );

    expect(screen.getByText('신뢰 정보')).toBeInTheDocument();
    expect(screen.getByText('신뢰도')).toBeInTheDocument();
    expect(screen.getByText('증거')).toBeInTheDocument();
    expect(screen.getByText('전문가 검토')).toBeInTheDocument();
    expect(screen.getByText('지식 범위')).toBeInTheDocument();
  });

  it('shows source count and provenance breakdown', () => {
    // Use low confidence to auto-expand
    const { container } = render(
      <TrustPanel confidence={mockLowConfidence} sources={mockSources} />,
    );

    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('출처');
    expect(container.textContent).toContain('Regulation 1');
  });

  it('shows approved review status with signature', () => {
    // Use low confidence to auto-expand
    const { container } = render(
      <TrustPanel
        confidence={mockLowConfidence}
        reviewStatus="approved"
        signatureExists={true}
        sources={mockSources}
      />,
    );

    expect(container.textContent).toContain('검토 완료');
    expect(container.textContent).toContain('§11.50 서명');
  });

  it('shows pending review status honestly', () => {
    // Use empty sources to auto-expand
    render(<TrustPanel reviewStatus="pending" sources={[]} />);

    expect(screen.getByText('검토 대기중')).toBeInTheDocument();
    expect(screen.queryByText('검토 완료')).not.toBeInTheDocument();
  });

  it('shows unreviewed status when no review', () => {
    // Use empty sources to auto-expand
    const { container } = render(<TrustPanel reviewStatus="none" sources={[]} />);

    expect(container.textContent).toContain('미검토');
  });

  it('auto-expands when confidence is low', () => {
    const lowConfidence: ConfidenceEvent = {
      type: 'confidence',
      level: 'low',
      score: 0.5,
    };

    const { container } = render(<TrustPanel confidence={lowConfidence} sources={mockSources} />);

    // Should be expanded by default when confidence < 0.7
    expect(container.querySelector('[aria-expanded="true"]')).toBeTruthy();
  });

  it('auto-expands when no sources', () => {
    const { container } = render(<TrustPanel confidence={mockConfidence} sources={[]} />);

    expect(container.querySelector('[aria-expanded="true"]')).toBeTruthy();
  });

  it('collapses and expands on toggle', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TrustPanel confidence={mockConfidence} sources={mockSources} reviewStatus="approved" />,
    );

    const button = screen.getByRole('button', { name: /신뢰 정보/i });

    // Should be collapsed initially (confidence high, sources present)
    expect(container.querySelector('[aria-expanded="false"]')).toBeTruthy();

    // Expand
    await user.click(button);
    expect(container.querySelector('[aria-expanded="true"]')).toBeTruthy();

    // Collapse
    await user.click(button);
    expect(container.querySelector('[aria-expanded="false"]')).toBeTruthy();
  });

  it('renders without crashing when optional props are missing', () => {
    const { container } = render(<TrustPanel />);

    expect(container.textContent).toContain('신뢰 정보');
  });
});
