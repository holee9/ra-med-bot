// @MX:NOTE [AUTO] Unit tests for revision-detector.ts — SPEC-REGULA-STANDARDS-001 (AC-04 graceful).
// Graceful degradation: no source configured → detectRevisions returns [].

import { afterEach, describe, expect, it } from 'vitest';
import { detectRevisions, resolveDetectionContext } from '../revision-detector';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  // Restore env between tests so resolveDetectionContext reads cleanly.
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDetectionContext', () => {
  it('returns hasActiveSource=false when no crawler env is set', () => {
    const {
      FDA_RECOGNIZED_STANDARDS_API_URL,
      ISO_STANDARDS_API_URL,
      CEN_STANDARDS_API_URL,
      ...rest
    } = process.env;
    void FDA_RECOGNIZED_STANDARDS_API_URL;
    void ISO_STANDARDS_API_URL;
    void CEN_STANDARDS_API_URL;
    process.env = rest;
    const ctx = resolveDetectionContext();
    expect(ctx.hasActiveSource).toBe(false);
  });

  it('returns hasActiveSource=true when FDA env is set', () => {
    process.env = { ...process.env, FDA_RECOGNIZED_STANDARDS_API_URL: 'https://example.com/fda' };
    const ctx = resolveDetectionContext();
    expect(ctx.hasActiveSource).toBe(true);
  });
});

describe('detectRevisions — graceful degradation (AC-04 structural)', () => {
  it('returns [] immediately when no source is configured (no-op stub)', async () => {
    const {
      FDA_RECOGNIZED_STANDARDS_API_URL,
      ISO_STANDARDS_API_URL,
      CEN_STANDARDS_API_URL,
      ...rest
    } = process.env;
    void FDA_RECOGNIZED_STANDARDS_API_URL;
    void ISO_STANDARDS_API_URL;
    void CEN_STANDARDS_API_URL;
    process.env = rest;
    const result = await detectRevisions({ hasActiveSource: false });
    expect(result).toEqual([]);
  });

  it('also returns [] in this MVP — live crawlers deferred to #62-A/#62-B/#62-C', async () => {
    // Even with hasActiveSource=true, the stub is a no-op until crawlers land.
    const result = await detectRevisions({ hasActiveSource: true });
    expect(result).toEqual([]);
  });
});
