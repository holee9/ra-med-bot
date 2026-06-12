// @MX:SPEC REQ-CLINLIT-001~005

import { describe, expect, it, vi } from 'vitest';

// Mock the AI SDK before importing module under test.
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@/lib/ai/llm-provider', () => ({
  getLlmFastModel: vi.fn(() => 'mock-model'),
}));

import { generateObject } from 'ai';
import { generatePicoQuery } from '../../../lib/cer/pico-generator';

const MOCK_PICO_RESPONSE = {
  object: {
    patient: 'adult patients with type 2 diabetes mellitus requiring glucose monitoring',
    intervention: 'continuous glucose monitoring (CGM) device',
    comparator: 'self-monitoring blood glucose (SMBG)',
    outcome: 'glycemic control (HbA1c reduction) and safety events',
    meshTerms: ['Blood Glucose Self-Monitoring', 'Diabetes Mellitus, Type 2', 'HbA1c Proteins'],
    searchQuery:
      '"continuous glucose monitoring"[MeSH] AND "diabetes mellitus, type 2"[MeSH] AND (safety OR efficacy)',
  },
};

describe('generatePicoQuery', () => {
  it('returns a valid PicoFramework shape', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(MOCK_PICO_RESPONSE as never);

    const result = await generatePicoQuery(
      'Continuous glucose monitoring system for type 2 diabetes patients',
    );

    expect(result.patient).toBeTruthy();
    expect(result.intervention).toBeTruthy();
    expect(result.outcome).toBeTruthy();
    expect(result.searchQuery).toBeTruthy();
    expect(Array.isArray(result.meshTerms)).toBe(true);
  });

  it('returns non-empty searchQuery', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(MOCK_PICO_RESPONSE as never);

    const result = await generatePicoQuery('orthopedic implant device');

    expect(result.searchQuery.length).toBeGreaterThan(0);
  });

  it('returns mock data in E2E_TEST_MODE without calling generateObject for PICO', async () => {
    const callsBefore = vi.mocked(generateObject).mock.calls.length;

    process.env.E2E_TEST_MODE = 'true';
    // NODE_ENV is 'test' in vitest — satisfies the !== 'production' guard.

    const result = await generatePicoQuery('test device description');

    const callsAfter = vi.mocked(generateObject).mock.calls.length;
    expect(callsAfter).toBe(callsBefore); // no new calls

    expect(result.searchQuery).toBeTruthy();
    expect(result.patient).toBeTruthy();

    process.env.E2E_TEST_MODE = '';
  });

  it('passes device description to intervention in E2E mode', async () => {
    process.env.E2E_TEST_MODE = 'true';

    const description = 'spinal cord stimulation device for chronic pain management';
    const result = await generatePicoQuery(description);

    expect(result.intervention).toContain(description.slice(0, 50));

    process.env.E2E_TEST_MODE = '';
  });
});
