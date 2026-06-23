import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  type PmsInputRaw,
  checkUploadSize,
  normalizePmsInput,
  validatePmsInput,
} from '../inputs';

// SPEC-REGULA-PMS-001 (REQ-PMS-005, REQ-PMS-006, REQ-PMS-012, AC-05):
// complaint/vigilance data normalization + validation + upload size guard.

describe('normalizePmsInput', () => {
  it('lowercases source and trims whitespace', () => {
    const raw: PmsInputRaw = { source: '  Complaint  ', severity: ' Death ' };
    const out = normalizePmsInput(raw);
    expect(out.source).toBe('complaint');
    expect(out.severity).toBe('death');
  });

  it('coerces susar_flag string "true" to boolean true', () => {
    const out = normalizePmsInput({ source: 'vigilance', susar_flag: 'true' });
    expect(out.susarFlag).toBe(true);
  });

  it('defaults susar_flag to false when absent', () => {
    const out = normalizePmsInput({ source: 'complaint' });
    expect(out.susarFlag).toBe(false);
  });

  it('preserves trend_category as-is (lowercased)', () => {
    const out = normalizePmsInput({ source: 'complaint', trend_category: 'Increase' });
    expect(out.trendCategory).toBe('increase');
  });
});

describe('validatePmsInput', () => {
  it('rejects empty source', () => {
    const result = validatePmsInput({ source: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /source/i.test(e))).toBe(true);
  });

  it('rejects unknown source value', () => {
    const result = validatePmsInput({ source: 'unknown_source' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /source/i.test(e))).toBe(true);
  });

  it('accepts complaint, vigilance, susar, trend as valid sources', () => {
    for (const s of ['complaint', 'vigilance', 'susar', 'trend']) {
      expect(validatePmsInput({ source: s }).ok).toBe(true);
    }
  });

  it('rejects severity outside allowed set', () => {
    const result = validatePmsInput({ source: 'complaint', severity: 'catastrophic' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /severity/i.test(e))).toBe(true);
  });

  it('accepts non-serious, serious, death as valid severities', () => {
    for (const s of ['non_serious', 'serious', 'death']) {
      expect(validatePmsInput({ source: 'complaint', severity: s }).ok).toBe(true);
    }
  });

  it('returns ok=true with no errors for valid input', () => {
    const result = validatePmsInput({
      source: 'vigilance',
      severity: 'serious',
      susar_flag: true,
      trend_category: 'increase',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('upload size guard (REQ-PMS-012)', () => {
  it('MAX_UPLOAD_BYTES is 10 MB (10 * 1024 * 1024)', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it('checkUploadSize returns null for valid byte length', () => {
    expect(checkUploadSize(1024)).toBeNull();
    expect(checkUploadSize(MAX_UPLOAD_BYTES)).toBeNull();
  });

  it('checkUploadSize rejects empty file (0 bytes)', () => {
    expect(checkUploadSize(0)).toBe('Uploaded file is empty.');
  });

  it('checkUploadSize rejects file exceeding 10 MB limit', () => {
    const msg = checkUploadSize(MAX_UPLOAD_BYTES + 1);
    expect(msg).toContain('exceeds');
    expect(msg).toContain('10 MB limit');
  });

  it('checkUploadSize error messages contain no internal info leaks', () => {
    // Safe messages: no stack traces, no internal paths, no PII.
    const emptyMsg = checkUploadSize(0) ?? '';
    const bigMsg = checkUploadSize(MAX_UPLOAD_BYTES + 1) ?? '';
    expect(emptyMsg).not.toMatch(/error|exception|stack|trace/i);
    expect(bigMsg).not.toMatch(/error|exception|stack|trace/i);
  });
});
