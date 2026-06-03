'use client';

// @MX:NOTE [AUTO] Predicate compare page — builds and displays the subject-vs-
//   predicate SE comparison table, with PDF/DOCX export.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-011, REQ-PRE-019, REQ-PRE-024)
//
// REQ-PRE-011: no predicate card is pre-selected; the page only pre-loads the
// K-number passed via the ?k= query param into the comparison request.

import ComparisonTable from '@/components/predicate/ComparisonTable';
import SubjectDeviceForm from '@/components/predicate/SubjectDeviceForm';
import type {
  ComparisonDimension,
  PredicateComparison,
} from '@/lib/predicate/types';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

type ExportFormat = 'pdf' | 'docx';

function ComparePageInner() {
  const params = useSearchParams();
  const preselectedK = params.get('k');

  const [comparison, setComparison] = useState<PredicateComparison | null>(null);
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Selected predicate K-numbers — seeded from the query param, never empty
  // because the user arrives here from selecting a candidate.
  const selectedKNumbers = preselectedK ? [preselectedK] : [];

  async function handleSubmit(inputs: Record<ComparisonDimension, string>) {
    if (selectedKNumbers.length === 0) {
      setError('선택된 predicate가 없습니다. 검색 화면에서 다시 선택해 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ra/predicate/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_device_name: inputs.intended_use.slice(0, 120) || 'Subject Device',
          subject_inputs: inputs,
          selected_predicate_knumbers: selectedKNumbers,
        }),
      });
      if (!res.ok) {
        setError('비교 테이블 생성에 실패했습니다.');
        return;
      }
      const body = (await res.json()) as {
        workflow_run_id?: string;
        comparison?: PredicateComparison;
      };
      setComparison(body.comparison ?? null);
      setWorkflowRunId(body.workflow_run_id ?? null);
      // REQ-PRE-019: the comparison is persisted on creation server-side.
      setSaved(true);
    } catch {
      setError('비교 테이블 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // @MX:NOTE Approve is local-only in this view; persistence happens via the
  // approve sub-route, which is out of scope for Task 9's UI shell.
  function handleApprove(dimension: ComparisonDimension, predicateIndex: number) {
    setComparison((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cells: prev.cells.map((c) =>
          c.dimension === dimension
            ? {
                ...c,
                approved: c.approved.map((a, i) => (i === predicateIndex ? true : a)),
              }
            : c,
        ),
      };
    });
  }

  async function handleExport(format: ExportFormat) {
    if (!workflowRunId) return;
    const res = await fetch('/api/ra/predicate/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_run_id: workflowRunId, format }),
    });
    if (!res.ok) {
      setError('내보내기에 실패했습니다.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predicate-comparison.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-xl font-semibold text-ink-900">Predicate 비교</h1>

      <p data-testid="selected-predicates" className="mt-1 text-sm text-ink-500">
        선택된 predicate: {selectedKNumbers.length > 0 ? selectedKNumbers.join(', ') : '없음'}
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {!comparison ? (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-ink-700">대상 기기 정보 입력</h2>
          <SubjectDeviceForm onSubmit={handleSubmit} isLoading={loading} />
        </section>
      ) : (
        <section className="mt-6 flex flex-col gap-4">
          <ComparisonTable comparison={comparison} onApprove={handleApprove} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => handleExport('docx')}
              className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              Export DOCX
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded-md bg-success-bg px-3 py-2 text-sm font-medium text-success"
            >
              {saved ? '저장됨 ✓' : 'Save'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function PredicateComparePage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-ink-500">불러오는 중...</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
