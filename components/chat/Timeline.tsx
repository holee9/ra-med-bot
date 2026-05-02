'use client';

// @MX:NOTE Timeline — left 1px vertical line, 9px bullet, amber for current item.
// Current item gets aria-label="현재 단계: {date} {title}" for accessibility.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-024)

import type { TimelineItem } from '../../types/streaming';

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="relative flex flex-col gap-0">
      {/* Left vertical line */}
      <div className="absolute left-[8px] top-2 bottom-2 w-px bg-surface-3" aria-hidden="true" />

      {items.map((item, idx) => (
        <div key={idx} className="relative flex gap-4 pb-4">
          {/* Bullet */}
          <div
            className={`relative z-10 mt-1.5 h-[9px] w-[9px] flex-shrink-0 rounded-full border-2 ${
              item.current
                ? 'bg-accent-500 border-accent-500'
                : 'bg-surface border-brand-400'
            }`}
            aria-hidden="true"
          />

          {/* Content */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className="text-xs font-mono text-ink-500"
              aria-label={item.current ? `현재 단계: ${item.date} ${item.title}` : undefined}
            >
              {item.date}
            </span>
            <span className={`text-sm font-medium ${item.current ? 'text-accent-700' : 'text-ink-800'}`}>
              {item.title}
            </span>
            {item.description && (
              <span className="text-xs text-ink-500">{item.description}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
