'use client';

// @MX:NOTE [AUTO] Evidence packet export buttons — PDF + Markdown.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)
//
// Calls GET /api/traceability/[deliverableId]/export?format= and triggers a
// browser download via a Blob URL. The server audits every export
// (21 CFR Part 11 — traceability.packet_exported), so the client just needs to
// surface success/failure.

import { exportPacket } from '@/lib/traceability/client';
import { useState } from 'react';

interface PacketExportProps {
  deliverableId: string;
}

type Busy = { format: 'pdf' | 'md' } | null;

export function PacketExport({ deliverableId }: PacketExportProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(format: 'pdf' | 'md') {
    setBusy({ format });
    setError(null);
    try {
      await exportPacket(deliverableId, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HTTP 오류');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2" aria-label="근거 패킷 내보내기">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void run('pdf')}
          disabled={busy !== null}
          className="rounded-md border border-ink-150 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="PDF로 근거 패킷 내보내기"
          data-testid="packet-export-pdf"
        >
          {busy?.format === 'pdf' ? '생성 중…' : 'PDF 내보내기'}
        </button>
        <button
          type="button"
          onClick={() => void run('md')}
          disabled={busy !== null}
          className="rounded-md border border-ink-150 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="Markdown으로 근거 패킷 내보내기"
          data-testid="packet-export-md"
        >
          {busy?.format === 'md' ? '생성 중…' : 'Markdown 내보내기'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-danger" role="alert" data-testid="packet-export-error">
          내보내기 실패: {error}
        </p>
      )}
    </div>
  );
}
