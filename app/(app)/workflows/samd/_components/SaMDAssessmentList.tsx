'use client';
// @MX:SPEC SPEC-REGULA-SAMD-001
// List view for SaMD assessments with new assessment wizard trigger.

import { useEffect, useState } from 'react';
import { SaMDCard } from './SaMDCard';
import { SaMDWizard } from './SaMDWizard';

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

export function SaMDAssessmentList() {
  const [assessments, setAssessments] = useState<SaMDAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    fetch('/api/ra/samd')
      .then((r) => r.json())
      .then((data) => setAssessments(data.assessments ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (assessment: SaMDAssessment) => {
    setAssessments((prev) => [assessment, ...prev]);
    setShowWizard(false);
  };

  if (showWizard) {
    return (
      <SaMDWizard
        onCreated={handleCreated}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {loading ? 'Loading...' : `${assessments.length} assessment${assessments.length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          New Assessment
        </button>
      </div>

      {!loading && assessments.length === 0 && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-8 text-center">
          <p className="text-sm text-ink-500">No SaMD assessments yet.</p>
          <p className="mt-1 text-xs text-ink-400">
            Start by creating a new assessment to classify your AI/ML medical device.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {assessments.map((a) => (
          <SaMDCard key={a.id} assessment={a} />
        ))}
      </div>
    </div>
  );
}
