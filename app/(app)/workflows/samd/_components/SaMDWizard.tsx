'use client';
// @MX:SPEC SPEC-REGULA-SAMD-001
// 5-step SaMD regulatory pathway wizard.
// Step 1: Device Description → Step 2: AI/ML Type → Step 3: IMDRF Matrix
// → Step 4: Results → Step 5: Generate Package

import {
  computeImdrfCategory,
  deriveEuAiRiskLevel,
  deriveFdaPathway,
  isPccpRequired,
} from '@/lib/samd/imdrf-matrix';
import type {
  AiMlType,
  ImdrfClinicalSituation,
  ImdrfHealthcareSituation,
} from '@/lib/samd/imdrf-matrix';
import { useState } from 'react';

// @MX:NOTE [AUTO] IMDRF matrix labels — mirrors imdrf-matrix.ts values.
const CLINICAL_OPTIONS: { value: ImdrfClinicalSituation; label: string; description: string }[] = [
  {
    value: 'critical',
    label: 'Critical',
    description: 'State of irreversible deterioration; treatment/action needed immediately',
  },
  {
    value: 'serious',
    label: 'Serious',
    description: 'Non-critical deterioration; treatment/action needed within minutes/hours',
  },
  {
    value: 'non_serious',
    label: 'Non-Serious',
    description: 'No immediate action needed; intervention can be deferred',
  },
];

const HEALTHCARE_OPTIONS: {
  value: ImdrfHealthcareSituation;
  label: string;
  description: string;
}[] = [
  {
    value: 'critical',
    label: 'Critical',
    description: 'Automated treatment or diagnosis with no human oversight',
  },
  {
    value: 'serious',
    label: 'Serious',
    description: 'Informs clinician with time-critical decision urgency',
  },
  {
    value: 'non_serious',
    label: 'Non-Serious',
    description: 'Informs clinician; no time-critical urgency',
  },
];

const AI_ML_OPTIONS: { value: AiMlType; label: string; description: string }[] = [
  {
    value: 'locked',
    label: 'Locked',
    description: 'Algorithm does not change after deployment. No PCCP required.',
  },
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Adapts between training periods or in deployment. PCCP required.',
  },
  {
    value: 'continuously_learning',
    label: 'Continuously Learning',
    description: 'Continuously updates its algorithm from new data. PCCP required.',
  },
];

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  I: 'Lowest risk — informing clinical management in non-serious situations',
  II: 'Moderate risk — driving or informing clinical management in serious situations',
  III: 'High risk — driving clinical management in critical or serious situations',
  IV: 'Highest risk — driving clinical management in critical situations',
};

