
// @MX:LEGACY archived from app
'use client';

// @MX:NOTE [AUTO] ClinicalInvestigationWorkbench — frontend full-cycle MVP for Issue #69.
// @MX:SPEC SPEC-REGULA-CLINICAL-INVESTIGATION-001 (REQ-CLININV-001~012, AC-01~08)

import { useMemo, useState } from 'react';

type ProjectOption = { id: string; name: string };
type InvestigationSummary = {
  id: string;
  projectId: string | null;
  pathway: 'fda_ide' | 'eu_mdr' | null;
  necessityStatus: string;
  approvalStatus: string;
  updatedAt: string | null;
};

type Props = {
  projects: ProjectOption[];
  recent: InvestigationSummary[];
  canManage: boolean;
};

type AssessmentResult = {
  id: string;
  necessityStatus: string;
  recommendation: string;
  rationale: string;
  confidence: string;
  citations: Array<{ source: string; id: string }>;
};

type ApiState = 'idle' | 'loading' | 'success' | 'error';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'request_failed');
  return json as T;
}

export function ClinicalInvestigationWorkbench({ projects, recent, canManage }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [cerGapSummary, setCerGapSummary] = useState(
    'Existing CER identifies insufficient clinical evidence for the intended use.',
  );
  const [literatureGapSummary, setLiteratureGapSummary] = useState(
    'No clinical studies found for the target indication.',
  );
  const [deviceClass, setDeviceClass] = useState('Class III implantable');
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [selectedId, setSelectedId] = useState(recent[0]?.id ?? '');
  const [status, setStatus] = useState<ApiState>('idle');
  const [message, setMessage] = useState('');
  const selectedInvestigationId = assessment?.id ?? selectedId;

  const recentByProject = useMemo(() => {
    const names = new Map(projects.map((p) => [p.id, p.name]));
    return recent.map((row) => ({
      ...row,
      projectName: row.projectId ? (names.get(row.projectId) ?? row.projectId) : 'No project',
    }));
  }, [projects, recent]);

  async function runAssessment() {
    setStatus('loading');
    setMessage('');
    try {
      const result = await postJson<AssessmentResult>('/api/clinical-investigation/assess', {
        projectId: projectId || undefined,
        cerGapSummary,
        literatureGapSummary: literatureGapSummary || undefined,
        deviceClass: deviceClass || undefined,
      });
      setAssessment(result);
      setSelectedId(result.id);
      setStatus('success');
      setMessage('Assessment created');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Assessment failed');
    }
  }

  async function runAction(action: 'ide' | 'protocol' | 'irb' | 'event' | 'link') {
    if (!selectedInvestigationId) return;
    setStatus('loading');
    setMessage('');
    try {
      if (action === 'ide') {
        await postJson(`/api/clinical-investigation/${selectedInvestigationId}/ide-decision`, {
          riskLevel: 'significant',
          isExemptDevice: false,
        });
        setMessage('IDE pathway recorded');
      } else if (action === 'protocol') {
        await postJson(`/api/clinical-investigation/${selectedInvestigationId}/protocol`, {
          synopsis: 'Prospective clinical investigation for safety and performance confirmation.',
          endpoints: [{ name: 'Primary safety', description: 'Adverse event rate' }],
          inclusionCriteria: ['Adults matching intended-use population'],
          exclusionCriteria: ['Pregnancy', 'Contraindicated comorbidity'],
        });
        setMessage('Protocol draft saved');
      } else if (action === 'irb') {
        await postJson(`/api/clinical-investigation/${selectedInvestigationId}/irb-package`, {
          pathway: 'fda_ide',
          includeConsentDraft: true,
          includeBrochure: true,
          includeMonitoringPlan: true,
        });
        setMessage('IRB package drafted');
      } else if (action === 'event') {
        await postJson(`/api/clinical-investigation/${selectedInvestigationId}/events`, {
          type: 'deviation',
          title: 'Protocol deviation logged',
          description: 'Tracked for IRB follow-up.',
        });
        setMessage('Deviation logged');
      } else {
        await postJson(`/api/clinical-investigation/${selectedInvestigationId}/links`, {
          targetType: 'dhf',
          targetId: crypto.randomUUID(),
        });
        setMessage('Result linked to DHF placeholder');
      }
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="clinical-investigation-workbench">
      <div className="rounded-lg border border-ink-200 bg-surface p-6">
        <h2 className="mb-4 font-serif text-xl text-brand-700">Gap assessment</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-ink-700">
            Project
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded-md border border-ink-200 bg-white px-3 py-2"
              data-testid="ci-project-select"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-700">
            Device class
            <input
              value={deviceClass}
              onChange={(e) => setDeviceClass(e.target.value)}
              className="rounded-md border border-ink-200 bg-white px-3 py-2"
              data-testid="ci-device-class-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-700 lg:col-span-2">
            CER gap summary
            <textarea
              value={cerGapSummary}
              onChange={(e) => setCerGapSummary(e.target.value)}
              className="min-h-24 rounded-md border border-ink-200 bg-white px-3 py-2"
              data-testid="ci-cer-gap-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-700 lg:col-span-2">
            Literature gap summary
            <textarea
              value={literatureGapSummary}
              onChange={(e) => setLiteratureGapSummary(e.target.value)}
              className="min-h-20 rounded-md border border-ink-200 bg-white px-3 py-2"
              data-testid="ci-literature-gap-input"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runAssessment()}
          disabled={!canManage || status === 'loading'}
          className="mt-4 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          data-testid="ci-assess-button"
        >
          Create assessment
        </button>
      </div>

      {assessment && (
        <section
          className="rounded-lg border border-ink-200 bg-white p-6"
          data-testid="ci-assessment-result"
        >
          <h2 className="font-serif text-xl text-brand-700">Recommendation</h2>
          <p className="mt-2 text-sm font-medium text-ink-800">
            {assessment.necessityStatus} · {assessment.confidence}
          </p>
          <p className="mt-2 text-sm text-ink-600">{assessment.recommendation}</p>
          <p className="mt-2 text-xs text-ink-500">
            {assessment.citations.map((c) => `${c.source} ${c.id}`).join(', ')}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-ink-200 bg-surface p-6">
        <h2 className="mb-4 font-serif text-xl text-brand-700">Lifecycle actions</h2>
        <label className="flex max-w-xl flex-col gap-1 text-sm text-ink-700">
          Investigation
          <select
            value={selectedInvestigationId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-md border border-ink-200 bg-white px-3 py-2"
            data-testid="ci-investigation-select"
          >
            {assessment && (
              <option value={assessment.id}>{assessment.id} · current assessment</option>
            )}
            {recentByProject.map((row) => (
              <option key={row.id} value={row.id}>
                {row.projectName} · {row.necessityStatus} · {row.approvalStatus}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['ide', 'IDE decision'],
            ['protocol', 'Protocol'],
            ['irb', 'IRB package'],
            ['event', 'AE event'],
            ['link', 'DHF link'],
          ].map(([action, label]) => (
            <button
              key={action}
              type="button"
              onClick={() =>
                void runAction(action as 'ide' | 'protocol' | 'irb' | 'event' | 'link')
              }
              disabled={!canManage || !selectedInvestigationId || status === 'loading'}
              className="rounded-md border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
              data-testid={`ci-action-${action}`}
            >
              {label}
            </button>
          ))}
        </div>
        {message && (
          <p
            className={
              status === 'error' ? 'mt-3 text-sm text-danger' : 'mt-3 text-sm text-success'
            }
            data-testid="ci-action-message"
          >
            {message}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-ink-200 bg-white p-6" data-testid="ci-dashboard">
        <h2 className="mb-4 font-serif text-xl text-brand-700">Dashboard</h2>
        {recentByProject.length === 0 ? (
          <p className="text-sm text-ink-500">No investigations yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {recentByProject.map((row) => (
              <li key={row.id} className="rounded-md border border-ink-100 px-3 py-2 text-sm">
                <p className="font-medium text-ink-800">{row.projectName}</p>
                <p className="text-ink-500">
                  {row.necessityStatus} · {row.pathway ?? 'pathway pending'} · {row.approvalStatus}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
