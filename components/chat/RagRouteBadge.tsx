'use client';

// @MX:NOTE RagRouteBadge — displays which RAG path served the answer: local/hybrid/regula.
// @MX:SPEC Issue #200

import type { RagRouteEvent } from '@/types/streaming';

interface RagRouteBadgeProps {
  route: RagRouteEvent;
}

const PATH_STYLES: Record<'local' | 'hybrid' | 'regula', { dot: string; label: string; badge: string }> =
  {
    local: {
      dot: 'bg-ink-400',
      label: '고객 Runtime',
      badge: 'bg-ink-50 text-ink-700 border-ink-150',
    },
    hybrid: {
      dot: 'bg-brand-500',
      label: '하이브리드',
      badge: 'bg-brand-50 text-brand-700 border-brand-200',
    },
    regula: {
      dot: 'bg-brand-700',
      label: 'Regula',
      badge: 'bg-brand-100 text-brand-800 border-brand-300',
    },
  };

const FALLBACK_REASON_TITLE: Record<NonNullable<RagRouteEvent['fallback_reason']>, string> = {
  timeout: '응답 지연으로 대체 경로 사용',
  unavailable: '서비스 불가로 대체 경로 사용',
  degraded: '서비스 저하로 대체 경로 사용',
};

export function RagRouteBadge({ route }: RagRouteBadgeProps) {
  const styles = PATH_STYLES[route.path];
  const fallbackLabel = route.fallback ? ' (폴백)' : '';
  const titleAttr = route.fallback_reason ? FALLBACK_REASON_TITLE[route.fallback_reason] : undefined;
  const ariaLabel = `RAG 경로: ${styles.label}${fallbackLabel}${titleAttr ? ` — ${titleAttr}` : ''}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      title={titleAttr}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      {styles.label}
      {route.fallback && (
        <span className="text-amber-600">(폴백)</span>
      )}
    </span>
  );
}
