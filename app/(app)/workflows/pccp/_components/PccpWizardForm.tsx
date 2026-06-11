'use client';
// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-025, REQ-PCCP-026)
// 4-step PCCP wizard: modification_description → sps_acp → impact_assessment → performance_testing

import { PCCP_STEPS, type PccpStep } from '@/lib/workflows/pccp/steps';
import { useState } from 'react';

const STEP_LABELS: Record<PccpStep, string> = {
  modification_description: 'Modification Description',
  sps_acp: 'SPS & ACP',
  impact_assessment: 'Impact Assessment',
  performance_testing: 'Performance Testing',
};

const STEP_DESCRIPTIONS: Record<PccpStep, string> = {
  modification_description: 'Describe the intended modification, its type, and expected benefits.',
  sps_acp:
    'Define Software Pre-Specifications (performance metrics, thresholds) and Algorithm Change Protocol (retraining triggers, evaluation).',
  impact_assessment:
    'Assess substantial equivalence across 5 dimensions: intended use, indications, technological characteristics, clinical safety, and user interface.',
  performance_testing:
    'Specify the testing protocol and acceptance criteria for validating the modified algorithm.',
};

export function PccpWizardForm() {
  const [currentStep, setCurrentStep] = useState<PccpStep>(PCCP_STEPS[0]);
  const stepIndex = PCCP_STEPS.indexOf(currentStep);

  return (
    <div className="flex flex-col gap-6">
      {/* Step progress */}
      <nav aria-label="PCCP steps" className="flex gap-2">
        {PCCP_STEPS.map((step, i) => {
          const isActive = step === currentStep;
          const isDone = PCCP_STEPS.indexOf(currentStep) > i;
          return (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(step)}
              className={[
                'flex-1 rounded border px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                  : isDone
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-ink-200 bg-white text-ink-500 hover:border-ink-400',
              ].join(' ')}
            >
              <span className="block text-xs text-ink-400">
                {i + 1} / {PCCP_STEPS.length}
              </span>
              {STEP_LABELS[step]}
            </button>
          );
        })}
      </nav>

      {/* Active step panel */}
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="font-serif text-xl text-brand-800">{STEP_LABELS[currentStep]}</h2>
        <p className="mt-1 text-sm text-ink-600">{STEP_DESCRIPTIONS[currentStep]}</p>

        <div className="mt-6 rounded bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          Form fields for this step will be implemented in the PCCP-002 milestone. API endpoints are
          live at <code>/api/ra/workflows/pccp</code>.
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setCurrentStep(PCCP_STEPS[stepIndex - 1]!)}
          className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={stepIndex === PCCP_STEPS.length - 1}
          onClick={() => setCurrentStep(PCCP_STEPS[stepIndex + 1]!)}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
