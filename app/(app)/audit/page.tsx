// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #1, #7)
// Read-only audit log view for the external auditor persona.
// Filters: date range, event type, actor. Pagination: 50/page (AC #7).
// This page is client-rendered so auditors can filter without full reloads.

'use client';

import { AuditorWatermark } from '@/components/audit/AuditorWatermark';
import { HybridAuditStatus } from '@/components/audit/HybridAuditStatus';
import { useCallback, useEffect, useState } from 'react';
import { AuditPackageBuilder } from './AuditPackageBuilder';

interface AuditLogRow {
  id: string;
  timestamp: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  resourceType: string;
  resourceId: string;
  outcome: string;
}

interface ListResponse {
  rows: AuditLogRow[];
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const fetchPage = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (actionFilter) params.set('action', actionFilter);
        if (actorFilter) params.set('actorId', actorFilter);
        const res = await fetch(`/api/ra/audit-log?${params.toString()}`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as ListResponse;
        setRows(data.rows);
        setPage(data.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, actionFilter, actorFilter],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  return (
    <section className="mx-auto flex max-w-content flex-col gap-6 px-6 py-8">
      <AuditorWatermark />
      <header>
        <h1 className="font-serif text-3xl text-brand-800">Audit Log</h1>
        <p className="mt-2 text-sm text-ink-600">
          Read-only compliance trail. All access is logged.
        </p>
      </header>

      <AuditPackageBuilder />

      {/* Issue 201 — Hybrid RA audit status and export entry point */}
      <HybridAuditStatus />

      <form
        className="flex flex-wrap gap-3 rounded-lg border border-ink-150 bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void fetchPage(1);
        }}
      >
        <label className="flex flex-col text-xs text-ink-600">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-ink-600">
          To
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-ink-600">
          Event type
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. signature.applied"
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-ink-600">
          Actor
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="actor user id"
            className="mt-1 rounded border border-ink-150 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded bg-brand-700 px-4 py-1 text-sm text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-ink-150">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase text-ink-600">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                  No audit entries match the current filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-ink-100">
                <td className="px-3 py-2 text-xs text-ink-700">{row.timestamp}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-3 py-2 text-xs">{row.actorEmail ?? row.actorId ?? 'system'}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-mono">{row.resourceType}</span> / {row.resourceId}
                </td>
                <td className="px-3 py-2 text-xs">{row.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-600">
        <span>
          Page {page} · {PAGE_SIZE} per page
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-ink-150 px-3 py-1 disabled:opacity-50"
            onClick={() => void fetchPage(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-ink-150 px-3 py-1 disabled:opacity-50"
            onClick={() => void fetchPage(page + 1)}
            disabled={rows.length < PAGE_SIZE || loading}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
