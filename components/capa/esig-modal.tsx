'use client';

// @MX:NOTE [AUTO] EsigCloseModal — 21 CFR §11.50 / §11.70 signature manifestation for CAPA close.
// @MX:SPEC SPEC-REGULA-CAPA-001 (REQ-010, AC-04)
//
// Captures signer name, title, and the meaning of the signature before
// POSTing to /api/ra/capa/records/[id]/close. The server computes the §11.70
// record hash (lib/signature/hash.ts computeAnswerHash reused server-side);
// this modal only captures the manifestation text. Mirrors the chat answer
// signature pattern (components/chat/SignatureManifestation.tsx) but adapted
// for the CAPA close workflow.

import { type CloseBlockedResponse, closeCapa } from '@/lib/capa/api-client';
import { AlertCircle, X } from 'lucide-react';
import { type FormEvent, useCallback, useRef, useState } from 'react';

interface EsigCloseModalProps {
  capaId: string;
  /** Capa title shown in the modal header for context. */
  capaTitle: string;
  onClose: () => void;
  /** Called after a successful close (status === 'closed'). */
  onClosed: () => void;
}

const MEANING_PRESETS = [
  'CAPA를 검토했으며, 조치가 완료되었음을 확인합니다.',
  '시정·예방조치의 실효성을 검증했고, 결과를 승인합니다.',
  '본 CAPA 기록이 규제 요구사항을 충족함을 인증합니다.',
] as const;

export function EsigCloseModal({ capaId, capaTitle, onClose, onClosed }: EsigCloseModalProps) {
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [meaning, setMeaning] = useState<string>(MEANING_PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!signerName.trim() || !meaning.trim()) {
        setError('서명자 이름과 서명 의미를 모두 입력하세요.');
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setSubmitting(true);
      setError(null);
      setBlockedReason(null);

      try {
        await closeCapa(
          capaId,
          {
            signerName: signerName.trim(),
            signerTitle: signerTitle.trim() || undefined,
            meaning: meaning.trim(),
          },
          ac.signal,
        );
        onClosed();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const status = (err as Error & { status?: number }).status;
        const body = (err as Error & { body?: unknown }).body as CloseBlockedResponse | undefined;
        // REQ-011: server blocked close (reportable + vigilance missing).
        if (status === 403 && body?.error === 'close_blocked') {
          setBlockedReason(body.reason);
        } else {
          setError(err instanceof Error ? err.message : 'CAPA 종료 중 오류가 발생했습니다.');
        }
        setSubmitting(false);
      }
    },
    [capaId, signerName, signerTitle, meaning, onClosed],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
      // biome-ignore lint/a11y/useSemanticElements: <dialog> open/close API conflicts with React controlled state; div+role="dialog" is used intentionally (mirrors DocViewer pattern).
      role="dialog"
      aria-modal="true"
      aria-labelledby="esig-modal-title"
      data-testid="esig-close-modal"
    >
      <div className="w-full max-w-lg rounded-lg border border-ink-200 bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <h2 id="esig-modal-title" className="font-serif text-lg text-brand-800">
            CAPA 종료 전자서명
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
            className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
          <p className="text-xs text-ink-500">
            대상 CAPA: <span className="font-medium text-ink-700">{capaTitle}</span>
          </p>
          <p className="rounded-xs border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            21 CFR §11.50 — 서명은 서명자 이름, 서명 일시, 서명의 의미를 포함해야 합니다. 서명 제출
            시 §11.70 기록 해시가 생성되어 본 종료 결정에 영구 연결됩니다.
          </p>

          {/* Signer name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="esig-name" className="text-sm font-medium text-ink-700">
              서명자 이름{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </label>
            <input
              id="esig-name"
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              required
              maxLength={256}
              autoComplete="name"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="esig-signer-name"
            />
          </div>

          {/* Signer title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="esig-title" className="text-sm font-medium text-ink-700">
              직책
            </label>
            <input
              id="esig-title"
              type="text"
              value={signerTitle}
              onChange={(e) => setSignerTitle(e.target.value)}
              maxLength={256}
              placeholder="예: RA Lead"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="esig-signer-title"
            />
          </div>

          {/* Meaning */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium text-ink-700">
              서명 의미{' '}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </legend>
            {/* biome-ignore lint/a11y/useSemanticElements: a nested <fieldset> is invalid inside the enclosing fieldset; role="group" + aria-label labels the preset radio cluster */}
            <div className="flex flex-col gap-1.5" role="group" aria-label="서명 의미 선택">
              {MEANING_PRESETS.map((preset) => (
                <label
                  key={preset}
                  className={[
                    'cursor-pointer rounded-xs border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                    meaning === preset
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="meaning-preset"
                    value={preset}
                    checked={meaning === preset}
                    onChange={() => setMeaning(preset)}
                    className="sr-only"
                  />
                  {preset}
                </label>
              ))}
              <label
                className={[
                  'cursor-pointer rounded-xs border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                  !MEANING_PRESETS.includes(meaning as (typeof MEANING_PRESETS)[number])
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="meaning-preset"
                  value=""
                  checked={!MEANING_PRESETS.includes(meaning as (typeof MEANING_PRESETS)[number])}
                  onChange={() => setMeaning('')}
                  className="sr-only"
                />
                직접 입력
              </label>
            </div>
            <textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              required
              maxLength={1000}
              rows={2}
              aria-label="서명 의미 (직접 입력 가능)"
              className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              data-testid="esig-meaning"
            />
          </fieldset>

          {/* REQ-011 blocked reason (server gate). */}
          {blockedReason && (
            <div
              className="flex items-start gap-2 rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
              role="alert"
              data-testid="esig-close-blocked"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                종료가 차단되었습니다: {blockedReason}
                <br />
                (REQ-011 — reportable 불만의 Vigilance 연결 누락)
              </span>
            </div>
          )}

          {/* Generic error. */}
          {error && (
            <p
              className="rounded-xs border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
              role="alert"
              data-testid="esig-close-error"
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              aria-busy={submitting}
              data-testid="esig-submit-btn"
            >
              {submitting ? '서명 중…' : '서명 후 종료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
