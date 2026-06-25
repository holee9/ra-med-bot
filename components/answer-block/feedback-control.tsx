'use client';

// @MX:NOTE [AUTO] FeedbackControl — inline answer feedback island.
// @MX:SPEC SPEC-REGULA-RLHF-001 (REQ-RLHF-003, REQ-RLHF-004, REQ-RLHF-007, AC-01)
//
// Architecture: client island rendered below the AnswerBlock prose. The userId
// is resolved server-side at the API boundary (session.user.id) so this client
// never handles credentials. qualityTags is limited to the 8-value enum via
// strict TypeScript + the API re-validates with zod (AC-02). The low-rated
// acknowledgement surfaces REQ-RLHF-007 (knowledge-gap bridge) without any
// client-side issue creation.

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

/** REQ-RLHF-002 / AC-02: EXACTLY 8 quality tag values (frozen enum). */
export const QUALITY_TAGS_8 = [
  'citation_missing',
  'citation_wrong',
  'answer_incomplete',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
  'helpful',
  'excellent',
] as const;

export type QualityTag = (typeof QUALITY_TAGS_8)[number];

const TAG_LABELS: Record<QualityTag, string> = {
  citation_missing: '출처 누락',
  citation_wrong: '출처 오류',
  answer_incomplete: '답변 불완전',
  answer_wrong: '답변 오류',
  outdated_info: '구식 정보',
  jurisdiction_mismatch: '관할권 불일치',
  helpful: '유용함',
  excellent: '우수함',
};

/**
 * Tags that indicate a knowledge-gap signal. When the user rates "down" with
 * any of these tags selected, the UI surfaces a non-blocking acknowledgement.
 * The backend independently runs the gap/promo bridge — this list is display-only.
 */
const GAP_SIGNAL_TAGS: ReadonlySet<QualityTag> = new Set<QualityTag>([
  'citation_missing',
  'answer_wrong',
  'outdated_info',
  'jurisdiction_mismatch',
]);

interface FeedbackControlProps {
  messageId: string;
  /** Optional PII-free question snippet forwarded to the gap/promo bridge. */
  redactedQuestion?: string;
}

type Rating = 'up' | 'down';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; rating: Rating }
  | { kind: 'error'; message: string };

function isGapSignal(rating: Rating, tags: readonly QualityTag[]): boolean {
  return rating === 'down' && tags.some((t) => GAP_SIGNAL_TAGS.has(t));
}

export function FeedbackControl({ messageId, redactedQuestion }: FeedbackControlProps) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [selectedTags, setSelectedTags] = useState<QualityTag[]>([]);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  const showGapAck = state.kind === 'success' && isGapSignal(state.rating, selectedTags);

  function toggleTag(tag: QualityTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function selectRating(next: Rating) {
    setRating((prev) => (prev === next ? null : next));
    // Clear any prior error when the user adjusts their input.
    if (state.kind === 'error') setState({ kind: 'idle' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) {
      setState({ kind: 'error', message: '엄지 위/아래 평가를 선택해 주세요.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/rlhf/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating,
          qualityTags: selectedTags,
          comment: comment.trim() ? comment.trim() : null,
          redactedQuestion,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setState({ kind: 'success', rating });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '피드백 전송에 실패했습니다.',
      });
    }
  }

  const submitting = state.kind === 'submitting';
  const submitted = state.kind === 'success';

  return (
    <section
      data-testid="feedback-control"
      aria-label="답변 품질 피드백"
      className="mt-2 rounded-md border border-ink-100 bg-surface-elevated px-4 py-3"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="section-label font-serif text-[10px] uppercase tracking-widest text-ink-400">
            답변 품질 평가
          </p>
          <div className="flex items-center gap-2">
            <RatingButton
              rating="up"
              active={rating === 'up'}
              disabled={submitting}
              onClick={() => selectRating('up')}
            />
            <RatingButton
              rating="down"
              active={rating === 'down'}
              disabled={submitting}
              onClick={() => selectRating('down')}
            />
          </div>
          {submitted && (
            <output data-testid="feedback-submitted" className="text-xs font-medium text-success">
              피드백이 저장되었습니다.
            </output>
          )}
          {state.kind === 'error' && (
            <p data-testid="feedback-error" className="text-xs font-medium text-danger">
              {state.message}
            </p>
          )}
        </div>

        {/* Quality tag chips — multi-select, only visible after a rating is chosen. */}
        {rating !== null && !submitted && (
          <fieldset className="flex flex-col gap-2" aria-label="품질 태그">
            <legend className="sr-only">품질 태그 (여러 개 선택 가능)</legend>
            <div className="flex flex-wrap gap-1.5">
              {QUALITY_TAGS_8.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    data-testid={`feedback-tag-${tag}`}
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    disabled={submitting}
                    className={`rounded-xs border px-2.5 py-1 text-xs transition-colors motion-safe:duration-200 ${
                      active
                        ? 'border-brand-500 bg-brand-100 text-brand-800'
                        : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Optional comment textarea. */}
        {rating !== null && !submitted && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-500">추가 의견 (선택, 최대 2000자)</span>
            <textarea
              data-testid="feedback-comment"
              aria-label="추가 의견"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
              maxLength={2000}
              rows={2}
              className="resize-y rounded-xs border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
              placeholder="구체적인 개선점이나 우수한 점을 알려주세요."
            />
          </label>
        )}

        {rating !== null && !submitted && (
          <div className="flex justify-end">
            <button
              type="submit"
              data-testid="feedback-submit"
              disabled={submitting}
              className="rounded-xs bg-brand-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '전송 중…' : '피드백 전송'}
            </button>
          </div>
        )}
      </form>

      {/*
       * REQ-RLHF-007 surface: a non-blocking acknowledgement when the user flags
       * a low-quality answer. The backend creates the knowledge-gap issue; this
       * banner only acknowledges the action. Mirrors the inline-status pattern
       * used by ExpertReviewCallout (no global toast system in the project).
       */}
      {showGapAck && (
        <output data-testid="feedback-gap-ack" className="mt-2 text-xs text-warn">
          해당 답변은 지식 간극(knowledge-gap) 검토용으로 플래그되었습니다.
        </output>
      )}
    </section>
  );
}

interface RatingButtonProps {
  rating: Rating;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function RatingButton({ rating, active, disabled, onClick }: RatingButtonProps) {
  const Icon = rating === 'up' ? ThumbsUp : ThumbsDown;
  const label = rating === 'up' ? '유용해요' : '아쉬워요';
  return (
    <button
      type="button"
      data-testid={`feedback-rating-${rating}`}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-xs font-medium transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? rating === 'up'
            ? 'border-success bg-success-bg text-success'
            : 'border-danger bg-danger-bg text-danger'
          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
