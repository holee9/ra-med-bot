// @MX:NOTE [AUTO] T-005 TDD RED phase — policy-keywords.ts tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-007)

import { POLICY_BLOCKED_KEYWORDS, detectPolicyKeyword } from '@/lib/ai/policy-keywords';
import { describe, expect, it } from 'vitest';

describe('POLICY_BLOCKED_KEYWORDS (REQ-ENTERPRISE-007)', () => {
  it('exports a frozen readonly array', () => {
    expect(Array.isArray(POLICY_BLOCKED_KEYWORDS)).toBe(true);
    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: testing frozen array
      (POLICY_BLOCKED_KEYWORDS as any).push('test');
    }).toThrow();
  });

  it('contains all 7 Korean keywords', () => {
    const korean = [
      '임상시험 면제',
      '임상시험 생략',
      'IDE 면제',
      '응급',
      '판매 허가 없이',
      '신고 없이 판매',
      '리콜 회피',
    ];
    for (const kw of korean) {
      expect(POLICY_BLOCKED_KEYWORDS).toContain(kw);
    }
  });

  it('contains all 4 English keywords', () => {
    const english = [
      'emergency use authorization',
      'humanitarian',
      'off-label marketing',
      'recall avoidance',
    ];
    for (const kw of english) {
      expect(POLICY_BLOCKED_KEYWORDS).toContain(kw);
    }
  });
});

describe('detectPolicyKeyword (REQ-ENTERPRISE-007)', () => {
  it('returns null when no keyword matches', () => {
    const result = detectPolicyKeyword(
      '일반적인 의료기기 질문입니다',
      '안전한 사용법을 알려드립니다.',
    );
    expect(result).toBeNull();
  });

  it('detects Korean keyword "임상시험 면제" in question', () => {
    const result = detectPolicyKeyword('임상시험 면제가 가능한가요?', '');
    expect(result).toBe('임상시험 면제');
  });

  it('detects Korean keyword "임상시험 생략" in question', () => {
    const result = detectPolicyKeyword('임상시험 생략 조건이 있나요?', '');
    expect(result).toBe('임상시험 생략');
  });

  it('detects Korean keyword "IDE 면제" in question', () => {
    const result = detectPolicyKeyword('IDE 면제 신청 방법은?', '');
    expect(result).toBe('IDE 면제');
  });

  it('detects Korean keyword "응급" in question', () => {
    const result = detectPolicyKeyword('응급 상황에서 사용 가능한가요?', '');
    expect(result).toBe('응급');
  });

  it('detects Korean keyword "판매 허가 없이" in question', () => {
    const result = detectPolicyKeyword('판매 허가 없이 판매할 수 있나요?', '');
    expect(result).toBe('판매 허가 없이');
  });

  it('detects Korean keyword "신고 없이 판매" in question', () => {
    const result = detectPolicyKeyword('신고 없이 판매가 가능한가요?', '');
    expect(result).toBe('신고 없이 판매');
  });

  it('detects Korean keyword "리콜 회피" in question', () => {
    const result = detectPolicyKeyword('리콜 회피 방법이 있나요?', '');
    expect(result).toBe('리콜 회피');
  });

  it('detects English keyword "emergency use authorization" in question', () => {
    const result = detectPolicyKeyword('Can I get emergency use authorization?', '');
    expect(result).toBe('emergency use authorization');
  });

  it('detects English keyword "humanitarian" in question', () => {
    const result = detectPolicyKeyword('What is humanitarian device exemption?', '');
    expect(result).toBe('humanitarian');
  });

  it('detects English keyword "off-label marketing" in question', () => {
    const result = detectPolicyKeyword('Is off-label marketing allowed?', '');
    expect(result).toBe('off-label marketing');
  });

  it('detects English keyword "recall avoidance" in question', () => {
    const result = detectPolicyKeyword('How does recall avoidance work?', '');
    expect(result).toBe('recall avoidance');
  });

  it('performs case-insensitive matching for English keywords', () => {
    const result = detectPolicyKeyword('EMERGENCY USE AUTHORIZATION request', '');
    expect(result).toBe('emergency use authorization');
  });

  it('performs case-insensitive matching — mixed case', () => {
    const result = detectPolicyKeyword('Emergency Use Authorization details', '');
    expect(result).toBe('emergency use authorization');
  });

  it('detects keyword in prose (not just question)', () => {
    const result = detectPolicyKeyword('일반적인 질문', '리콜 회피 방법에 대한 설명입니다.');
    expect(result).toBe('리콜 회피');
  });

  it('detects keyword in prose when question is empty', () => {
    const result = detectPolicyKeyword('', 'off-label marketing is prohibited.');
    expect(result).toBe('off-label marketing');
  });

  it('detects keyword when present in both question and prose (returns first match)', () => {
    const result = detectPolicyKeyword('응급 상황', '임상시험 면제 관련 내용');
    // Either "응급" or "임상시험 면제" — just ensure non-null
    expect(result).not.toBeNull();
  });
});
