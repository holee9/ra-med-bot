'use client';

// @MX:NOTE [AUTO] SubjectDeviceForm — collects the five substantial-equivalence
//   dimensions for the subject device before building the comparison table.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-012)

import type { ComparisonDimension } from '@/lib/predicate/types';
import { useState } from 'react';

interface SubjectDeviceFormProps {
  onSubmit: (inputs: Record<ComparisonDimension, string>) => void;
  isLoading?: boolean;
}

interface DimensionField {
  key: ComparisonDimension;
  label: string;
  placeholder: string;
  helper: string;
}

// @MX:NOTE Order matches the five SE dimensions in lib/predicate/types.ts.
const FIELDS: DimensionField[] = [
  {
    key: 'intended_use',
    label: 'Intended Use',
    placeholder: 'Describe the intended use of your device...',
    helper: 'The general purpose of the device as stated in labeling.',
  },
  {
    key: 'indications',
    label: 'Indications for Use',
    placeholder: 'Describe the indications for use...',
    helper: 'The specific conditions or patient population the device targets.',
  },
  {
    key: 'tech_characteristics',
    label: 'Technological Characteristics',
    placeholder: 'Describe the technological characteristics...',
    helper: 'Design, materials, energy source, and operating principles.',
  },
  {
    key: 'materials',
    label: 'Materials',
    placeholder: 'Describe the materials used...',
    helper: 'Patient-contacting and structural materials.',
  },
  {
    key: 'performance',
    label: 'Performance',
    placeholder: 'Describe the performance data...',
    helper: 'Bench, animal, or clinical performance results.',
  },
];

const EMPTY: Record<ComparisonDimension, string> = {
  intended_use: '',
  indications: '',
  tech_characteristics: '',
  materials: '',
  performance: '',
};

export default function SubjectDeviceForm({
  onSubmit,
  isLoading = false,
}: SubjectDeviceFormProps) {
  const [values, setValues] = useState<Record<ComparisonDimension, string>>(EMPTY);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label
            htmlFor={`subject-input-${field.key}`}
            className="text-sm font-medium text-ink-800"
          >
            {field.label}
          </label>
          <textarea
            id={`subject-input-${field.key}`}
            data-testid={`subject-input-${field.key}`}
            value={values[field.key]}
            placeholder={field.placeholder}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            rows={3}
            className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
          <p className="text-xs text-ink-500">{field.helper}</p>
        </div>
      ))}

      <button
        type="submit"
        disabled={isLoading}
        aria-label="Build Comparison Table"
        className="self-start rounded-md bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Building...' : 'Build Comparison Table'}
      </button>
    </form>
  );
}
