'use client';

// @MX:NOTE [AUTO] SignatureManifestation — 21 CFR Part 11 §11.50 UI component.
//            Displays electronic signature identity, meaning, and timestamp.
// @MX:SPEC SPEC-REGULA-ESIG-001 (REQ-ESIG-004)

import { ShieldCheck, ShieldOff } from 'lucide-react';

export interface SignatureManifestationData {
  id: string;
  signerName: string;
  signerTitle: string | null;
  meaning: string;
  signedAt: string;
  recordHash: string;
  isRevoked: boolean;
  revokedAt: string | null;
}

interface Props {
  signature: SignatureManifestationData;
}

/**
 * Renders the §11.50 signature manifestation banner.
 * Shows signer identity, title, meaning, and timestamp in a clear visual format.
 */
export function SignatureManifestation({ signature }: Props) {
  const signedDate = new Date(signature.signedAt).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section
      aria-label="전자서명 정보"
      className={`rounded-md border px-4 py-3 text-sm ${
        signature.isRevoked
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {signature.isRevoked ? (
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        )}
        <div className="flex-1 space-y-0.5">
          {signature.isRevoked && (
            <p className="font-semibold uppercase tracking-wide text-red-600">철회됨 / Revoked</p>
          )}
          <p className="font-medium">{signature.signerName}</p>
          {signature.signerTitle && <p className="text-xs opacity-80">{signature.signerTitle}</p>}
          <p className="mt-1 italic">{signature.meaning}</p>
          <p className="mt-1 text-xs opacity-70">서명일시: {signedDate}</p>
        </div>
      </div>
    </section>
  );
}
