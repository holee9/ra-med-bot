'use client';

// @MX:NOTE SourceCard — displays a retrieved source with metadata.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-045)

import { AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { useDocViewer } from '../../hooks/useDocViewer';
import type { SourceItem } from '../../types/streaming';

// @MX:NOTE Source type pills use token-based semantic colors, not raw hex.
// Mapping uses brand (regulatory), success (guidance), info (standard),
// warn (industry), and ink (internal) per design system.
const TYPE_PILL_STYLES: Record<string, string> = {
  Regulation: 'bg-brand-100 text-brand-700 border-brand-300',
  Guidance: 'bg-success-50 text-success-700 border-success-200',
  Standard: 'bg-info-50 text-info-700 border-info-200',
  Industry: 'bg-warn-50 text-warn-700 border-warn-200',
  Internal: 'bg-ink-100 text-ink-700 border-ink-200',
};

interface SourceCardProps {
  source: SourceItem;
}

export function SourceCard({ source }: SourceCardProps) {
  const { open } = useDocViewer();
  const pillStyle = TYPE_PILL_STYLES[source.type] ?? 'bg-ink-100 text-ink-700 border-ink-200';

  // Determine if source has anchor/offset for verification
  const hasAnchor = source.anchor && source.anchor.length > 0;
  const hasOffset = source.offset > 0;
  const isVerifiable = hasAnchor && hasOffset;

  function handleOpen() {
    open(source.citeIndex, source.offset ?? 0, source.id);
  }

  return (
    <div
      data-testid="citation-block"
      className="flex flex-col gap-2 rounded-lg border border-border-weak bg-surface-soft p-3 transition-all hover:border-border-strong hover:shadow-sm hover:translate-y-[-1px]"
    >
      {/* Index badge + org label + type pill with border */}
      <button
        type="button"
        className="flex items-center justify-between gap-2 cursor-pointer w-full text-left"
        onClick={handleOpen}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 font-mono text-[10px] font-semibold text-brand-700">
          {source.citeIndex}
        </span>
        <span
          data-testid="citation-corpus"
          className="text-[10px] font-semibold uppercase tracking-wide text-ink-500"
        >
          {source.orgLabel}
        </span>
        <span
          className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-medium ${pillStyle}`}
        >
          {source.type}
        </span>
      </button>

      {/* Title — 2-line clamp (clickable) */}
      <button
        type="button"
        className="line-clamp-2 text-sm font-medium leading-snug text-ink-800 text-left cursor-pointer"
        onClick={handleOpen}
        data-testid="citation-source-title"
      >
        {source.title}
      </button>

      {/* Year + verification hint + external link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {source.year && <span className="font-mono text-xs text-ink-400">{source.year}</span>}
          {/* Verification hint */}
          {isVerifiable ? (
            <div
              className="flex items-center gap-1 text-[10px] text-ink-400"
              title="검증 가능: 출처 내용 위치 확인 가능"
            >
              <ShieldCheck size={10} className="text-success-500" aria-hidden="true" />
              <span className="font-mono">{source.anchor}</span>
              <span className="text-ink-300">·</span>
              <span className="font-mono">offset {source.offset}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 text-[10px] text-ink-400"
              title="검증 불가: 발췌 요약만 제공"
            >
              <AlertCircle size={10} className="text-warn-500" aria-hidden="true" />
              <span>발췌 요약</span>
            </div>
          )}
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-ink-400 hover:text-brand-600 transition-colors"
            aria-label={`Open ${source.title} in new tab`}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
