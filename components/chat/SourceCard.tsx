'use client';

// @MX:NOTE SourceCard — displays a retrieved source with metadata.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-045)

import { ExternalLink } from 'lucide-react';
import { useDocViewer } from '../../hooks/useDocViewer';
import type { SourceItem } from '../../types/streaming';

const TYPE_PILL_STYLES: Record<string, string> = {
  Regulation: 'bg-blue-100 text-blue-700',
  Guidance: 'bg-green-100 text-green-700',
  Standard: 'bg-purple-100 text-purple-700',
  Industry: 'bg-orange-100 text-orange-700',
  Internal: 'bg-gray-100 text-gray-700',
};

interface SourceCardProps {
  source: SourceItem;
}

export function SourceCard({ source }: SourceCardProps) {
  const { open } = useDocViewer();
  const pillStyle = TYPE_PILL_STYLES[source.type] ?? 'bg-gray-100 text-gray-700';

  function handleOpen() {
    open(source.citeIndex, source.offset ?? 0, source.id);
  }

  return (
    <button
      type="button"
      data-testid="citation-block"
      className="flex flex-col gap-2 rounded-lg border border-border-weak bg-surface-soft p-3 transition-all hover:border-border-strong hover:shadow-sm hover:translate-y-[-1px] cursor-pointer w-full text-left"
      onClick={handleOpen}
    >
      {/* Index badge + org label */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 font-mono text-[10px] font-semibold text-brand-700">
          {source.citeIndex}
        </span>
        <span
          data-testid="citation-corpus"
          className="text-[10px] font-semibold uppercase tracking-wide text-ink-500"
        >
          {source.orgLabel}
        </span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${pillStyle}`}>
          {source.type}
        </span>
      </div>

      {/* Title — 2-line clamp */}
      <p
        data-testid="citation-source-title"
        className="line-clamp-2 text-sm font-medium leading-snug text-ink-800"
      >
        {source.title}
      </p>

      {/* Year + external link */}
      <div className="flex items-center justify-between">
        {source.year && <span className="font-mono text-xs text-ink-400">{source.year}</span>}
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-ink-400 hover:text-brand-600 transition-colors"
            aria-label={`Open ${source.title} in new tab`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </button>
  );
}
