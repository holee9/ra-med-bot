
// @MX:LEGACY archived from app
'use client';
// @MX:SPEC SPEC-REGULA-ESUBMIT-001
// Tabbed detail view: Overview | Manifest | Validation | Interactions

import type { ValidationIssue } from '@/lib/esubmit/validators';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionPackage {
  id: string;
  submissionType: string;
  jurisdiction: string;
  deviceName: string;
  submissionNumber: string | null;
  version: string;
  status: string;
  packageManifest: Record<string, unknown>;
  validationResults: ValidationIssue[];
  createdBy: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Interaction {
  id: string;
  interactionType: string;
  referenceNumber: string | null;
  description: string;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status / label maps
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-600',
  validating: 'bg-amber-100 text-amber-700',
  validated: 'bg-blue-100 text-blue-700',
  submitted: 'bg-purple-100 text-purple-700',
  rta: 'bg-red-100 text-red-600',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  validating: 'Validating...',
  validated: 'Validated',
  submitted: 'Submitted',
  rta: 'RTA',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  '510k': 'FDA 510(k)',
  de_novo: 'FDA De Novo',
  pma: 'FDA PMA',
  cer: 'EU MDR CER',
  pccp: 'PCCP',
  mfds_import: 'MFDS 수입 허가',
  nmpa_ecdt: 'NMPA eCDT',
};

const SEVERITY_STYLES: Record<string, string> = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const SEVERITY_LABELS: Record<string, string> = {
  error: '오류',
  warning: '경고',
  info: '정보',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  rta: 'RTA (거부 to Accept)',
  ai_request: 'AI Request',
  deficiency: 'Deficiency',
  approval: 'Approval',
  rejection: 'Rejection',
};

const INTERACTION_STYLES: Record<string, string> = {
  rta: 'bg-red-50 text-red-700 border-red-200',
  ai_request: 'bg-amber-50 text-amber-700 border-amber-200',
  deficiency: 'bg-orange-50 text-orange-700 border-orange-200',
  approval: 'bg-green-50 text-green-700 border-green-200',
  rejection: 'bg-red-50 text-red-700 border-red-200',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'manifest' | 'validation' | 'interactions';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-ink-500 hover:text-ink-800'
      }`}
    >
      {children}
    </button>
  );
}

// Overview tab
function OverviewTab({
  pkg,
  onStatusUpdate,
}: {
  pkg: SubmissionPackage;
  onStatusUpdate: (updated: Partial<SubmissionPackage>) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleMarkSubmitted = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ra/esubmit/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { package: SubmissionPackage };
        onStatusUpdate({ status: data.package.status, submittedAt: data.package.submittedAt });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-500">제출 유형</p>
          <p className="mt-0.5 text-sm font-medium">
            {SUBMISSION_TYPE_LABELS[pkg.submissionType] ?? pkg.submissionType}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-500">규제 기관</p>
          <p className="mt-0.5 text-sm font-medium">{pkg.jurisdiction}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">버전</p>
          <p className="mt-0.5 text-sm font-medium">v{pkg.version}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">제출 번호</p>
          <p className="mt-0.5 text-sm font-mono">
            {pkg.submissionNumber ?? <span className="text-ink-400">미배정</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-500">상태</p>
          <span
            className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[pkg.status] ?? 'bg-ink-100 text-ink-600'
            }`}
          >
            {STATUS_LABELS[pkg.status] ?? pkg.status}
          </span>
        </div>
        {pkg.submittedAt && (
          <div>
            <p className="text-xs text-ink-500">제출일</p>
            <p className="mt-0.5 text-sm" suppressHydrationWarning>
              {new Date(pkg.submittedAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
        )}
      </div>

      {pkg.status === 'validated' && (
        <button
          type="button"
          onClick={handleMarkSubmitted}
          disabled={submitting}
          className="mt-2 w-fit rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? '처리 중...' : '제출 완료로 표시'}
        </button>
      )}
    </div>
  );
}

