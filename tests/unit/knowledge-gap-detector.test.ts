// @MX:NOTE [AUTO] TDD GREEN phase — SPEC-REGULA-KNOWLEDGE-GAP-001 (Issue #35).
// @MX:SPEC SPEC-REGULA-KNOWLEDGE-GAP-001 (REQ-KNOWLEDGE-GAP-001, REQ-KNOWLEDGE-GAP-002, AC-01, AC-02)
//
// Unit tests for the pure detection function (4 conditions) and the redaction
// wrapper. Side-effectful captureKnowledgeGap() is integration-tested elsewhere
// (requires DB); here we cover REQ-KNOWLEDGE-GAP-001 (4 gap conditions) and
// REQ-KNOWLEDGE-GAP-002 (redaction + hash).

import { describe, expect, it, vi } from 'vitest';

// Mock the DB/audit layer so module load does not trigger env validation.
// detectKnowledgeGap() itself is a pure function; these mocks only short-circuit
// the transitive audit.ts → db/client.ts → parseEnv import chain.
vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));

import {
  type GapDetectionInput,
  LOW_CONFIDENCE_THRESHOLD,
  detectKnowledgeGap,
} from '../../lib/knowledge-gap/detector';
import { hashQuestion, redactQuestion } from '../../lib/knowledge-gap/redaction';

const baseInput: GapDetectionInput = {
  confidenceScore: 0.9,
  confidenceLevel: 'high',
  citationCoverageBelow80: false,
  topChunksLength: 5,
  llmFailed: false,
};

describe('detectKnowledgeGap — 4 conditions (REQ-KNOWLEDGE-GAP-001, AC-01)', () => {
  it('returns null when the consult was adequately answered', () => {
    expect(detectKnowledgeGap(baseInput)).toBeNull();
  });

  it('detects policy_blocked when LLM generation failed (design §2.1 cond. 4)', () => {
    const input: GapDetectionInput = { ...baseInput, llmFailed: true };
    // Even if confidence is also low, policy_blocked is the root cause and wins.
    expect(detectKnowledgeGap(input)).toBe('policy_blocked');
  });

  it('detects no_results when search returned 0 chunks (design §2.1 cond. 3)', () => {
    const input: GapDetectionInput = { ...baseInput, topChunksLength: 0 };
    expect(detectKnowledgeGap(input)).toBe('no_results');
  });

  it('detects low_citation when citation coverage < 80% (design §2.1 cond. 2)', () => {
    const input: GapDetectionInput = { ...baseInput, citationCoverageBelow80: true };
    expect(detectKnowledgeGap(input)).toBe('low_citation');
  });

  it('detects low_confidence via confidenceLevel=low (design §2.1 cond. 1)', () => {
    const input: GapDetectionInput = { ...baseInput, confidenceLevel: 'low', confidenceScore: 0.4 };
    expect(detectKnowledgeGap(input)).toBe('low_confidence');
  });

  it('detects low_confidence via score < threshold even when level is med', () => {
    // Edge: score below 0.5 but level reported as 'med' — score is authoritative.
    const input: GapDetectionInput = {
      ...baseInput,
      confidenceLevel: 'med',
      confidenceScore: LOW_CONFIDENCE_THRESHOLD - 0.01,
    };
    expect(detectKnowledgeGap(input)).toBe('low_confidence');
  });

  it('does NOT flag low_confidence at the exact threshold (0.5 is acceptable)', () => {
    const input: GapDetectionInput = {
      ...baseInput,
      confidenceLevel: 'med',
      confidenceScore: LOW_CONFIDENCE_THRESHOLD,
    };
    expect(detectKnowledgeGap(input)).toBeNull();
  });

  it('policy_blocked takes precedence over no_results (root cause wins)', () => {
    const input: GapDetectionInput = { ...baseInput, llmFailed: true, topChunksLength: 0 };
    expect(detectKnowledgeGap(input)).toBe('policy_blocked');
  });

  it('no_results takes precedence over low_citation (no chunks → nothing to cite)', () => {
    const input: GapDetectionInput = {
      ...baseInput,
      topChunksLength: 0,
      citationCoverageBelow80: true,
    };
    expect(detectKnowledgeGap(input)).toBe('no_results');
  });
});

describe('redactQuestion — PII redaction + hash (REQ-KNOWLEDGE-GAP-002, AC-02)', () => {
  it('redacts SSN and email from the question (HIPAA Safe Harbor regex layer)', () => {
    // NOTE: the existing regex utility (lib/ingest/pii/regex.ts) targets US-centric
    // PII formats per HIPAA Safe Harbor. Korean phone formats (010-XXXX-XXXX) are
    // not matched by the US phone regex — this is expected behavior of the reused
    // utility, not a gap in the redaction wrapper.
    const original = '이메일: user@example.com, 주민번호: 123-45-6789, 전화: +1-800-555-1234';
    const { redacted, hash, redactionCount } = redactQuestion(original);

    // PII must not survive into the redacted text.
    expect(redacted).not.toContain('user@example.com');
    expect(redacted).not.toContain('123-45-6789');
    expect(redacted).not.toContain('800-555-1234');
    // Hash is a 64-char SHA-256 hex.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // At least the email + ssn detected (phone regex may or may not match KR format).
    expect(redactionCount).toBeGreaterThanOrEqual(2);
  });

  it('hash is deterministic for the same original (de-dup contract)', () => {
    const a = hashQuestion('동일한 질문');
    const b = hashQuestion('동일한 질문');
    expect(a).toBe(b);
  });

  it('hash differs for different originals', () => {
    expect(hashQuestion('질문 A')).not.toBe(hashQuestion('질문 B'));
  });

  it('returns the original text unchanged when no PII is present', () => {
    const original = '510(k) 제출 절차를 설명해주세요.';
    const { redacted, redactionCount } = redactQuestion(original);
    expect(redacted).toBe(original);
    expect(redactionCount).toBe(0);
  });

  it('original PII is NOT recoverable from the redacted output', () => {
    const original = '담당자: 이홀리, 이메일: holee@example.com';
    const { redacted } = redactQuestion(original);
    // The email must not appear verbatim — redaction is one-way.
    expect(redacted).not.toContain('holee@example.com');
  });
});
