'use client';

// @MX:NOTE [AUTO] CapaRecordForm — corrective/preventive record creation (REQ-004/005).
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-004, REQ-005, REQ-008, AC-03)
//
// Client island that creates a corrective OR preventive CAPA record (REQ-004:
// separate tabs for each type) with owner, due date, and effectiveness check
// scheduling (REQ-005/006). Optionally attaches cross-workflow links (REQ-008).

import { createCapa } from '@/lib/capa/api-client';
import type { CapaType } from '@/lib/capa/types';
import { type FormEvent, useCallback, useRef, useState } from 'react';

interface CapaRecordFormProps {
  complaintId: string;
  projectId: string;
  /** Called after a CAPA record is created. */
  onCreated?: (capaId: string) => void;
}

export function CapaRecordForm({ complaintId, projectId, onCreated }: CapaRecordFormProps) {
  const [type, setType] = useState<CapaType>('corrective');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [effectivenessDueDate, setEffectivenessDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!description.trim() || !ownerId.trim() || !dueDate) {
        setError('설명, 담당자, 마감일을 모두 입력하세요.');
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);

      try {
        const result = await createCapa(
          {
            projectId,
            complaintId,
            type,
            description: description.trim(),
            ownerId: ownerId.trim(),
            dueDate,
            effectivenessDueDate: effectivenessDueDate || undefined,
          },
          ac.signal,
        );
        setCreatedId(result.capaId);
        onCreated?.(result.capaId);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'CAPA 생성 중 오류가 발생했습니다.');
      } finally {
        setSubmitting(false);
      }
    },
    [complaintId, projectId, type, description, ownerId, dueDate, effectivenessDueDate, onCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-testid="capa-record-form"
      aria-label={`${type === 'corrective' ? '시정' : '예방'}조치 CAPA 생성`}
    >
      {/* REQ-004: corrective vs preventive tabs */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-700">조치 유형 (REQ-004)</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="조치 유형 선택">
          {(
            [
              { value: 'corrective', label: '시정조치 (Corrective)' },
              { value: 'preventive', label: '예방조치 (Preventive)' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={[
                'cursor-pointer rounded-xs border px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                type === opt.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
              ].join(' ')}
            >
              <input
                type="radio"
                name="capa-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          {type === 'corrective'
            ? '시정조치: 이미 발생한 부적합을 제거하기 위한 조치.'
            : '예방조치: 잠재적 부적합의 원인을 제거하기 위한 조치.'}
        </p>
      </fieldset>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cr-description" className="text-sm font-medium text-ink-700">
          조치 설명{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <textarea
          id="cr-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={8000}
          rows={4}
          placeholder={
            type === 'corrective'
              ? '예: 결함 로트 회수 및 영향받은 고객 통지'
              : '예: 공정 모니터링 절차 추가 및 주기적 감사 강화'
          }
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cr-description"
        />
      </div>

      {/* Owner */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cr-owner" className="text-sm font-medium text-ink-700">
          담당자 (User ID){' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <input
          id="cr-owner"
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          required
          maxLength={128}
          placeholder="UUID 형식의 사용자 ID"
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cr-owner"
        />
      </div>

      {/* Due date */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cr-due" className="text-sm font-medium text-ink-700">
          조치 마감일{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        </label>
        <input
          id="cr-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cr-due"
        />
      </div>

      {/* REQ-006: effectiveness check due date (optional) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cr-effectiveness" className="text-sm font-medium text-ink-700">
          실효성 검증 예정일 (REQ-006, 선택)
        </label>
        <input
          id="cr-effectiveness"
          type="date"
          value={effectivenessDueDate}
          onChange={(e) => setEffectivenessDueDate(e.target.value)}
          className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          data-testid="cr-effectiveness"
        />
        <p className="text-xs text-ink-500">
          지정 시 Inngest가 해당 기한에 알림을 전송합니다 (AC-02).
        </p>
      </div>

      {error && (
        <p
          className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          role="alert"
          data-testid="cr-error"
        >
          {error}
        </p>
      )}
      {createdId && (
        <output
          className="rounded-xs border border-success/30 bg-success-bg px-3 py-2 text-sm text-success"
          data-testid="cr-created"
        >
          {type === 'corrective' ? '시정' : '예방'}조치 CAPA가 생성되었습니다. ID:{' '}
          <code className="font-mono text-xs">{createdId}</code>
        </output>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          aria-busy={submitting}
          data-testid="cr-submit-btn"
        >
          {submitting ? '생성 중…' : `${type === 'corrective' ? '시정' : '예방'}조치 CAPA 생성`}
        </button>
      </div>
    </form>
  );
}
