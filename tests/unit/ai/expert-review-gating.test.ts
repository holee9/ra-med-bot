// @MX:NOTE [AUTO] T-005 TDD RED phase — expert-review-gating.ts tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-008)

import { shouldAutoFlag } from '@/lib/ai/expert-review-gating';
import { describe, expect, it } from 'vitest';

describe('shouldAutoFlag (REQ-ENTERPRISE-008)', () => {
  it('returns flag=true when confidenceScore < 0.7', () => {
    const result = shouldAutoFlag(0.65, '일반 질문', '일반적인 답변입니다.');
    expect(result.flag).toBe(true);
  });

  it('reason string contains formatted confidence score when low confidence triggers flag', () => {
    const result = shouldAutoFlag(0.65, '일반 질문', '일반적인 답변입니다.');
    expect(result.reason).toBe('confidence score 0.65 < 0.7');
  });

  it('returns flag=false when score is high and no policy keywords present', () => {
    const result = shouldAutoFlag(0.85, '안전한 의료기기 질문', '일반적인 안전 사용법입니다.');
    expect(result.flag).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('returns flag=true when policy keyword detected regardless of high confidence', () => {
    const result = shouldAutoFlag(0.9, '리콜 회피 방법은?', '규정을 설명합니다.');
    expect(result.flag).toBe(true);
  });

  it('reason string contains matched keyword when policy keyword triggers flag', () => {
    const result = shouldAutoFlag(0.9, '리콜 회피 방법은?', '규정을 설명합니다.');
    expect(result.reason).toBe('policy keyword: 리콜 회피');
  });

  it('reason string for English keyword contains the matched keyword', () => {
    const result = shouldAutoFlag(0.8, 'recall avoidance strategy', 'some answer');
    expect(result.reason).toBe('policy keyword: recall avoidance');
  });

  it('edge case: score exactly 0.7 does NOT trigger low confidence flag', () => {
    const result = shouldAutoFlag(0.7, '일반 질문', '일반 답변.');
    expect(result.flag).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('edge case: score 0.699 DOES trigger low confidence flag', () => {
    const result = shouldAutoFlag(0.699, '일반 질문', '일반 답변.');
    expect(result.flag).toBe(true);
    expect(result.reason).toBe('confidence score 0.70 < 0.7');
  });

  it('priority: low confidence check runs before policy keyword check', () => {
    // Both conditions true — reason should reflect confidence, not keyword
    const result = shouldAutoFlag(0.5, '응급 상황 질문', '답변 내용');
    expect(result.flag).toBe(true);
    expect(result.reason).toContain('confidence score');
    expect(result.reason).not.toContain('policy keyword');
  });
});
