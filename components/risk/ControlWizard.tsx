'use client';
// @MX:NOTE [AUTO] 3-tier control selection wizard per ISO 14971 §7.1.
// Enforces: information tier requires rationale before adoption.
// @MX:SPEC SPEC-REGULA-RISK-001 (T4.3, REQ-RISK-021~027)

import { useState } from 'react';
import { validateControlHierarchy, type ControlTier } from '@/lib/risk/control-recommendation';

interface ControlCandidate {
  id: string;
  tier: ControlTier;
  description: string;
  rationale: string | null;
}

interface ControlWizardProps {
  riskItemId: string;
  candidates: ControlCandidate[];
  onAdopt: (control: ControlCandidate & { rationale: string | null; alarpJustification?: string }) => void;
  disabled?: boolean;
}

const TIER_ORDER: ControlTier[] = ['inherent', 'protective', 'information'];

const TIER_LABELS: Record<ControlTier, string> = {
  inherent: 'Inherent Safety Design',
  protective: 'Protective Measures',
  information: 'Information for Safety',
};

const TIER_DESCRIPTIONS: Record<ControlTier, string> = {
  inherent: 'Eliminate or reduce risk through design changes (highest priority)',
  protective: 'Add protective devices, safeguards, or alarms',
  information: 'Warn users via labels, IFU, or training (last resort — requires rationale)',
};

export function ControlWizard({ riskItemId, candidates, onAdopt, disabled = false }: ControlWizardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedControl = candidates.find((c) => c.id === selected);

  function handleAdopt() {
    if (!selectedControl) return;
    setError(null);

    try {
      validateControlHierarchy(selectedControl.tier, rationale || undefined);
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    onAdopt({
      ...selectedControl,
      rationale: rationale || selectedControl.rationale,
    });
    setSelected(null);
    setRationale('');
  }

  const groupedByTier = TIER_ORDER.map((tier) => ({
    tier,
    controls: candidates.filter((c) => c.tier === tier),
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 mb-2">
        Risk Item: <span className="font-mono text-gray-700">{riskItemId}</span>
      </div>

      {groupedByTier.map(({ tier, controls }) => (
        <div key={tier} className="border rounded-md p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
              {TIER_LABELS[tier]}
            </span>
            {tier === 'information' && (
              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                Requires Rationale
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2">{TIER_DESCRIPTIONS[tier]}</p>

          {controls.length === 0 ? (
            <p className="text-xs text-gray-300 italic">No candidates for this tier</p>
          ) : (
            <div className="space-y-1">
              {controls.map((control) => (
                <label key={control.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="selected-control"
                    value={control.id}
                    checked={selected === control.id}
                    onChange={() => {
                      setSelected(control.id);
                      setError(null);
                      if (tier !== 'information') setRationale('');
                    }}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <span className="text-sm">{control.description}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {selectedControl?.tier === 'information' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rationale (required for information controls — ISO 14971 §7.1)
          </label>
          <textarea
            className="w-full border rounded p-2 text-sm min-h-[80px] focus:ring-1 focus:ring-blue-400"
            placeholder="Explain why inherent safety design and protective measures are insufficient..."
            value={rationale}
            onChange={(e) => {
              setRationale(e.target.value);
              setError(null);
            }}
            disabled={disabled}
          />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      <button
        onClick={handleAdopt}
        disabled={!selected || disabled}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
      >
        Adopt Control Measure
      </button>
    </div>
  );
}

export default ControlWizard;
