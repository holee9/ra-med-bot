/**
 * TDD RED: Tests for signature query helpers.
 * REQ-ESIG-001: Signature captures identity, timestamp, meaning.
 * REQ-ESIG-005: Revocation records signer with audit trail.
 */

import { describe, expect, it, vi } from 'vitest';
import { getActiveSignature, insertSignature, revokeSignature } from '../queries';

describe('getActiveSignature', () => {
  it('returns null when no active signature exists', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await getActiveSignature('msg-none', mockDb as never);
    expect(result).toBeNull();
  });

  it('returns the signature when an active one exists', async () => {
    const sig = {
      id: 'sig-001',
      messageId: 'msg-001',
      signerId: 'user-001',
      signerName: 'Alice',
      signerTitle: 'RA Lead',
      meaning: 'Approved',
      recordHash: 'abc123',
      signedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([sig]),
        }),
      }),
    };

    const result = await getActiveSignature('msg-001', mockDb as never);
    expect(result).toEqual(sig);
  });
});

describe('insertSignature', () => {
  it('inserts a new signature and returns the row', async () => {
    const newSig = {
      messageId: 'msg-001',
      signerId: 'user-001',
      signerName: 'Alice',
      signerTitle: 'RA Lead',
      meaning: 'Approved for regulatory submission',
      recordHash: 'deadbeef1234',
    };

    const inserted = {
      id: 'sig-new',
      ...newSig,
      signedAt: new Date(),
      revokedAt: null,
      revokedBy: null,
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([inserted]),
        }),
      }),
    };

    const result = await insertSignature(newSig, mockDb as never);
    expect(result.id).toBe('sig-new');
    expect(result.signerId).toBe('user-001');
  });
});

describe('revokeSignature', () => {
  it('sets revokedAt and revokedBy on the signature row', async () => {
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: 'sig-001', revokedAt: new Date(), revokedBy: 'user-002' }]),
          }),
        }),
      }),
    };

    const result = await revokeSignature('sig-001', 'user-002', mockDb as never);
    expect(result.revokedBy).toBe('user-002');
    expect(result.revokedAt).toBeInstanceOf(Date);
  });
});
