// @vitest-environment jsdom
/**
 * TDD RED: Tests for SignatureManifestation component.
 * REQ-ESIG-004: §11.50 signature manifestation visible in UI.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignatureManifestation } from '../SignatureManifestation';

const mockSignature = {
  id: 'sig-001',
  signerName: 'Alice Lead',
  signerTitle: 'RA Lead',
  meaning: 'Approved for regulatory submission',
  signedAt: '2026-06-20T10:00:00Z',
  recordHash: 'deadbeef1234',
  isRevoked: false,
  revokedAt: null,
};

describe('SignatureManifestation', () => {
  it('renders signer name (§11.50 requirement)', () => {
    render(<SignatureManifestation signature={mockSignature} />);
    expect(screen.getByText('Alice Lead')).toBeInTheDocument();
  });

  it('renders signer title (§11.50 requirement)', () => {
    render(<SignatureManifestation signature={mockSignature} />);
    expect(screen.getByText('RA Lead')).toBeInTheDocument();
  });

  it('renders signature meaning (§11.50 requirement)', () => {
    render(<SignatureManifestation signature={mockSignature} />);
    expect(screen.getByText('Approved for regulatory submission')).toBeInTheDocument();
  });

  it('renders signed date', () => {
    render(<SignatureManifestation signature={mockSignature} />);
    // Date should be visible in some human-readable form
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows revoked state with visual indicator when isRevoked=true', () => {
    const revokedSig = {
      ...mockSignature,
      isRevoked: true,
      revokedAt: '2026-06-21T10:00:00Z',
    };
    render(<SignatureManifestation signature={revokedSig} />);
    expect(screen.getByText(/revoked|철회/i)).toBeInTheDocument();
  });

  it('does not show revoked indicator when isRevoked=false', () => {
    render(<SignatureManifestation signature={mockSignature} />);
    expect(screen.queryByText(/revoked|철회/i)).not.toBeInTheDocument();
  });
});
