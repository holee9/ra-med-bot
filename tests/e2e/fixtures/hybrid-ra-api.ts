/**
 * MSW Fixtures for Evidence API Contract Testing
 *
 * Mock responses for hybrid-ra-saas Evidence API endpoints.
 * Used for contract testing and development without backend dependency.
 *
 * @see Evidence API Integration Issue #168
 */

import { http, HttpResponse } from 'msw';

// Base URL for hybrid-ra-saas
const BASE_URL = process.env.HYBRID_RA_BASE_URL || 'http://localhost:8000';

/**
 * Mock POST /api/v1/evidence/link
 * Creates a new evidence link
 */
export const mockCreateEvidenceLink = http.post(
  `${BASE_URL}/api/v1/evidence/link`,
  async ({ request }) => {
    const body = await request.json();

    // Validate request structure
    if (
      !body ||
      typeof body !== 'object' ||
      !('req_id' in body) ||
      !('requirement_text' in body) ||
      !('evidence_sources' in body)
    ) {
      return HttpResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid request structure' },
        { status: 400 }
      );
    }

    // Return mock response
    return HttpResponse.json({
      id: `LINK-${Date.now()}`,
      req_id: body.req_id,
      requirement_text: body.requirement_text,
      evidence_sources: body.evidence_sources,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
);

/**
 * Mock GET /api/v1/evidence/links/:reqId
 * Returns evidence links for a requirement
 */
export const mockGetEvidenceLinks = http.get(
  `${BASE_URL}/api/v1/evidence/links/:reqId`,
  ({ params }) => {
    const reqId = params.reqId;

    // Return mock response with sample data
    return HttpResponse.json({
      req_id: reqId,
      total: 2,
      links: [
        {
          id: 'LINK-001',
          req_id: reqId,
          requirement_text: 'Sample requirement for evidence tracking',
          evidence_sources: [
            {
              source_type: 'regulation',
              source_id: 'REG-001',
              title: '의료기기법',
              url: 'https://example.com/medical-device-act',
            },
            {
              source_type: 'standard',
              source_id: 'STD-001',
              title: 'ISO 13485',
              url: 'https://example.com/iso-13485',
            },
          ],
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z',
        },
        {
          id: 'LINK-002',
          req_id: reqId,
          requirement_text: 'Clinical evaluation requirements',
          evidence_sources: [
            {
              source_type: 'guidance',
              source_id: 'GUIDE-001',
              title: 'MEDDEV 2.7.1',
              url: 'https://example.com/meddev-2-7-1',
            },
          ],
          created_at: '2024-01-16T14:20:00Z',
          updated_at: '2024-01-16T14:20:00Z',
        },
      ],
    });
  }
);

/**
 * Mock POST /api/v1/evidence/binder
 * Creates a new evidence binder
 */
export const mockCreateEvidenceBinder = http.post(
  `${BASE_URL}/api/v1/evidence/binder`,
  async ({ request }) => {
    const body = await request.json();

    // Validate request structure
    if (
      !body ||
      typeof body !== 'object' ||
      !('name' in body) ||
      !('req_ids' in body)
    ) {
      return HttpResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid request structure' },
        { status: 400 }
      );
    }

    // Return mock response
    return HttpResponse.json({
      id: `BINDER-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      req_ids: body.req_ids,
      template_type: body.template_type || 'regulatory',
      created_at: new Date().toISOString(),
      status: 'draft',
    });
  }
);

/**
 * Mock 401 Unauthorized response
 */
export const mockUnauthorized = () =>
  HttpResponse.json(
    {
      error: 'UNAUTHORIZED',
      message: '인증이 실패했습니다. API 토큰을 확인해주세요.',
    },
    { status: 401 }
  );

/**
 * Mock 503 Service Unavailable response
 */
export const mockServiceUnavailable = () =>
  HttpResponse.json(
    {
      error: 'SERVICE_UNAVAILABLE',
      message: '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
    },
    { status: 503 }
  );

/**
 * Combined handlers for MSW setup
 */
export const hybridRaApiHandlers = [
  mockCreateEvidenceLink,
  mockGetEvidenceLinks,
  mockCreateEvidenceBinder,
];
