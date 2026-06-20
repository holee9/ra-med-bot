// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #4, #5, #6)
// 1-click audit package builder. Auditor picks a date range and triggers ZIP
// generation; the browser downloads the resulting file directly.

'use client';

import { useState } from 'react';

interface DateRange {
  start: string;
  end: string;
}

export function AuditPackageBuilder() {
  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [range, setRange] = useState<DateRange>({ start: oneYearAgo, end: today });
  const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function generate() {
    setStatus('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ra/audit-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateRange: range }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-package-${range.start}_to_${range.end}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Generation failed');
    }
  }

  return (
    <div className="rounded-lg border border-ink-150 bg-surface p-4">
      <h2 className="text-sm font-medium text-ink-900">Audit Package</h2>
      <p className="mt-1 text-xs text-ink-600">
        Compile audit log, signed answers, citations, expert reviews, and compliance reports into a
        single ZIP with a SHA-256 manifest.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-ink-600">
          Start date
          <input
            type="date"
            value={range.start}
            onChange={(e) => setRange({ ...range, start: e.target.value })}
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-ink-600">
          End date
          <input
            type="date"
            value={range.end}
            onChange={(e) => setRange({ ...range, end: e.target.value })}
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          className="rounded bg-brand-700 px-4 py-1 text-sm text-white disabled:opacity-50"
          onClick={() => void generate()}
          disabled={status === 'generating'}
        >
          {status === 'generating' ? 'Generating…' : 'Generate package'}
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-xs text-danger">{errorMsg}</p>}
    </div>
  );
}
