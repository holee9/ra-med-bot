// @MX:NOTE [AUTO] RTL tests for StandardsClient — SPEC-REGULA-STANDARDS-001 (Issue #62).
// Covers: (a) form submit → POST /api/standards/applicability → list grouped by body
// with citation provenance (Charter [지양-2]); (b) FDA recognition check → recognized
// badge (AC-06); (c) withdrawn → amber warning + alternative suggestion (REQ-016);
// (d) transition D-6 badge (AC-05); (e) gap tab empty state; (f) decision-support banner
// (Charter [지양-4]). Mirrors promote-button / project-memory-client test patterns.
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StandardsClient } from '../../../../app/(app)/workflows/standards/_components/StandardsClient';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// @vitest-environment jsdom — RTL needs a DOM. Fetch is mocked per-test.

const ISO_STANDARD = {
  standardNumber: 'ISO 14971:2019',
  title: 'Medical devices — Application of risk management to medical devices',
  body: 'ISO',
  version: '2019',
  isMandatory: true,
  applicabilityReason: '모든 의료기기에 위험관리 필수',
  fdaRecognized: true,
  euHarmonized: true,
  catalogRowId: '00000000-0000-0000-0000-0000000000a1',
  source: 'catalog' as const,
  catalogVersion: '2019',
  catalogBody: 'ISO',
};

const IEC_STANDARD = {
  standardNumber: 'IEC 62304:2006/AMD1:2015',
  title: 'Medical device software — Software life cycle processes',
  body: 'IEC',
  version: '2015',
  isMandatory: true,
  applicabilityReason: '소프트웨어 포함 기기',
  fdaRecognized: true,
  euHarmonized: true,
  catalogRowId: '00000000-0000-0000-0000-0000000000a2',
  source: 'catalog' as const,
  catalogVersion: '2015',
  catalogBody: 'IEC',
};

const APPLICABILITY_RESPONSE = {
  results: [ISO_STANDARD, IEC_STANDARD],
  deviceProfileKey: 'electrical_medical_device|fda_510k',
  durationMs: 42,
};

function mockFetch(routes: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    for (const [key, body] of Object.entries(routes)) {
      if (url.includes(key)) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
    }
    // Default: 404 for unmapped routes (e.g. /updates not yet implemented).
    return Promise.resolve(new Response('Not Found', { status: 404 }));
  });
}

async function submitForm() {
  fireEvent.click(screen.getByTestId('standards-submit'));
  await waitFor(() => {
    expect(screen.getByTestId('standards-results')).toBeDefined();
  });
}

describe('StandardsClient — decision-support banner (Charter [지양-4])', () => {
  it('renders the RA Lead review banner', () => {
    render(<StandardsClient />);
    expect(screen.getByTestId('standards-decision-support-banner')).toBeDefined();
    expect(screen.getByText(/RA Lead 검토용 제안/)).toBeDefined();
  });
});

describe('StandardsClient — mapping (REQ-001, AC-03, Charter [지양-2])', () => {
  beforeEach(() => {
    mockFetch({ '/api/standards/applicability': APPLICABILITY_RESPONSE });
  });

  it('POSTs the device profile and renders results grouped by body', async () => {
    render(<StandardsClient />);
    await submitForm();

    // Group headings appear (ISO, IEC).
    expect(screen.getByTestId('standards-body-ISO')).toBeDefined();
    expect(screen.getByTestId('standards-body-IEC')).toBeDefined();
    // Both standard cards render.
    expect(screen.getByTestId('standard-card-ISO 14971:2019')).toBeDefined();
    expect(screen.getByTestId('standard-card-IEC 62304:2006/AMD1:2015')).toBeDefined();
  });

  it('shows citation provenance for every standard ([지양-2], REQ-021)', async () => {
    render(<StandardsClient />);
    await submitForm();

    const provenance = screen.getByTestId('standard-provenance-ISO 14971:2019');
    expect(provenance).toBeDefined();
    expect(provenance.textContent).toContain('카탈로그');
    expect(provenance.textContent).toContain('2019');
  });

  it('shows "no active alerts" when no transition data is present', async () => {
    render(<StandardsClient />);
    await submitForm();
    expect(screen.getByText(/현재 활성 전환 알림이 없습니다/)).toBeDefined();
  });

  it('posts the form body with deviceProfile wrapper', async () => {
    const fetchSpy = mockFetch({ '/api/standards/applicability': APPLICABILITY_RESPONSE });
    render(<StandardsClient />);
    fireEvent.click(screen.getByTestId('standards-submit'));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const call = fetchSpy.mock.calls[0];
    expect(call).toBeDefined();
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body.deviceProfile).toBeDefined();
    expect(body.deviceProfile.deviceTypeKey).toBeDefined();
    expect(body.deviceProfile.regulatoryPathway).toBeDefined();
  });
});

