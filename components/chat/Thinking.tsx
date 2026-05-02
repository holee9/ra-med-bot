'use client';

// @MX:NOTE Thinking trace renderer — pulsing dots + step list.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-037, REQ-CHAT-038)

import { CheckCircle, Loader2 } from 'lucide-react';
import type { TraceEvent } from '../../types/streaming';

interface ThinkingProps {
  traceSteps: TraceEvent[];
}

export function Thinking({ traceSteps }: ThinkingProps) {
  if (traceSteps.length === 0) return null;

  const hasActive = traceSteps.some((s) => s.status === 'active');

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" with aria-live on div is the correct ARIA pattern for live regions
    <div
      className="rounded-lg border border-brand-100 bg-brand-50 p-3"
      role="status"
      aria-live="polite"
      aria-label={
        hasActive
          ? `분석 중: ${traceSteps.find((s) => s.status === 'active')?.step ?? ''}`
          : '분석 완료'
      }
    >
      {/* Title with animated dots */}
      <div className="mb-2 flex items-center gap-2">
        <span className="font-sans text-xs font-semibold text-brand-700">분석 중</span>
        {hasActive && (
          <span className="flex gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-1 w-1 rounded-full bg-brand-500"
                style={{
                  animation: 'tdot 1.2s infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>

      {/* Step list */}
      <ul className="space-y-1">
        {traceSteps.map((step) => (
          <li key={step.step} className="flex items-center gap-2 font-mono text-xs text-ink-600">
            {step.status === 'active' ? (
              <Loader2 size={10} className="animate-spin text-brand-500" aria-hidden="true" />
            ) : (
              <CheckCircle size={10} className="text-success-500" aria-hidden="true" />
            )}
            <span>{step.step}</span>
          </li>
        ))}
      </ul>

      <style>{`
        @keyframes tdot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
