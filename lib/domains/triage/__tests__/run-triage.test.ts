/**
 * T-004..T-007: TRIAGE RAG 파이프라인 래퍼 테스트
 *
 * TDD 순서:
 * T-004: 정상 흐름 (RAG → LLM → citations → confidence)
 * T-005: no_citations (빈 topChunks)
 * T-006: timeout/runtime_error
 * T-007: extractCitations 호환성
 *
 * @MX:SPEC SPEC-V3-TRIAGE-001
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTriage } from '../run-triage';
import type { TriageResult } from '../types';

// Mock AI modules
vi.mock('@/lib/ai/hybrid-router', () => ({
  hybridRetrieve: vi.fn(),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmModel: vi.fn(() => ({ provider: 'test', modelId: 'test-model' })),
}));

vi.mock('@/lib/ai/prompt-templates', () => ({
  composePrompt: vi.fn(() => ({ systemPrompt: 'test system', chunkContext: '' })),
}));

vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

import { hybridRetrieve } from '@/lib/ai/hybrid-router';
import { getLlmModel } from '@/lib/ai/llm-provider';
import { composePrompt } from '@/lib/ai/prompt-templates';
import { streamText } from 'ai';

describe('runTriage', () => {
  const mockQuestion = '테스트 질문';
  const mockOrgId = 'org-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock env
    vi.mock('@/lib/env', () => ({
      getEnv: () => ({
        TRIAGE_TIMEOUT_MS: 15000,
      }),
    }));
  });

  /**
   * T-004: 정상 흐름
   *
   * GIVEN: hybridRetrieve가 8개 chunk 반환
   * WHEN: runTriage 호출
   * THEN: autoAnswer.answer와 citations 있고, autoConfidence 0~1
   */
  it('T-004: should return autoAnswer and confidence on success', async () => {
    // Arrange: Mock RAG chunks
    const mockChunks = Array.from({ length: 8 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Content ${i}`,
      score: 0.8 + i * 0.02,
      sourceId: `source-${i % 3}`, // 3 unique sources
      metadata: {
        title: `Title ${i}`,
        anchor: `anchor-${i}`,
        offset: i * 100,
      },
    }));
    vi.mocked(hybridRetrieve).mockResolvedValue(mockChunks);

    // Mock LLM response with citations (data-source format)
    const mockProse =
      'Answer text <sup class="cite" data-source="1">1</sup> more text <sup class="cite" data-source="2">2</sup>';
    vi.mocked(streamText).mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', textDelta: mockProse };
        yield {
          type: 'finish',
          usage: { promptTokens: 100, completionTokens: 50 },
          finishReason: 'stop',
          response: {},
        } as any;
      })(),
    } as any);

    // Act
    const result = await runTriage({ question: mockQuestion, orgId: mockOrgId });

    // Assert
    expect(result.autoAnswer).not.toBeNull();
    expect(result.autoAnswer?.answer).toContain('Answer text');
    expect(result.autoAnswer?.citations).toHaveLength(2);
    expect(result.autoConfidence).toBeGreaterThan(0);
    expect(result.autoConfidence).toBeLessThanOrEqual(1);
    expect(result.error).toBeUndefined();

    // Verify AI module calls (basic checks only - strict match not needed)
    expect(hybridRetrieve).toHaveBeenCalled();
    expect(composePrompt).toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
  });

  /**
   * T-005: no_citations (E-01 빈 topChunks)
   *
   * GIVEN: hybridRetrieve가 빈 배열 반환
   * WHEN: runTriage 호출
   * THEN: error='no_citations', autoAnswer=null, autoConfidence=null
   */
  it('T-005: should return no_citations error when RAG returns empty chunks', async () => {
    // Arrange: Empty RAG results
    vi.mocked(hybridRetrieve).mockResolvedValue([]);

    // Act
    const result = await runTriage({ question: mockQuestion, orgId: mockOrgId });

    // Assert
    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('no_citations');

    // LLM should NOT be called
    expect(streamText).not.toHaveBeenCalled();
  });

  /**
   * T-006: timeout/runtime_error
   *
   * GIVEN: Promise.race 타임아웃
   * WHEN: runTriage 호출
   * THEN: error='timeout', autoAnswer=null, autoConfidence=null
   */
  it('T-006: should return timeout error when RAG exceeds timeout', async () => {
    // Arrange: Slow RAG that never resolves
    vi.mocked(hybridRetrieve).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    // Act - add test timeout since we're waiting for actual 15s timeout
    const result = await runTriage({ question: mockQuestion, orgId: mockOrgId });

    // Assert
    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('timeout');
  }, 20000); // 20s test timeout (15s TRIAGE_TIMEOUT + buffer)

  /**
   * T-006: runtime_error
   *
   * GIVEN: hybridRetrieve throw
   * WHEN: runTriage 호출
   * THEN: error='runtime_error', autoAnswer=null, autoConfidence=null
   */
  it('T-006: should return runtime_error when RAG throws exception', async () => {
    // Arrange: RAG throws error
    vi.mocked(hybridRetrieve).mockRejectedValue(new Error('Database connection failed'));

    // Act
    const result = await runTriage({ question: mockQuestion, orgId: mockOrgId });

    // Assert
    expect(result.autoAnswer).toBeNull();
    expect(result.autoConfidence).toBeNull();
    expect(result.error).toBe('runtime_error');
  });

  /**
   * T-007: extractCitations 호환성
   *
   * GIVEN: LLM 응답에 <sup class="cite">N</sup> 마커
   * WHEN: runTriage 완료
   * THEN: citations[]에 sourceId+quote 포맷 (promote.ts extractCitations 호환)
   */
  it('T-007: should generate citations compatible with extractCitations parser', async () => {
    // Arrange: RAG chunks with metadata
    const mockChunks = [
      {
        id: 'chunk-1',
        content: 'Content from source A',
        score: 0.9,
        sourceId: 'source-uuid-1',
        metadata: {
          title: 'Regulation A',
          anchor: 'section-1',
          offset: 100,
          quote: 'Exact quote from source',
        },
      },
      {
        id: 'chunk-2',
        content: 'Content from source B',
        score: 0.85,
        sourceId: 'source-uuid-2',
        metadata: {
          title: 'Regulation B',
          anchor: 'section-2',
          offset: 200,
        },
      },
    ];
    vi.mocked(hybridRetrieve).mockResolvedValue(mockChunks);

    // Mock LLM response with data-source citations (extractCitations 호환)
    const mockProse =
      'Answer <sup class="cite" data-source="1">1</sup> continues <sup class="cite" data-source="2">2</sup>';
    vi.mocked(streamText).mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'text-delta', textDelta: mockProse };
        yield {
          type: 'finish',
          usage: { promptTokens: 100, completionTokens: 50 },
          finishReason: 'stop',
          response: {},
        } as any;
      })(),
    } as any);

    // Act
    const result = await runTriage({ question: mockQuestion, orgId: mockOrgId });

    // Assert: citations format matches extractCitations expectation
    expect(result.autoAnswer?.citations).toHaveLength(2);
    expect(result.autoAnswer?.citations[0]).toMatchObject({
      source: 'source-uuid-1',
    });
    expect(result.autoAnswer?.citations[1]).toMatchObject({
      source: 'source-uuid-2',
    });

    // Verify quote is included when available (extractCitations compatibility)
    const citationWithQuote = result.autoAnswer?.citations.find(
      (c) => c.source === 'source-uuid-1',
    );
    expect(citationWithQuote?.quote).toBeDefined();
  });
});