// Manifest editor tab
function ManifestTab({
  pkg,
  onSaved,
}: {
  pkg: SubmissionPackage;
  onSaved: (manifest: Record<string, unknown>) => void;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(pkg.packageManifest, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      setError('유효하지 않은 JSON 형식입니다.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/ra/esubmit/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_manifest: parsed }),
      });
      if (res.ok) {
        onSaved(parsed);
      } else {
        setError('저장에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-500">
        제출 패키지 매니페스트 (JSON). 필수 섹션을 채운 후 검증을 실행하세요.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={20}
        className="w-full rounded-md border border-ink-300 bg-ink-50 px-3 py-2 font-mono text-xs focus:border-brand-400 focus:outline-none"
        spellCheck={false}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? '저장 중...' : '매니페스트 저장'}
      </button>
    </div>
  );
}

// Validation results tab
function ValidationTab({
  pkg,
  onValidated,
}: {
  pkg: SubmissionPackage;
  onValidated: (issues: ValidationIssue[], status: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const issues = pkg.validationResults ?? [];

  const handleRunValidation = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/ra/esubmit/${pkg.id}/validate`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { issues: ValidationIssue[]; status: string };
        onValidated(data.issues, data.status);
      }
    } finally {
      setRunning(false);
    }
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          {issues.length > 0 && (
            <>
              {errorCount > 0 && (
                <span className="text-red-600 font-medium">{errorCount}개 오류</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-600 font-medium">{warnCount}개 경고</span>
              )}
              {infoCount > 0 && <span className="text-blue-600">{infoCount}개 정보</span>}
              {issues.length === 0 && <span className="text-green-600 font-medium">이슈 없음</span>}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleRunValidation}
          disabled={running || pkg.status === 'validating'}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {running || pkg.status === 'validating' ? '검증 중...' : '검증 실행'}
        </button>
      </div>

      {issues.length === 0 ? (
        <p className="text-sm text-ink-500">
          {pkg.status === 'validated'
            ? '검증 통과 — 제출 준비 완료입니다.'
            : '매니페스트를 저장한 후 검증을 실행하세요.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(['error', 'warning', 'info'] as const).map((severity) => {
            const severityIssues = issues.filter((i) => i.severity === severity);
            if (severityIssues.length === 0) return null;
            return (
              <div key={severity}>
                <h4 className="mb-1 text-xs font-semibold uppercase text-ink-500">
                  {SEVERITY_LABELS[severity]}
                </h4>
                {severityIssues.map((issue) => (
                  <div
                    key={issue.code}
                    className={`mb-2 rounded-md border px-3 py-2 text-sm ${SEVERITY_STYLES[issue.severity]}`}
                  >
                    <span className="font-mono text-xs font-medium">[{issue.code}]</span>{' '}
                    <span className="text-xs text-ink-500">({issue.section})</span>
                    <p className="mt-0.5">{issue.message}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Interactions tab
function InteractionsTab({ packageId }: { packageId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    interaction_type: 'rta' as string,
    reference_number: '',
    description: '',
    due_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ra/esubmit/${packageId}/interactions`)
      .then((r) => r.json())
      .then((data: { interactions: Interaction[] }) => setInteractions(data.interactions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [packageId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ra/esubmit/${packageId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: form.interaction_type,
          reference_number: form.reference_number || undefined,
          description: form.description,
          due_date: form.due_date || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? '추가에 실패했습니다.');
        return;
      }
      const data = (await res.json()) as { interaction: Interaction };
      setInteractions((prev) => [data.interaction, ...prev]);
      setShowForm(false);
      setForm({ interaction_type: 'rta', reference_number: '', description: '', due_date: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + 인터랙션 추가
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-ink-50 p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="interaction_type"
                className="mb-1 block text-xs font-medium text-ink-700"
              >
                유형
              </label>
              <select
                id="interaction_type"
                value={form.interaction_type}
                onChange={(e) => setForm((p) => ({ ...p, interaction_type: e.target.value }))}
                className="w-full rounded border border-ink-300 px-2 py-1.5 text-sm"
              >
                {Object.entries(INTERACTION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reference_number"
                className="mb-1 block text-xs font-medium text-ink-700"
              >
                참조 번호
              </label>
              <input
                id="reference_number"
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm((p) => ({ ...p, reference_number: e.target.value }))}
                placeholder="예: RTA-2024-001"
                className="w-full rounded border border-ink-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-medium text-ink-700">
              설명 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              required
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full rounded border border-ink-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="due_date" className="mb-1 block text-xs font-medium text-ink-700">
              마감일
            </label>
            <input
              id="due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              className="w-fit rounded border border-ink-300 px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? '추가 중...' : '추가'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border border-ink-300 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-500">로딩 중...</p>
      ) : interactions.length === 0 ? (
        <p className="text-sm text-ink-400">규제 기관 인터랙션 기록이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {interactions.map((i) => (
            <div
              key={i.id}
              className={`rounded-lg border p-3 text-sm ${
                INTERACTION_STYLES[i.interactionType] ?? 'bg-ink-50 border-ink-200 text-ink-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {INTERACTION_TYPE_LABELS[i.interactionType] ?? i.interactionType}
                </span>
                {i.referenceNumber && (
                  <span className="font-mono text-xs">{i.referenceNumber}</span>
                )}
              </div>
              <p className="mt-1">{i.description}</p>
              <div className="mt-1.5 flex gap-3 text-xs opacity-70">
                {i.dueDate && <span>마감: {i.dueDate}</span>}
                {i.resolvedAt && (
                  <span suppressHydrationWarning>
                    해결: {new Date(i.resolvedAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
                <span suppressHydrationWarning>
                  {new Date(i.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ESubmitDetail component
// ---------------------------------------------------------------------------

interface Props {
  packageId: string;
  onBack: () => void;
}

// @MX:NOTE: [AUTO] ESubmitDetail fetches package + interactions on mount; tabs are lazy-rendered
export function ESubmitDetail({ packageId, onBack }: Props) {
  const [pkg, setPkg] = useState<SubmissionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  useEffect(() => {
    fetch(`/api/ra/esubmit/${packageId}`)
      .then((r) => r.json())
      .then((data: { package: SubmissionPackage }) => setPkg(data.package ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [packageId]);

  const handleStatusUpdate = useCallback((updated: Partial<SubmissionPackage>) => {
    setPkg((prev) => (prev ? { ...prev, ...updated } : prev));
  }, []);

  const handleManifestSaved = useCallback((manifest: Record<string, unknown>) => {
    setPkg((prev) => (prev ? { ...prev, packageManifest: manifest } : prev));
  }, []);

  const handleValidated = useCallback((issues: ValidationIssue[], status: string) => {
    setPkg((prev) => (prev ? { ...prev, validationResults: issues, status } : prev));
  }, []);

  if (loading) {
    return <p className="text-sm text-ink-500">로딩 중...</p>;
  }

  if (!pkg) {
    return (
      <div>
        <p className="text-sm text-red-600">패키지를 찾을 수 없습니다.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 text-sm text-brand-600 hover:underline"
        >
          목록으로
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[pkg.status] ?? 'bg-ink-100 text-ink-600';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 text-sm text-brand-600 hover:underline"
        >
          ← 목록
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl text-brand-800">{pkg.deviceName}</h2>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
              {STATUS_LABELS[pkg.status] ?? pkg.status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-500">
            {SUBMISSION_TYPE_LABELS[pkg.submissionType] ?? pkg.submissionType} · {pkg.jurisdiction}{' '}
            · v{pkg.version}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-200">
        {(['overview', 'manifest', 'validation', 'interactions'] as TabId[]).map((tab) => {
          const labels: Record<TabId, string> = {
            overview: '개요',
            manifest: '매니페스트',
            validation: '검증 결과',
            interactions: '인터랙션',
          };
          return (
            <TabButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {labels[tab]}
            </TabButton>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {activeTab === 'overview' && <OverviewTab pkg={pkg} onStatusUpdate={handleStatusUpdate} />}
        {activeTab === 'manifest' && <ManifestTab pkg={pkg} onSaved={handleManifestSaved} />}
        {activeTab === 'validation' && <ValidationTab pkg={pkg} onValidated={handleValidated} />}
        {activeTab === 'interactions' && <InteractionsTab packageId={packageId} />}
      </div>
    </div>
  );
}
