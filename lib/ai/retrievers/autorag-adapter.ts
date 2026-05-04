// @MX:NOTE [AUTO] AutoRAG adapter — wraps Workers AI AutoRAG API as an IRetriever.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-023, REQ-CF-024, REQ-CF-029)
//
// HIPAA BAA guard (REQ-CF-029): HIPAA_BAA_CONFIRMED env flag must be "true"
// before any AutoRAG call is executed. Pending Item #1.

import { HIPAABAAScopeError } from '../hybrid-router';
import type { IRetriever, RetrievalResult, RetrieverOptions } from './types';

// Minimal type for the Workers AI AutoRAG search response
interface AutoRAGSearchResult {
  id: string;
  score: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

interface AutoRAGSearchResponse {
  results: AutoRAGSearchResult[];
}

// Minimal env shape needed by AutoRAGRetriever
interface AutoRAGEnv {
  AI: {
    autorag: (instanceName: string) => {
      aiSearch: (opts: {
        query: string;
        max_num_results?: number;
      }) => Promise<AutoRAGSearchResponse>;
    };
  };
  HIPAA_BAA_CONFIRMED: string;
}

/**
 * IRetriever implementation backed by Cloudflare Workers AI AutoRAG.
 *
 * Only routes public corpus queries. Internal scope is FORBIDDEN (REQ-CF-027).
 * HIPAA BAA confirmation flag must be set before any call (REQ-CF-029).
 */
export class AutoRAGRetriever implements IRetriever {
  readonly corpus: string;

  constructor(
    private readonly env: CloudflareEnv | AutoRAGEnv,
    private readonly instanceName: string,
    corpusLabel = 'autorag',
  ) {
    this.corpus = corpusLabel;
  }

  async retrieve(query: string, opts: RetrieverOptions = {}): Promise<RetrievalResult[]> {
    // REQ-CF-029: HIPAA BAA guard — must be confirmed before calling Workers AI.
    if ((this.env as AutoRAGEnv).HIPAA_BAA_CONFIRMED !== 'true') {
      throw new HIPAABAAScopeError(
        'AutoRAG requires HIPAA BAA confirmation. ' +
          'Set HIPAA_BAA_CONFIRMED=true after BAA is signed (Pending Item #1). ' +
          '(REQ-CF-029)',
      );
    }

    const limit = opts.limit ?? 10;
    const env = this.env as AutoRAGEnv;

    const response = await env.AI.autorag(this.instanceName).aiSearch({
      query,
      max_num_results: limit,
    });

    return response.results.map((result) => this.normalizeResult(result));
  }

  /**
   * Normalizes an AutoRAG result to the canonical RetrievalResult shape.
   * Ensures compatibility with Phase 2 Citation format consumers.
   */
  private normalizeResult(result: AutoRAGSearchResult): RetrievalResult {
    const meta = result.metadata ?? {};
    return {
      id: result.id,
      content: result.content ?? String(meta.content ?? ''),
      score: result.score,
      sourceId: String(meta.sourceId ?? result.id),
      metadata: {
        ...meta,
        retrievedBy: 'autorag',
        instanceName: this.instanceName,
      },
    };
  }
}
