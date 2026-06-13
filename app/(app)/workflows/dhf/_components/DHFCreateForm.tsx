'use client';
// @MX:SPEC SPEC-REGULA-DHF-001
// Dialog form to create a new Design History File.

import { useState } from 'react';
import type { DHFSummary } from './DHFCard';

interface Props {
  onCreated: (dhf: DHFSummary) => void;
  onCancel: () => void;
}

const JURISDICTIONS = ['FDA', 'EU', 'MFDS', 'NMPA', 'PMDA'] as const;
const FRAMEWORKS = [
  { value: 'QSR_QMSR', label: 'QSR/QMSR (21 CFR 820)' },
  { value: 'ISO_13485', label: 'ISO 13485' },
  { value: 'EU_MDR', label: 'EU MDR' },
] as const;

export function DHFCreateForm({ onCreated, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    device_name: '',
    device_model: '',
    intended_use: '',
    jurisdiction: 'FDA' as string,
    regulatory_framework: 'QSR_QMSR' as string,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/ra/dhf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: form.device_name,
          device_model: form.device_model || undefined,
          intended_use: form.intended_use,
          jurisdiction: form.jurisdiction,
          regulatory_framework: form.regulatory_framework,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Failed to create DHF');
        return;
      }

      const data = await res.json() as { dhf: DHFSummary };
      onCreated(data.dhf);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6">
      <h2 className="mb-4 font-serif text-xl text-brand-800">New Design History File</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-700" htmlFor="device_name">
              Device Name <span className="text-red-500">*</span>
            </label>
            <input
              id="device_name"
              type="text"
              required
              value={form.device_name}
              onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))}
              className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="e.g. Cardiac Monitor X200"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-700" htmlFor="device_model">
              Device Model
            </label>
            <input
              id="device_model"
              type="text"
              value={form.device_model}
              onChange={(e) => setForm((f) => ({ ...f, device_model: e.target.value }))}
              className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="Optional model number"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-700" htmlFor="intended_use">
            Intended Use <span className="text-red-500">*</span>
          </label>
          <textarea
            id="intended_use"
            required
            value={form.intended_use}
            onChange={(e) => setForm((f) => ({ ...f, intended_use: e.target.value }))}
            rows={3}
            className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
            placeholder="Describe the intended use and indications for use..."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-700" htmlFor="jurisdiction">
              Jurisdiction
            </label>
            <select
              id="jurisdiction"
              value={form.jurisdiction}
              onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
              className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none bg-white"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-700" htmlFor="regulatory_framework">
              Regulatory Framework
            </label>
            <select
              id="regulatory_framework"
              value={form.regulatory_framework}
              onChange={(e) => setForm((f) => ({ ...f, regulatory_framework: e.target.value }))}
              className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none bg-white"
            >
              {FRAMEWORKS.map((fw) => (
                <option key={fw.value} value={fw.value}>{fw.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create DHF'}
          </button>
        </div>
      </form>
    </div>
  );
}
