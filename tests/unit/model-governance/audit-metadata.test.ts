// @MX:NOTE [AUTO] Unit tests for buildAnswerVersionMetadata (REQ-MODELGOV-007, AC-01).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 / Issue #402 (coverage ratchet-up).
// @MX:REASON REQ-MODELGOV-007 — every production answer must carry prompt/model
//   version provenance for regulatory traceability (21 CFR Part 11). This pure
//   function shapes ActiveCombination → AnswerVersionMetadata with no side effects.

import { describe, expect, it } from 'vitest';

describe('buildAnswerVersionMetadata (REQ-MODELGOV-007, AC-01)', () => {
  it('maps all 6 fields from ActiveCombination to AnswerVersionMetadata', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const combination = {
      id: 'combo-1',
      promptId: 'prompt-1',
      modelPinId: 'pin-1',
      promptVersion: 3,
      promptContentHash: 'abc123def456',
      modelProvider: 'openai',
      modelId: 'gpt-4',
      modelVersion: '2024-06-13',
      approvedAt: new Date('2025-01-01'),
    };
    const meta = buildAnswerVersionMetadata(combination);
    expect(meta).toEqual({
      approvedCombinationId: 'combo-1',
      promptVersion: 3,
      promptContentHash: 'abc123def456',
      modelProvider: 'openai',
      modelId: 'gpt-4',
      modelVersion: '2024-06-13',
    });
  });

  it('sets approvedCombinationId from combination.id', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'combo-uuid-42',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'anthropic',
      modelId: 'claude-3',
      modelVersion: 'v1',
      approvedAt: new Date(),
    });
    expect(meta.approvedCombinationId).toBe('combo-uuid-42');
  });

  it('sets promptVersion from combination.promptVersion', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 7,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    });
    expect(meta.promptVersion).toBe(7);
  });

  it('sets promptContentHash from combination.promptContentHash', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const hash = 'sha256:deadbeefcafef00d';
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: hash,
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    });
    expect(meta.promptContentHash).toBe(hash);
  });

  it('sets modelProvider from combination.modelProvider', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'google',
      modelId: 'gemini-pro',
      modelVersion: '1.5',
      approvedAt: new Date(),
    });
    expect(meta.modelProvider).toBe('google');
  });

  it('sets modelId from combination.modelId', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'mistral',
      modelId: 'mistral-large',
      modelVersion: '2',
      approvedAt: new Date(),
    });
    expect(meta.modelId).toBe('mistral-large');
  });

  it('sets modelVersion from combination.modelVersion', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: '2026-01-01',
      approvedAt: new Date(),
    });
    expect(meta.modelVersion).toBe('2026-01-01');
  });

  it('does not include approvedAt in the metadata (only version provenance)', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date('2025-06-01'),
    });
    expect(meta).not.toHaveProperty('approvedAt');
  });

  it('does not include promptId or modelPinId in the metadata', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'prompt-uuid',
      modelPinId: 'pin-uuid',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    });
    expect(meta).not.toHaveProperty('promptId');
    expect(meta).not.toHaveProperty('modelPinId');
  });

  it('produces exactly 6 keys (no extra fields)', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    });
    expect(Object.keys(meta).sort()).toEqual(
      [
        'approvedCombinationId',
        'promptContentHash',
        'promptVersion',
        'modelId',
        'modelProvider',
        'modelVersion',
      ].sort(),
    );
  });

  it('returns a new object each call (no shared reference)', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const combo = {
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    };
    const a = buildAnswerVersionMetadata(combo);
    const b = buildAnswerVersionMetadata(combo);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('handles version 1 (initial approval)', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'combo-first',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: 'first-hash',
      modelProvider: 'openai',
      modelId: 'gpt-4',
      modelVersion: 'latest',
      approvedAt: new Date(),
    });
    expect(meta.promptVersion).toBe(1);
    expect(meta.approvedCombinationId).toBe('combo-first');
  });

  it('handles large version numbers', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: 'c',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 999,
      promptContentHash: 'h',
      modelProvider: 'x',
      modelId: 'y',
      modelVersion: 'z',
      approvedAt: new Date(),
    });
    expect(meta.promptVersion).toBe(999);
  });

  it('preserves empty string values without coercion', async () => {
    const { buildAnswerVersionMetadata } = await import('@/lib/model-governance/audit-metadata');
    const meta = buildAnswerVersionMetadata({
      id: '',
      promptId: 'p',
      modelPinId: 'm',
      promptVersion: 1,
      promptContentHash: '',
      modelProvider: '',
      modelId: '',
      modelVersion: '',
      approvedAt: new Date(),
    });
    expect(meta.approvedCombinationId).toBe('');
    expect(meta.promptContentHash).toBe('');
    expect(meta.modelProvider).toBe('');
  });
});
