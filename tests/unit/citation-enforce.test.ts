// @MX:NOTE Unit tests for citation enforcement — REQ-CHAT-024..029.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { enforceCitations } from '../../lib/ai/citation-enforce';

describe('enforceCitations', () => {
  it('passes through clean cited prose', () => {
    const prose =
      'FDA requires 510(k) submission. <sup class="cite" data-source="1" data-offset="0">1</sup>';
    const { cleaned, violations } = enforceCitations(prose, [1]);
    expect(violations).toHaveLength(0);
    expect(cleaned).toContain('FDA requires');
  });

  it('marks uncited factual claim with CLAIM_UNCITED', () => {
    const prose = 'FDA는 90일 내 심사한다.';
    const { cleaned, violations } = enforceCitations(prose, [1]);
    expect(violations.some((v) => v.type === 'CLAIM_UNCITED')).toBe(true);
    expect(cleaned).toContain('<mark class="uncited">');
  });

  it('strips invalid source reference and adds SOURCE_MISMATCH', () => {
    const prose =
      'FDA review takes 90 days. <sup class="cite" data-source="7" data-offset="0">7</sup>';
    const { cleaned, violations } = enforceCitations(prose, [1, 2]);
    expect(violations.some((v) => v.type === 'SOURCE_MISMATCH')).toBe(true);
    expect(cleaned).not.toContain('data-source="7"');
  });

  it('does not flag meta-sentence starting with 다음은', () => {
    const prose = '다음은 규제 요약입니다.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag meta-sentence starting with 본 답변은', () => {
    const prose = '본 답변은 정보 제공 목적입니다.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag meta-sentence starting with 요약하면', () => {
    const prose = '요약하면 다음과 같습니다.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag meta-sentence starting with 참고로', () => {
    const prose = '참고로 아래 표를 확인하세요.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag meta-sentence starting with 아래 표는', () => {
    const prose = '아래 표는 비교를 보여줍니다.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag English meta-sentence starting with The following', () => {
    const prose = 'The following is a summary.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag English meta-sentence starting with In summary', () => {
    const prose = 'In summary, the regulation requires compliance.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag English meta-sentence starting with Note that', () => {
    const prose = 'Note that this is guidance only.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag English meta-sentence starting with Please note', () => {
    const prose = 'Please note the following requirements.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('does not flag English meta-sentence starting with This response', () => {
    const prose = 'This response is based on FDA guidance.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED')).toHaveLength(0);
  });

  it('preserves valid sup tags in cleaned output', () => {
    const prose = 'The rule applies. <sup class="cite" data-source="1" data-offset="100">1</sup>';
    const { cleaned } = enforceCitations(prose, [1]);
    expect(cleaned).toContain('data-source="1"');
  });

  it('handles multiple sentences correctly', () => {
    const prose =
      'FDA는 90일 내 심사한다. 두 번째 사실 주장이다. 세 번째 사실 주장이다. 네 번째 사실 주장이다. 다섯 번째 주장이다.';
    const { violations } = enforceCitations(prose, []);
    expect(violations.filter((v) => v.type === 'CLAIM_UNCITED').length).toBeGreaterThan(0);
  });

  it('returns empty violations for empty prose', () => {
    const { violations } = enforceCitations('', []);
    expect(violations).toHaveLength(0);
  });
});
