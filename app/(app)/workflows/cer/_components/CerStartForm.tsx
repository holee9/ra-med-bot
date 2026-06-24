'use client';

// @MX:NOTE [AUTO] CerStartForm — drives a CER run. Submits CerInput to
// POST /api/ra/workflows/cer, surfaces the appraised literature, and exports
// the assembled document via POST /api/ra/workflows/cer/export (docx | pdf).
// @MX:SPEC SPEC-REGULA-CER-001 + SPEC-REGULA-PMS-001 (AC-04 projectId persistence)
//
// Project selector: when a project is chosen the CER run is persisted to
// workflow_runs (workflowType='cer') so PMS report auto-linkage resolves.
// "No project" keeps the legacy ephemeral behavior (projectId omitted).

import { useProjects } from '@/lib/queries/useProjects';
import { type FormEvent, useState } from 'react';
import { type LiteratureItem, PubMedReview } from './PubMedReview';

interface CerRunResult {
  runId: string;
  literature: LiteratureItem[];
  literatureCount: number;
}

type ExportFormat = 'docx' | 'pdf';

const INPUT_CLASS = 'border border-ink-200 rounded-md px-3 py-2 text-sm w-full';
const PRIMARY_BTN =
  'bg-brand-700 text-white hover:bg-brand-800 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN =
  'rounded-md border border-brand-300 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60';

export function CerStartForm() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [pubmedQuery, setPubmedQuery] = useState('');
  const [deviceDescription, setDeviceDescription] = useState('');
  const [intendedUse, setIntendedUse] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CerRunResult | null>(null);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    setExportError(null);

    try {
      const response = await fetch('/api/ra/workflows/cer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName,
          manufacturer,
          pubmedQuery,
          ...(projectId ? { projectId } : {}),
          ...(deviceDescription ? { deviceDescription } : {}),
          ...(intendedUse ? { intendedUse } : {}),
        }),
      });

      if (!response.ok) {
        setError('Failed to start the CER run. Please check your input and try again.');
        return;
      }

      const data = (await response.json()) as CerRunResult;
      setResult(data);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport(format: ExportFormat) {
    if (!result) {
      return;
    }
    setExporting(format);
    setExportError(null);

    try {
      const response = await fetch('/api/ra/workflows/cer/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cerRunId: result.runId,
          format,
          deviceName,
          manufacturer,
        }),
      });

      if (!response.ok) {
        setExportError(`Failed to export ${format.toUpperCase()}.`);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `CER_${deviceName || 'device'}_${result.runId}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(`A network error occurred while exporting ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-surface p-5"
      >
        <h2 className="font-serif text-lg text-ink-900">Start a new CER run</h2>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-project" className="text-sm font-medium text-ink-700">
            Project <span className="text-ink-400">(optional — link to PMS report)</span>
          </label>
          <select
            id="cer-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={projectsLoading}
            className={INPUT_CLASS}
          >
            <option value="">
              {projectsLoading ? 'Loading projects…' : 'No project (ephemeral run)'}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-device-name" className="text-sm font-medium text-ink-700">
            Device name
          </label>
          <input
            id="cer-device-name"
            type="text"
            required
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-manufacturer" className="text-sm font-medium text-ink-700">
            Manufacturer
          </label>
          <input
            id="cer-manufacturer"
            type="text"
            required
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-pubmed-query" className="text-sm font-medium text-ink-700">
            PubMed query
          </label>
          <textarea
            id="cer-pubmed-query"
            required
            rows={2}
            value={pubmedQuery}
            onChange={(e) => setPubmedQuery(e.target.value)}
            placeholder="e.g., cardiac stent biocompatibility ISO 10993"
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-device-description" className="text-sm font-medium text-ink-700">
            Device description <span className="text-ink-400">(optional)</span>
          </label>
          <textarea
            id="cer-device-description"
            rows={2}
            value={deviceDescription}
            onChange={(e) => setDeviceDescription(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cer-intended-use" className="text-sm font-medium text-ink-700">
            Intended use <span className="text-ink-400">(optional)</span>
          </label>
          <textarea
            id="cer-intended-use"
            rows={2}
            value={intendedUse}
            onChange={(e) => setIntendedUse(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={`${PRIMARY_BTN} self-start`}>
          {submitting ? 'Starting…' : 'Start CER run'}
        </button>
      </form>

      {result ? (
        <div className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-surface p-5">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-lg text-ink-900">CER run started</h2>
            <p className="text-sm text-ink-600">
              Run ID <span className="font-mono text-ink-700">{result.runId}</span> —{' '}
              {result.literatureCount} articles found.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleExport('docx')}
              disabled={exporting !== null}
              className={SECONDARY_BTN}
            >
              {exporting === 'docx' ? 'Preparing…' : 'Download DOCX'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className={SECONDARY_BTN}
            >
              {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>

          {exportError ? (
            <p role="alert" className="text-sm text-danger">
              {exportError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <h3 className="font-serif text-base text-ink-900">Literature review</h3>
            <PubMedReview literature={result.literature} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
