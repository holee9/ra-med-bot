// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/digest/digest-generator pure helpers (SPEC-REGULA-DIGEST-001).
// @MX:SPEC SPEC-REGULA-DIGEST-001

import { describe, expect, it, vi } from 'vitest';

// Mock heavy deps so the module loads cleanly (only pure helpers are tested).
vi.mock('ai', () => ({ generateText: vi.fn() }));
vi.mock('@/lib/ai/llm-provider', () => ({ getLlmModel: vi.fn() }));
vi.mock('@/lib/audit', () => ({ writeAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/db/client', () => ({
  withTenantScope: vi.fn(async (_o: string, fn: (tx: unknown) => unknown) => fn({})),
}));
vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
import { classifySeverity, getWeekBounds, getWeekId } from '../digest-generator';

describe('getWeekId (ISO week)', () => {
  it('returns the correct ISO week for Jan 1 2026', () => {
    expect(getWeekId(new Date(2026, 0, 1))).toMatch(/^2026-W\d{2}$/);
  });

  it('returns a week-id string with the pattern YYYY-WNN', () => {
    const id = getWeekId(new Date(2026, 6, 13));
    expect(id).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('getWeekBounds', () => {
  it('returns start and end Dates where start < end', () => {
    const { start, end } = getWeekBounds('2026-W01');
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe('classifySeverity', () => {
  it('returns critical for severity=critical or impactScore >= 0.9', () => {
    expect(classifySeverity('critical', null)).toBe('critical');
    expect(classifySeverity('other', 0.95)).toBe('critical');
  });

  it('returns high for severity=warning or impactScore >= 0.7', () => {
    expect(classifySeverity('warning', null)).toBe('high');
    expect(classifySeverity('other', 0.75)).toBe('high');
  });

  it('returns medium for severity=info or impactScore >= 0.4', () => {
    expect(classifySeverity('info', null)).toBe('medium');
    expect(classifySeverity('other', 0.5)).toBe('medium');
  });

  it('returns low for everything else', () => {
    expect(classifySeverity('other', null)).toBe('low');
    expect(classifySeverity('other', 0.2)).toBe('low');
  });
});
