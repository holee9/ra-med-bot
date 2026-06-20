/**
 * TDD RED: Tests for PDF signature injection utility.
 * REQ-ESIG-008: PDF exports include §11.50 signature block.
 */

import { describe, expect, it } from 'vitest';
import { injectSignatureToPDFData } from '../pdf-inject';

const mockSignature = {
  id: 'sig-001',
  signerName: 'Alice Lead',
  signerTitle: 'RA Lead',
  meaning: 'Approved for regulatory submission',
  signedAt: new Date('2026-06-20T10:00:00Z'),
  recordHash: 'deadbeef1234',
  revokedAt: null,
};

describe('injectSignatureToPDFData', () => {
  it('appends signature block to content when signature exists', () => {
    const data = { content: 'Answer text', title: 'Test' };
    const result = injectSignatureToPDFData(data, mockSignature);

    expect(result.content).toContain('Alice Lead');
    expect(result.content).toContain('RA Lead');
    expect(result.content).toContain('Approved for regulatory submission');
    expect(result.content).toContain('deadbeef1234');
  });

  it('returns data unchanged when signature is null', () => {
    const data = { content: 'Answer text', title: 'Test' };
    const result = injectSignatureToPDFData(data, null);

    expect(result.content).toBe('Answer text');
    expect(result).toEqual(data);
  });

  it('includes signature date in content', () => {
    const data = { content: 'Answer text' };
    const result = injectSignatureToPDFData(data, mockSignature);

    expect(result.content).toContain('2026');
  });

  it('marks revoked signatures in content', () => {
    const revokedSig = { ...mockSignature, revokedAt: new Date('2026-06-21T10:00:00Z') };
    const data = { content: 'Answer text' };
    const result = injectSignatureToPDFData(data, revokedSig);

    // Revoked state must be visible in the export
    expect(result.content).toMatch(/revoked|철회/i);
  });
});