describe('StandardsClient — FDA recognition check (AC-06, REQ-015/016)', () => {
  it('shows recognized badge after a successful FDA check', async () => {
    mockFetch({
      '/api/standards/applicability': APPLICABILITY_RESPONSE,
      '/api/standards/check': {
        standardId: ISO_STANDARD.catalogRowId,
        status: 'recognized',
        degraded: false,
        note: 'Currently recognized by FDA.',
      },
    });
    render(<StandardsClient />);
    await submitForm();

    fireEvent.click(screen.getByTestId('standard-check-ISO 14971:2019'));
    await waitFor(() => {
      const badge = screen.getByTestId('standard-recognition-ISO 14971:2019');
      expect(badge.textContent).toContain('FDA 인정');
    });
  });

  it('shows withdrawn warning + alternative suggestion (REQ-016)', async () => {
    mockFetch({
      '/api/standards/applicability': APPLICABILITY_RESPONSE,
      '/api/standards/check': {
        standardId: ISO_STANDARD.catalogRowId,
        status: 'withdrawn',
        degraded: false,
        alternativeStandardId: '00000000-0000-0000-0000-0000000000b1',
        alternativeStandardNumber: 'ISO 14971:2024',
        note: 'Withdrawn. Alternative suggested: ISO 14971:2024.',
      },
    });
    render(<StandardsClient />);
    await submitForm();

    fireEvent.click(screen.getByTestId('standard-check-ISO 14971:2019'));
    await waitFor(() => {
      expect(screen.getByTestId('standard-alternative-ISO 14971:2019')).toBeDefined();
    });
    expect(screen.getByTestId('standard-alternative-ISO 14971:2019').textContent).toContain(
      'ISO 14971:2024',
    );
    const badge = screen.getByTestId('standard-recognition-ISO 14971:2019');
    expect(badge.textContent).toContain('철회');
  });
});

describe('StandardsClient — transition alerts (AC-05, REQ-012)', () => {
  it('renders D-6 tier badge when an active transition row exists', async () => {
    mockFetch({
      '/api/standards/applicability': APPLICABILITY_RESPONSE,
      '/api/standards/00000000-0000-0000-0000-0000000000a1/updates': {
        items: [
          {
            id: 'upd-1',
            revisionLabel: 'ISO 14971:2024',
            ojPublicationDate: '2024-03-01',
            dateOfWithdrawal: '2027-03-01',
            transitionEndDate: '2027-03-01',
            alertTier: 'warn',
          },
        ],
      },
    });
    render(<StandardsClient />);
    await submitForm();

    await waitFor(() => {
      expect(screen.getByTestId('standard-alert-ISO 14971:2019-warn')).toBeDefined();
    });
    expect(screen.getByTestId('standard-alert-ISO 14971:2019-warn').textContent).toContain('D-6');
  });
});

describe('StandardsClient — gap analysis tab (REQ-013)', () => {
  beforeEach(() => {
    mockFetch({ '/api/standards/applicability': APPLICABILITY_RESPONSE });
  });

  it('renders the gap tab empty state before any analysis is loaded', async () => {
    render(<StandardsClient />);
    await submitForm();

    fireEvent.click(screen.getByTestId('standards-tab-gap'));
    expect(screen.getByTestId('gap-empty')).toBeDefined();
  });
});
