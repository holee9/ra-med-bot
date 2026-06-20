// @MX:NOTE [AUTO] PDF signature injection utility.
//            Appends §11.50 signature block to PDF export content.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-008)

export interface PDFSignatureData {
  id: string;
  signerName: string;
  signerTitle: string | null;
  meaning: string;
  signedAt: Date;
  recordHash: string;
  revokedAt: Date | null;
}

interface PDFData {
  content: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Appends a §11.50 electronic signature block to the PDF data content.
 * If no signature is provided, returns data unchanged.
 *
 * The signature block includes:
 * - Signer name and title (§11.50 identity)
 * - Signing meaning (§11.50 purpose)
 * - Timestamp
 * - SHA-256 record hash (§11.70 linking)
 * - Revocation status if applicable
 */
export function injectSignatureToPDFData(data: PDFData, signature: PDFSignatureData | null): PDFData {
  if (!signature) {
    return data;
  }

  const isRevoked = signature.revokedAt !== null;
  const signedDate = signature.signedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const lines: string[] = [
    '',
    '---',
    '## 전자서명 / Electronic Signature (21 CFR Part 11 §11.50)',
    '',
    `서명자 / Signer: ${signature.signerName}${signature.signerTitle ? ` (${signature.signerTitle})` : ''}`,
    `서명 의미 / Meaning: ${signature.meaning}`,
    `서명 일시 / Signed At: ${signedDate}`,
    `기록 해시 / Record Hash (SHA-256): ${signature.recordHash}`,
  ];

  if (isRevoked) {
    const revokedDate = (signature.revokedAt as Date).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    lines.push(`상태 / Status: 철회됨 (Revoked) at ${revokedDate}`);
  }

  const signatureBlock = lines.join('\n');

  return {
    ...data,
    content: data.content + signatureBlock,
  };
}
