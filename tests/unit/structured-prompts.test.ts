// @MX:NOTE Unit tests for structured-prompts.ts — REQ-STRUCT-017~018.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildChecklistClassifier,
  buildChecklistGenerator,
  buildComparisonClassifier,
  buildComparisonGenerator,
  buildRelatedGenerator,
  buildTimelineClassifier,
  buildTimelineGenerator,
} from '../../lib/ai/structured-prompts';

const baseInput = {
  question: '510(k) 면제 기준은 무엇인가?',
  prose: 'FDA 21 CFR Part 807에 따르면 510(k) 면제는 다음 조건을 충족해야 합니다...',
  topSources: [
    { title: 'FDA Guidance on 510(k)', orgLabel: 'FDA', year: 2024 },
    { title: 'EU MDR Article 52', orgLabel: 'EU Commission', year: 2017 },
  ],
  locale: 'ko' as const,
};

const REQUIRED_ENDING = '응답은 오직 JSON 객체로만 출력하라. 코드 블록, 해설, 서문 금지.';

describe('buildChecklistClassifier (REQ-STRUCT-017)', () => {
  it('returns a non-empty string', () => {
    const prompt = buildChecklistClassifier(baseInput);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('contains the question', () => {
    const prompt = buildChecklistClassifier(baseInput);
    expect(prompt).toContain(baseInput.question);
  });

  it('asks for yes or no response', () => {
    const prompt = buildChecklistClassifier(baseInput);
    expect(prompt.toLowerCase()).toMatch(/yes|no|예|아니/);
  });
});

describe('buildChecklistGenerator (REQ-STRUCT-017)', () => {
  it('returns a string ending with required JSON instruction', () => {
    const prompt = buildChecklistGenerator(baseInput);
    expect(prompt).toContain(REQUIRED_ENDING);
  });

  it('contains the question and prose', () => {
    const prompt = buildChecklistGenerator(baseInput);
    expect(prompt).toContain(baseInput.question);
    expect(prompt).toContain(baseInput.prose.slice(0, 30));
  });

  it('does not contain HTML sup tag (REQ-STRUCT-018)', () => {
    const prompt = buildChecklistGenerator(baseInput);
    expect(prompt).not.toContain('<sup');
  });

  it('does not contain data-source attribute (REQ-STRUCT-018)', () => {
    const prompt = buildChecklistGenerator(baseInput);
    expect(prompt).not.toContain('data-source=');
  });
});

describe('buildComparisonClassifier (REQ-STRUCT-017)', () => {
  it('returns a non-empty string', () => {
    const prompt = buildComparisonClassifier(baseInput);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('asks for yes or no response', () => {
    const prompt = buildComparisonClassifier(baseInput);
    expect(prompt.toLowerCase()).toMatch(/yes|no|예|아니/);
  });
});

describe('buildComparisonGenerator (REQ-STRUCT-017)', () => {
  it('returns a string ending with required JSON instruction', () => {
    const prompt = buildComparisonGenerator(baseInput);
    expect(prompt).toContain(REQUIRED_ENDING);
  });

  it('does not contain HTML sup tag (REQ-STRUCT-018)', () => {
    const prompt = buildComparisonGenerator(baseInput);
    expect(prompt).not.toContain('<sup');
  });
});

describe('buildTimelineClassifier (REQ-STRUCT-017)', () => {
  it('returns a non-empty string', () => {
    const prompt = buildTimelineClassifier(baseInput);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('asks for yes or no response', () => {
    const prompt = buildTimelineClassifier(baseInput);
    expect(prompt.toLowerCase()).toMatch(/yes|no|예|아니/);
  });
});

describe('buildTimelineGenerator (REQ-STRUCT-017)', () => {
  it('returns a string ending with required JSON instruction', () => {
    const prompt = buildTimelineGenerator(baseInput);
    expect(prompt).toContain(REQUIRED_ENDING);
  });

  it('does not contain HTML sup tag (REQ-STRUCT-018)', () => {
    const prompt = buildTimelineGenerator(baseInput);
    expect(prompt).not.toContain('<sup');
  });
});

describe('buildRelatedGenerator (REQ-STRUCT-017)', () => {
  it('returns a string ending with required JSON instruction', () => {
    const prompt = buildRelatedGenerator(baseInput);
    expect(prompt).toContain(REQUIRED_ENDING);
  });

  it('instructs to generate 3-5 items', () => {
    const prompt = buildRelatedGenerator(baseInput);
    expect(prompt).toMatch(/3.{0,5}5|3~5/);
  });

  it('does not contain HTML sup tag (REQ-STRUCT-018)', () => {
    const prompt = buildRelatedGenerator(baseInput);
    expect(prompt).not.toContain('<sup');
  });

  it('does not contain data-source attribute (REQ-STRUCT-018)', () => {
    const prompt = buildRelatedGenerator(baseInput);
    expect(prompt).not.toContain('data-source=');
  });
});
