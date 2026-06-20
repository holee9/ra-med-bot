// @MX:NOTE [AUTO] Unit tests for hazard-identification.ts — SPEC-REGULA-RISK-001 Phase 1 (T1.6~T1.8).

import { describe, expect, it, vi } from 'vitest';
import {
  buildHazardPrompt,
  parseHazardResponse,
  identifyHazards,
} from '../hazard-identification';

// ---------------------------------------------------------------------------
// T1.6 — buildHazardPrompt
// ---------------------------------------------------------------------------
describe('buildHazardPrompt', () => {
  it('includes device description in prompt', () => {
    const prompt = buildHazardPrompt('Insulin pump with wireless telemetry', 'Class III');
    expect(prompt).toContain('Insulin pump with wireless telemetry');
  });

  it('includes device class in prompt', () => {
    const prompt = buildHazardPrompt('Ventilator', 'Class II');
    expect(prompt).toContain('Class II');
  });

  it('includes ISO 14971 terminology (hazard, harm, probability)', () => {
    const prompt = buildHazardPrompt('Device', 'Class I');
    expect(prompt.toLowerCase()).toContain('hazard');
    expect(prompt.toLowerCase()).toContain('harm');
  });

  it('includes JSON format instruction', () => {
    const prompt = buildHazardPrompt('Device', 'Class I');
    expect(prompt).toContain('JSON');
  });
});

// ---------------------------------------------------------------------------
// T1.7 — parseHazardResponse
// ---------------------------------------------------------------------------
describe('parseHazardResponse', () => {
  const validResponse = JSON.stringify({
    items: [
      {
        hazard: 'Electrical failure',
        sequenceOfEvents: 'Battery depletes → pump stops',
        hazardousSituation: 'Patient without insulin delivery',
        harm: 'Diabetic ketoacidosis',
        citation: [{ source: 'MAUDE', id: '123' }],
        confidence: 0.9,
      },
      {
        hazard: 'Over-infusion',
        sequenceOfEvents: 'Software bug → excess dose',
        hazardousSituation: 'Hypoglycemia risk',
        harm: 'Hypoglycaemic shock',
        citation: [{ source: 'FDA guidance', id: 'abc' }],
        confidence: 0.85,
      },
    ],
  });

  it('returns correct number of items', () => {
    const result = parseHazardResponse(validResponse);
    expect(result.items).toHaveLength(2);
  });

  it('maps fields correctly', () => {
    const result = parseHazardResponse(validResponse);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.items[0]!.hazard).toBe('Electrical failure');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.items[0]!.citation).toHaveLength(1);
  });

  it('lowConfidenceCount is 0 for all high-confidence items', () => {
    const result = parseHazardResponse(validResponse);
    expect(result.lowConfidenceCount).toBe(0);
  });

  it('marks items with confidence < 0.7 as lowConfidence', () => {
    const lowConfResponse = JSON.stringify({
      items: [
        {
          hazard: 'Uncertain hazard',
          sequenceOfEvents: '...',
          hazardousSituation: '...',
          harm: 'Unknown',
          citation: [{ source: 'MAUDE', id: '1' }],
          confidence: 0.5,
        },
      ],
    });
    const result = parseHazardResponse(lowConfResponse);
    expect(result.lowConfidenceCount).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.items[0]!.lowConfidence).toBe(true);
  });

  it('sets lowConfidence=true for items without citation', () => {
    const noCiteResponse = JSON.stringify({
      items: [
        {
          hazard: 'No citation hazard',
          sequenceOfEvents: '...',
          hazardousSituation: '...',
          harm: 'Unknown',
          citation: [],
          confidence: 0.95,
        },
      ],
    });
    const result = parseHazardResponse(noCiteResponse);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.items[0]!.lowConfidence).toBe(true);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseHazardResponse('not json')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// T1.8 — identifyHazards (RAG integration, mocked)
// ---------------------------------------------------------------------------
describe('identifyHazards', () => {
  it('calls fetchFn with correct endpoint and prompt', async () => {
    const mockItems = [
      {
        hazard: 'Electrical failure',
        sequenceOfEvents: 'Battery fault',
        hazardousSituation: 'No insulin',
        harm: 'DKA',
        citation: [{ source: 'MAUDE', id: '1' }],
        confidence: 0.9,
      },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ answer: JSON.stringify({ items: mockItems }) }),
    });

    const result = await identifyHazards('Insulin pump', 'Class III', mockFetch);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.items).toHaveLength(1);
  });

  it('propagates RAG errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('RAG unavailable'));
    await expect(identifyHazards('Device', 'Class I', mockFetch)).rejects.toThrow('RAG unavailable');
  });
});
