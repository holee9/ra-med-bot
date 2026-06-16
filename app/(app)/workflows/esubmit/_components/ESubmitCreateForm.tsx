'use client';
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Dialog form to create a new submission package.

import { useState } from 'react';
import type { PackageSummary } from './ESubmitCard';

interface Props {
  onCreated: (pkg: PackageSummary) => void;
  onCancel: () => void;
}

const JURISDICTIONS = ['FDA', 'EU', 'MFDS', 'NMPA', 'PMDA'] as const;

const SUBMISSION_TYPES = [
  { value: '510k', label: '510(k) — Premarket Notification', jurisdictions: ['FDA'] },
  { value: 'de_novo', label: 'De Novo — FDA Classification', jurisdictions: ['FDA'] },
  { value: 'pma', label: 'PMA — Premarket Approval', jurisdictions: ['FDA'] },
  { value: 'cer', label: 'CER — Clinical Evaluation Report', jurisdictions: ['EU'] },
  { value: 'pccp', label: 'PCCP — Predetermined Change Control Plan', jurisdictions: ['FDA'] },
  { value: 'mfds_import', label: 'MFDS 수입 허가', jurisdictions: ['MFDS'] },
  { value: 'nmpa_ecdt', label: 'NMPA eCDT', jurisdictions: ['NMPA'] },
] as const;

export function ESubmitCreateForm({ onCreated, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    device_name: '',
    submission_type: '510k' as string,
    jurisdiction: 'FDA' as string,
    submission_number: '',
    version: '1.0',
  });

  // Auto-select jurisdiction when submission type changes
  const handleTypeChange = (type: string) => {
    const typeDef = SUBMISSION_TYPES.find((t) => t.value === type);
    const suggestedJurisdiction = typeDef?.jurisdictions[0] ?? 'FDA';
    setForm((prev) => ({
      ...prev,
      submission_type: type,
      jurisdiction: suggestedJurisdiction,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/ra/esubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: form.device_name,
          submission_type: form.submission_type,
          jurisdiction: form.jurisdiction,
          submission_number: form.submission_number || undefined,
          version: form.version,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? '패키지 생성에 실패했습니다.');
        return;
      }

      const data = (await res.json()) as { package: PackageSummary };
      onCreated(data.package);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6">
      <h2 className="mb-4 font-serif text-xl text-brand-800">새 제출 패키지</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Device name */}
        <div>
          <label htmlFor="device_name" className="mb-1 block text-sm font-medium text-ink-700">
            기기명 <span className="text-red-500">*</span>
          </label>
          <input
            id="device_name"
            type="text"
            required
            value={form.device_name}
            onChange={(e) => setForm((p) => ({ ...p, device_name: e.target.value }))}
            placeholder="예: SmartPatch Pro 2.0"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>

        {/* Submission type */}
        <div>
          <label htmlFor="submission_type" className="mb-1 block text-sm font-medium text-ink-700">
            제출 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id="submission_type"
            value={form.submission_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {SUBMISSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Jurisdiction */}
        <div>
          <label htmlFor="jurisdiction" className="mb-1 block text-sm font-medium text-ink-700">
            규제 기관 <span className="text-red-500">*</span>
          </label>
          <select
            id="jurisdiction"
            value={form.jurisdiction}
            onChange={(e) => setForm((p) => ({ ...p, jurisdiction: e.target.value }))}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>

        {/* Submission number (optional) */}
        <div>
          <label
            htmlFor="submission_number"
            className="mb-1 block text-sm font-medium text-ink-700"
          >
            제출 번호 <span className="text-ink-400 text-xs">(선택)</span>
          </label>
          <input
            id="submission_number"
            type="text"
            value={form.submission_number}
            onChange={(e) => setForm((p) => ({ ...p, submission_number: e.target.value }))}
            placeholder="예: K240001"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>

        {/* Version */}
        <div>
          <label htmlFor="version" className="mb-1 block text-sm font-medium text-ink-700">
            버전
          </label>
          <input
            id="version"
            type="text"
            value={form.version}
            onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '생성 중...' : '패키지 생성'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-ink-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
