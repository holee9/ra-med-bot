'use client';
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001~020)
// Multi-jurisdiction device classification wizard with SSE streaming.

import type {
  ClassificationResult,
  JurisdictionResult,
} from '@/lib/classification/classification-engine';
import { useState } from 'react';

type DeviceType = 'active' | 'non_active' | 'software_only' | 'ivd' | 'implantable';
type ContactType = 'no_contact' | 'external' | 'internal' | 'implant';

interface FormState {
  deviceDescription: string;
  deviceType: DeviceType | '';
  contactType: ContactType | '';
  hasSoftware: boolean;
  hasAiMl: boolean;
  isSterile: boolean;
}

interface StreamEvent {
  event: 'parsing' | 'classifying' | 'result' | 'error' | 'done';
  message?: string;
  classification?: ClassificationResult;
  classificationId?: string;
}

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  active: 'Active Device',
  non_active: 'Non-Active Device',
  software_only: 'Software Only (SaMD)',
  ivd: 'In Vitro Diagnostic (IVD)',
  implantable: 'Implantable',
};

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  no_contact: 'No Patient Contact',
  external: 'External (skin contact)',
  internal: 'Internal (body cavity)',
  implant: 'Implantable',
};

function JurisdictionCard({ result }: { result: JurisdictionResult }) {
  const isHighRisk =
    result.deviceClass === 'III' || result.deviceClass === 'IIb' || result.deviceClass === '4';

  return (
    <div
      className={[
        'rounded-lg border p-4',
        isHighRisk ? 'border-red-200 bg-red-50' : 'border-ink-200 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">{result.jurisdiction}</span>
        <span
          className={[
            'rounded px-2 py-0.5 text-xs font-bold',
            isHighRisk ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-700',
          ].join(' ')}
        >
          Class {result.deviceClass}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        Pathway: <span className="font-medium">{result.pathway}</span>
        {result.rule ? ` — ${result.rule}` : ''}
      </p>
      {result.requiresNotifiedBody && (
        <p className="mt-1 text-xs font-medium text-amber-700">Requires Notified Body</p>
      )}
      <p className="mt-2 text-xs text-ink-600 leading-relaxed">{result.rationale}</p>
    </div>
  );
}

export function ClassificationWizard() {
  const [form, setForm] = useState<FormState>({
    deviceDescription: '',
    deviceType: '',
    contactType: '',
    hasSoftware: false,
    hasAiMl: false,
    isSterile: false,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [classificationId, setClassificationId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceDescription || form.deviceDescription.length < 10) return;

    setStatus('loading');
    setResult(null);
    setClassificationId(null);
    setStatusMessage('Starting classification...');

    try {
      const response = await fetch('/api/ra/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceDescription: form.deviceDescription,
          deviceType: form.deviceType || undefined,
          contactType: form.contactType || undefined,
          hasSoftware: form.hasSoftware,
          hasAiMl: form.hasAiMl,
          isSterile: form.isSterile,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            if (event.event === 'parsing' || event.event === 'classifying') {
              setStatusMessage(event.message ?? '');
            } else if (event.event === 'result') {
              setResult(event.classification ?? null);
              setClassificationId(event.classificationId ?? null);
            } else if (event.event === 'done') {
              setStatus('done');
            } else if (event.event === 'error') {
              setStatus('error');
              setStatusMessage(event.message ?? 'Classification failed');
            }
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setResult(null);
    setClassificationId(null);
    setStatusMessage('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="font-serif text-xl text-brand-800">Device Information</h2>
        <p className="mt-1 text-sm text-ink-600">
          Describe your device. The AI will extract classification characteristics automatically.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700" htmlFor="deviceDescription">
              Device Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="deviceDescription"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
              placeholder="Describe the medical device, its intended use, patient contact, and any software or AI/ML components..."
              value={form.deviceDescription}
              onChange={(e) => setForm((f) => ({ ...f, deviceDescription: e.target.value }))}
            />
          </div>

          {/* Optional overrides */}
          <details className="rounded border border-ink-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-700">
              Manual Classification Overrides (optional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-600" htmlFor="deviceType">
                  Device Type
                </label>
                <select
                  id="deviceType"
                  className="mt-1 w-full rounded border border-ink-300 px-2 py-1.5 text-sm text-ink-800"
                  value={form.deviceType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deviceType: e.target.value as DeviceType | '' }))
                  }
                >
                  <option value="">Auto-detect</option>
                  {(Object.entries(DEVICE_TYPE_LABELS) as [DeviceType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600" htmlFor="contactType">
                  Contact Type
                </label>
                <select
                  id="contactType"
                  className="mt-1 w-full rounded border border-ink-300 px-2 py-1.5 text-sm text-ink-800"
                  value={form.contactType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactType: e.target.value as ContactType | '' }))
                  }
                >
                  <option value="">Auto-detect</option>
                  {(Object.entries(CONTACT_TYPE_LABELS) as [ContactType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-6">
              {(['hasSoftware', 'hasAiMl', 'isSterile'] as const).map((field) => (
                <label key={field} className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))}
                    className="rounded border-ink-300"
                  />
                  {field === 'hasSoftware'
                    ? 'Has Software'
                    : field === 'hasAiMl'
                      ? 'Has AI/ML'
                      : 'Is Sterile'}
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={status === 'loading' || form.deviceDescription.length < 10}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {status === 'loading' ? 'Classifying...' : 'Classify Device'}
          </button>
          {(status === 'done' || status === 'error') && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              Reset
            </button>
          )}
        </div>

        {/* Loading status */}
        {status === 'loading' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-brand-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            {statusMessage}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="mt-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {statusMessage}
          </div>
        )}
      </form>

      {/* Classification results */}
      {result && status === 'done' && (
        <div className="flex flex-col gap-4">
          {classificationId && (
            <p className="text-xs text-ink-400">
              Classification ID: <code className="font-mono">{classificationId}</code>
            </p>
          )}

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
            <h2 className="font-serif text-lg text-brand-800">Classification Results</h2>
            <p className="mt-1 text-xs text-ink-500">
              Deterministic rules based on FDA 21 CFR, EU MDR 2017/745, MFDS (의료기기법), NMPA
              分类, and PMDA 薬機法
            </p>
          </div>

          {/* 5-jurisdiction grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <JurisdictionCard result={result.fda} />
            <JurisdictionCard result={result.eu} />
            <JurisdictionCard result={result.mfds} />
            <JurisdictionCard result={result.nmpa} />
            <JurisdictionCard result={result.pmda} />
          </div>

          {/* Applicable standards */}
          {result.applicableStandardTypes.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <h3 className="text-sm font-medium text-ink-700">Applicable Standards</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {result.applicableStandardTypes.map((standard) => (
                  <li
                    key={standard}
                    className="rounded bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                  >
                    {standard}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
