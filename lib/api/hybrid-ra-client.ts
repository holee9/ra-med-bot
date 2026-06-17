/**
 * hybrid-ra-saas Evidence API Client
 *
 * Typed client for hybrid-ra-saas backend integration.
 * Implements Bearer authentication with HYBRID_RA_API_TOKEN
 * and automatic X-Tenant-ID header injection.
 *
 * @see https://github.com/holee9/hybrid-ra-saas/blob/feat/spec-apitok-001-bearer-auth/docs/integration-contract.md
 */

interface EvidenceLinkRequest {
  req_id: string;
  requirement_text: string;
  evidence_sources: Array<{
    source_type: 'regulation' | 'standard' | 'guidance' | 'internal';
    source_id: string;
    title: string;
    url?: string;
  }>;
}

interface EvidenceLink {
  id: string;
  req_id: string;
  requirement_text: string;
  evidence_sources: Array<{
    source_type: string;
    source_id: string;
    title: string;
    url?: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface EvidenceLinksResponse {
  req_id: string;
  links: EvidenceLink[];
  total: number;
}

interface EvidenceBinderRequest {
  name: string;
  description?: string;
  req_ids: string[];
  template_type?: 'regulatory' | 'technical' | 'quality';
}

interface EvidenceBinder {
  id: string;
  name: string;
  description?: string;
  req_ids: string[];
  template_type: string;
  created_at: string;
  status: 'draft' | 'complete' | 'archived';
}

interface ApiError {
  error: string;
  message: string;
  status: number;
}

/**
 * Evidence API client class
 */
export class HybridRaClient {
  private baseUrl: string;
  private apiToken: string;
  private tenantId: string;

  constructor() {
    this.baseUrl = process.env.HYBRID_RA_BASE_URL || 'http://localhost:8000';
    this.apiToken = process.env.HYBRID_RA_API_TOKEN || '';
    this.tenantId = process.env.TENANT_ID || 'default';

    if (!this.apiToken) {
      console.warn('[HybridRaClient] HYBRID_RA_API_TOKEN not set');
    }
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
      'X-Tenant-ID': this.tenantId,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error: ApiError = {
          error: 'API_ERROR',
          message: `API request failed: ${response.statusText}`,
          status: response.status,
        };

        // Handle specific error cases
        if (response.status === 401) {
          error.message = '인증이 실패했습니다. API 토큰을 확인해주세요.';
        } else if (response.status === 503) {
          error.message = '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
        }

        throw error;
      }

      return await response.json();
    } catch (error) {
      // Network or other errors
      if (error instanceof Error) {
        throw {
          error: 'NETWORK_ERROR',
          message: error.message,
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }

  /**
   * POST /api/v1/evidence/link
   * Create requirement-evidence link
   */
  async createEvidenceLink(request: EvidenceLinkRequest): Promise<EvidenceLink> {
    return this.request<EvidenceLink>('/api/v1/evidence/link', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * GET /api/v1/evidence/links/{req_id}
   * Get all evidence links for a requirement
   */
  async getEvidenceLinks(reqId: string): Promise<EvidenceLinksResponse> {
    return this.request<EvidenceLinksResponse>(`/api/v1/evidence/links/${reqId}`);
  }

  /**
   * POST /api/v1/evidence/binder
   * Create evidence binder
   */
  async createEvidenceBinder(request: EvidenceBinderRequest): Promise<EvidenceBinder> {
    return this.request<EvidenceBinder>('/api/v1/evidence/binder', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// Export singleton instance
export const hybridRaClient = new HybridRaClient();
