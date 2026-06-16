'use client';

import type { ApplicableStandard } from '@/lib/standards/applicability-engine';
import { useState } from 'react';

interface StandardsResult {
  standards: ApplicableStandard[];
  totalCount: number;
}

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function CheckboxField({ id, label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-brand-700"
      />
      {label}
    </label>
  );
}

export function StandardsForm() {
  const [deviceTypeKey, setDeviceTypeKey] = useState('general_device');
  const [regulatoryPathway, setRegulatoryPathway] = useState('fda_510k');
  const [hasSoftware, setHasSoftware] = useState(false);
  const [isElectrical, setIsElectrical] = useState(false);
  const [isSterile, setIsSterile] = useState(false);
  const [usesAnimalTissue, setUsesAnimalTissue] = useState(false);
  const [result, setResult] = useState<StandardsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ra/standards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceTypeKey,
          regulatoryPathway,
          hasSoftware,
          isElectrical,
          isSterile,
          usesAnimalTissue,
        }),
      });
      if (!res.ok) throw new Error('Standards lookup failed');
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="deviceTypeKey" className="text-sm font-medium text-ink-700">
              Device Type
            </label>
            <select
              id="deviceTypeKey"
              value={deviceTypeKey}
              onChange={(e) => setDeviceTypeKey(e.target.value)}
              className="rounded border border-border bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="general_device">General Device</option>
              <option value="electrical_medical_device">Electrical Medical Device</option>
              <option value="software_only">Software Only (SaMD)</option>
              <option value="sterile_device">Sterile Device</option>
              <option value="in_vitro_diagnostic">In Vitro Diagnostic (IVD)</option>
              <option value="active_implantable">Active Implantable</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="regulatoryPathway" className="text-sm font-medium text-ink-700">
              Regulatory Pathway
            </label>
            <select
              id="regulatoryPathway"
              value={regulatoryPathway}
              onChange={(e) => setRegulatoryPathway(e.target.value)}
              className="rounded border border-border bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="fda_510k">FDA 510(k)</option>
              <option value="fda_pma">FDA PMA</option>
              <option value="eu_mdr_class_i">EU MDR Class I</option>
              <option value="eu_mdr_class_ii">EU MDR Class II</option>
              <option value="eu_mdr_class_iii">EU MDR Class III</option>
              <option value="all">All Pathways</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-5">
          <CheckboxField
            id="hasSoftware"
            label="Contains Software"
            checked={hasSoftware}
            onChange={setHasSoftware}
          />
          <CheckboxField
            id="isElectrical"
            label="Electrical Device"
            checked={isElectrical}
            onChange={setIsElectrical}
          />
          <CheckboxField
            id="isSterile"
            label="Sterile Device"
            checked={isSterile}
            onChange={setIsSterile}
          />
          <CheckboxField
            id="usesAnimalTissue"
            label="Uses Animal Tissue"
            checked={usesAnimalTissue}
            onChange={setUsesAnimalTissue}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {loading ? 'Analyzing...' : 'Find Applicable Standards'}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-500">{result.totalCount} applicable standards found</p>
          {result.standards.map((s) => (
            <div
              key={s.standardNumber}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.standardNumber}</p>
                  <p className="mt-0.5 text-sm text-ink-600">{s.title}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {s.fdaRecognized && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs font-medium text-ink-700">
                      FDA
                    </span>
                  )}
                  {s.euHarmonized && (
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs font-medium text-ink-700">
                      EU
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      s.isMandatory ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {s.isMandatory ? 'Mandatory' : 'Recommended'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-ink-500">{s.applicabilityReason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