const EU_RISK_DESCRIPTIONS: Record<string, string> = {
  minimal: 'Minimal risk under EU AI Act — standard conformity assessment',
  general_purpose: 'General purpose AI — transparency and documentation requirements',
  high_risk: 'High-risk AI system — conformity assessment + Annex IV technical documentation',
  prohibited: 'Prohibited AI practice under Article 5 of the EU AI Act',
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface WizardFormData {
  title: string;
  deviceDescription: string;
  intendedUse: string;
  aiMlType: AiMlType | '';
  clinicalSituation: ImdrfClinicalSituation | '';
  healthcareSituation: ImdrfHealthcareSituation | '';
}

interface SaMDAssessment {
  id: string;
  title: string;
  aiMlType: string;
  imdrfCategory: string | null;
  fdaPathway: string | null;
  euAiRiskLevel: string | null;
  pccpRequired: boolean;
  status: string;
  createdAt: string;
}

interface SaMDWizardProps {
  onCreated: (assessment: SaMDAssessment) => void;
  onCancel: () => void;
}

export function SaMDWizard({ onCreated, onCancel }: SaMDWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardFormData>({
    title: '',
    deviceDescription: '',
    intendedUse: '',
    aiMlType: '',
    clinicalSituation: '',
    healthcareSituation: '',
  });
  const [createdAssessment, setCreatedAssessment] = useState<SaMDAssessment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Computed classification (shown in step 3+)
  const classification =
    formData.clinicalSituation && formData.healthcareSituation && formData.aiMlType
      ? (() => {
          const category = computeImdrfCategory(
            formData.clinicalSituation as ImdrfClinicalSituation,
            formData.healthcareSituation as ImdrfHealthcareSituation,
          );
          return {
            category,
            euRisk: deriveEuAiRiskLevel(category),
            fdaPathway: deriveFdaPathway(formData.aiMlType as AiMlType, category),
            pccpRequired: isPccpRequired(formData.aiMlType as AiMlType),
          };
        })()
      : null;

  const canAdvance = () => {
    if (step === 1)
      return (
        formData.title.length > 0 &&
        formData.deviceDescription.length >= 10 &&
        formData.intendedUse.length >= 10
      );
    if (step === 2) return formData.aiMlType !== '';
    if (step === 3) return formData.clinicalSituation !== '' && formData.healthcareSituation !== '';
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/ra/samd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          device_description: formData.deviceDescription,
          intended_use: formData.intendedUse,
          ai_ml_type: formData.aiMlType,
          imdrf_clinical_situation: formData.clinicalSituation,
          imdrf_healthcare_situation: formData.healthcareSituation,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Failed to create assessment');
      }
      const data = await res.json();
      setCreatedAssessment(data.assessment);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!createdAssessment) return;
    setGenerating(true);
    setGenerateProgress([]);
    setError(null);

    try {
      const res = await fetch(`/api/ra/samd/${createdAssessment.id}/generate`, {
        method: 'POST',
      });

      if (!res.ok || !res.body) {
        throw new Error('Generation request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.message) {
                setGenerateProgress((prev) => [...prev, payload.message as string]);
              }
              if (payload.step === 'error') {
                setError(payload.message as string);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      setGenerateProgress((prev) => [...prev, 'Package generated successfully.']);
      if (createdAssessment) {
        onCreated(createdAssessment);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const STEPS = [
    { num: 1, label: 'Device' },
    { num: 2, label: 'AI/ML Type' },
    { num: 3, label: 'IMDRF Matrix' },
    { num: 4, label: 'Results' },
    { num: 5, label: 'Generate' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Step nav */}
      <nav aria-label="SaMD wizard steps" className="flex gap-2">
        {STEPS.map(({ num, label }) => {
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div
              key={num}
              className={[
                'flex-1 rounded border px-3 py-2 text-sm text-center',
                isActive
                  ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                  : isDone
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-ink-200 bg-white text-ink-400',
              ].join(' ')}
            >
              <span className="block text-xs opacity-60">
                {num} / {STEPS.length}
              </span>
              {label}
            </div>
          );
        })}
      </nav>

      {/* Step content */}
      <div className="rounded-lg border border-ink-200 bg-white p-6">
        {/* Step 1: Device Description */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-brand-800">Device Description</h2>
            <p className="text-sm text-ink-600">
              Describe your AI/ML-enabled medical device and its intended clinical use.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-700">Title *</span>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. AI-Assisted Retinal Screening Device"
                className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-700">Device Description *</span>
              <textarea
                value={formData.deviceDescription}
                onChange={(e) => setFormData((p) => ({ ...p, deviceDescription: e.target.value }))}
                placeholder="Describe the device, its AI/ML function, outputs, and clinical context..."
                rows={4}
                className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-700">Intended Use *</span>
              <textarea
                value={formData.intendedUse}
                onChange={(e) => setFormData((p) => ({ ...p, intendedUse: e.target.value }))}
                placeholder="State the intended use population, clinical condition, and how the output is used..."
                rows={3}
                className="rounded border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
              />
            </label>
          </div>
        )}

        {/* Step 2: AI/ML Type */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-brand-800">AI/ML Classification Type</h2>
            <p className="text-sm text-ink-600">
              Select the AI/ML modification type per FDA AI/ML Final Guidance (April 2024).
            </p>
            <div className="flex flex-col gap-3">
              {AI_ML_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                    formData.aiMlType === opt.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-ink-200 hover:border-ink-400',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="aiMlType"
                    value={opt.value}
                    checked={formData.aiMlType === opt.value}
                    onChange={() => setFormData((p) => ({ ...p, aiMlType: opt.value }))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-sm text-ink-900">{opt.label}</p>
                    <p className="text-xs text-ink-500 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: IMDRF Matrix */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <h2 className="font-serif text-xl text-brand-800">IMDRF N12 Situation Matrix</h2>
            <p className="text-sm text-ink-600">
              Select the clinical situation and healthcare situation to determine the IMDRF N12 risk
              category.
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-800">Clinical Situation</h3>
                <p className="mb-3 text-xs text-ink-500">
                  Severity of patient condition if device fails or gives wrong output.
                </p>
                <div className="flex flex-col gap-2">
                  {CLINICAL_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={[
                        'flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors',
                        formData.clinicalSituation === opt.value
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-ink-200 hover:border-ink-400',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="clinical"
                        value={opt.value}
                        checked={formData.clinicalSituation === opt.value}
                        onChange={() =>
                          setFormData((p) => ({ ...p, clinicalSituation: opt.value }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-ink-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-800">Healthcare Situation</h3>
                <p className="mb-3 text-xs text-ink-500">
                  Role of AI/ML output in the clinical decision pathway.
                </p>
                <div className="flex flex-col gap-2">
                  {HEALTHCARE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={[
                        'flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors',
                        formData.healthcareSituation === opt.value
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-ink-200 hover:border-ink-400',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="healthcare"
                        value={opt.value}
                        checked={formData.healthcareSituation === opt.value}
                        onChange={() =>
                          setFormData((p) => ({ ...p, healthcareSituation: opt.value }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-ink-500">{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Live computed category */}
            {classification && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
                <p className="text-sm font-semibold text-brand-800">
                  Computed IMDRF Category:{' '}
                  <span className="text-brand-600">Category {classification.category}</span>
                </p>
                <p className="mt-1 text-xs text-brand-700">
                  {CATEGORY_DESCRIPTIONS[classification.category]}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && classification && (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-brand-800">Regulatory Pathway Results</h2>
            <p className="text-sm text-ink-600">
              Based on the IMDRF N12 matrix and FDA/EU AI Act rules, the following regulatory
              pathways apply.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-ink-200 p-4">
                <p className="text-xs font-semibold uppercase text-ink-400">IMDRF Category</p>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  Category {classification.category}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {CATEGORY_DESCRIPTIONS[classification.category]}
                </p>
              </div>

              <div className="rounded-lg border border-ink-200 p-4">
                <p className="text-xs font-semibold uppercase text-ink-400">FDA Pathway</p>
                <p className="mt-1 text-2xl font-bold text-ink-900 uppercase">
                  {classification.fdaPathway.replace('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Approximate pathway — final determination requires regulatory review
                </p>
              </div>

              <div className="rounded-lg border border-ink-200 p-4">
                <p className="text-xs font-semibold uppercase text-ink-400">EU AI Act Risk</p>
                <p className="mt-1 text-lg font-bold text-ink-900 capitalize">
                  {classification.euRisk.replace('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {EU_RISK_DESCRIPTIONS[classification.euRisk]}
                </p>
              </div>

              <div
                className={`rounded-lg border p-4 ${classification.pccpRequired ? 'border-purple-200 bg-purple-50' : 'border-ink-200'}`}
              >
                <p className="text-xs font-semibold uppercase text-ink-400">PCCP Requirement</p>
                <p
                  className={`mt-1 text-lg font-bold ${classification.pccpRequired ? 'text-purple-700' : 'text-green-700'}`}
                >
                  {classification.pccpRequired ? 'Required' : 'Not Required'}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {classification.pccpRequired
                    ? 'Adaptive/CL AI models require a Predetermined Change Control Plan'
                    : 'Locked AI model — no PCCP required'}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Generate Package */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-xl text-brand-800">Generate Regulatory Package</h2>
            <p className="text-sm text-ink-600">
              Generate an AI/ML Model Card, regulatory checklist, and post-market monitoring plan
              using AI.
            </p>

            {!generating && generateProgress.length === 0 && (
              <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm text-ink-600">
                <p>The package includes:</p>
                <ul className="mt-2 list-disc pl-4 space-y-1 text-ink-500">
                  <li>
                    AI/ML Model Card (name, version, intended use, training data, limitations)
                  </li>
                  <li>Regulatory Checklist (FDA AI/ML, EU AI Act Annex IV, IMDRF N10/N12/N41)</li>
                  <li>Post-Market Monitoring Plan (KPIs, drift thresholds, retraining triggers)</li>
                </ul>
              </div>
            )}

            {generateProgress.length > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                {generateProgress.map((msg) => (
                  <p key={msg} className="text-sm text-green-800">
                    {msg}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!generating && generateProgress.length === 0 && (
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Generate Package
              </button>
            )}

            {generating && <p className="text-sm text-ink-500 animate-pulse">Generating...</p>}

            {generateProgress.length > 0 && !generating && createdAssessment && (
              <button
                type="button"
                onClick={() => onCreated(createdAssessment)}
                className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                View Assessment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as WizardStep)}
          className="rounded border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 4 && (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            Next
          </button>
        )}

        {step === 4 && (
          <button
            type="button"
            disabled={submitting || !canAdvance()}
            onClick={handleSubmit}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {submitting ? 'Creating...' : 'Create Assessment'}
          </button>
        )}
      </div>
    </div>
  );
}
