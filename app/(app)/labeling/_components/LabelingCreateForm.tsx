'use client';

// @MX:NOTE [AUTO] LabelingCreateForm — structured document creation (REQ-001, AC-01).
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, REQ-002, AC-01)
//
// Client island that captures the structured labeling document input and POSTs
// to /api/labeling/documents. On success, router.push to the document workbench.
// Mirrors the ChangeControlForm client-island pattern (RSC shell + client form).

import { createLabelingDocument } from '@/lib/labeling/api-client';
import type { LabelingJurisdiction } from '@/lib/labeling/types';
import type { ProjectSummary } from '@/lib/queries/useProjects';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useRef, useState } from 'react';

/** Canonical jurisdiction options — mirrors the backend enum + checklist map. */
const JURISDICTION_OPTIONS: ReadonlyArray<{ value: LabelingJurisdiction; label: string }> = [
  { value: 'FDA', label: 'FDA (미국 — 21 CFR 801)' },
  { value: 'EU_MDR', label: 'EU MDR (유럽 — Annex I Ch. III)' },
  { value: 'MFDS', label: 'MFDS (한국 — 의료기기법 제12조)' },
  { value: 'NMPA', label: 'NMPA (중국)' },
  { value: 'PMDA', label: 'PMDA (일본)' },
] as const;

interface LabelingCreateFormProps {
  projects: Array<Pick<ProjectSummary, 'id' | 'name'>>;
  /** ra-member+ can create documents. */
  canCreate: boolean;
}

export function LabelingCreateForm({ projects, canCreate }: LabelingCreateFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [productName, setProductName] = useState('');
  const [jurisdiction, setJurisdiction] = useState<LabelingJurisdiction>('FDA');

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canCreate) return;
      if (!projectId || !productName.trim()) {
        setError('프로젝트와 제품명을 모두 입력하세요.');
        return;
      }

      // Abort any in-flight submit (L-007: avoid race on double-click).
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);

      try {
        const result = await createLabelingDocument(
          {
            projectId,
            productName: productName.trim(),
            jurisdiction,
            locale: 'ko',
          },
          ac.signal,
        );
        router.push(`/labeling/${result.documentId}`);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '라벨링 문서 생성 중 오류가 발생했습니다.');
        setSubmitting(false);
      }
    },
    [canCreate, projectId, productName, jurisdiction, router],
  );

  if (!canCreate) {
    return (
      <div
        className="rounded-md border border-ink-200 bg-ink-50 px-4 py-6 text-sm text-ink-600"
        role="alert"
      >
        라벨링 문서 생성은 RA Member 권한 이상 필요합니다 (label.create).
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-testid="labeling-create-form"
      aria-label="라벨링 문서 생성"
    >
      {/* Project select */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="label-project" className="text-sm font-medium text-ink-700">
          프로젝트{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <select
          id="label-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="label-project-select"
        >
          <option value="" disabled>
            프로젝트 선택
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="label-product-name" className="text-sm font-medium text-ink-700">
          제품명{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <input
          id="label-product-name"
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
          maxLength={500}
          placeholder="예: CardioPatch Model X1"
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="label-product-name-input"
        />
      </div>

      {/* Jurisdiction select */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="label-jurisdiction" className="text-sm font-medium text-ink-700">
          관할권{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <select
          id="label-jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value as LabelingJurisdiction)}
          required
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="label-jurisdiction-select"
        >
          {JURISDICTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-500">
          선택한 관할권의 필수 표시사항 체크리스트가 문서 생성 시 자동 적용됩니다.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="labeling-create-error"
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="labeling-create-submit"
          aria-busy={submitting}
        >
          {submitting ? '생성 중…' : '라벨링 문서 생성'}
        </button>
      </div>
    </form>
  );
}
