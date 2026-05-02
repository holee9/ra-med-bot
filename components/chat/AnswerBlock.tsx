'use client';

// @MX:NOTE AnswerBlock — Phase 2 answer composite component.
// Renders: meta row, expert review callout, prose, sources grid.
// Phase 3+ sections (checklist, comparison, timeline, related) are NOT rendered here.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-039, REQ-CHAT-030)

import { Copy, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { ConfidenceEvent, SourceItem } from '../../types/streaming';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SourcesGrid } from './SourcesGrid';

// REQ-CHAT-030 — allow <sup class="cite" data-source data-offset> attributes.
// Rationale: Citation markup is produced by Regula's own pipeline; sanitization
// must preserve it so Citation components can render and deep-links work.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    sup: [...(defaultSchema.attributes?.sup ?? []), 'class', 'data-source', 'data-offset'],
    mark: [...(defaultSchema.attributes?.mark ?? []), 'class'],
  },
};

const DocViewer = dynamic(() => import('../doc/DocViewer').then((m) => m.DocViewer), {
  ssr: false,
});

interface AnswerBlockProps {
  confidence: ConfidenceEvent | undefined;
  sources: SourceItem[] | undefined;
  prose: string;
  durationMs: number | null;
  expertReviewRequired?: boolean;
}

export function AnswerBlock({
  confidence,
  sources,
  prose,
  durationMs,
  expertReviewRequired,
}: AnswerBlockProps) {
  const sourceCount = sources?.length ?? 0;
  const durationSec = durationMs !== null ? (durationMs / 1000).toFixed(1) : null;

  return (
    <article className="flex flex-col gap-4">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
        {confidence && <ConfidenceBadge level={confidence.level} score={confidence.score} />}
        <span>{sourceCount} 출처</span>
        {durationSec && <span>분석 {durationSec}s</span>}
        {/* Action buttons — copy / regenerate (thumb up/down + download disabled in Phase 2) */}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="rounded p-1 text-ink-400 hover:text-ink-700 transition-colors"
            aria-label="Copy answer"
            onClick={() => void navigator.clipboard.writeText(prose)}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="rounded p-1 text-ink-400 hover:text-ink-700 transition-colors"
            aria-label="Regenerate answer"
            disabled
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Expert review callout */}
      {expertReviewRequired && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          전문가 검토가 필요한 내용입니다. 규제 전문가의 확인 후 결정을 내리시기 바랍니다.
        </div>
      )}

      {/* Section: prose */}
      <section>
        <p className="section-label mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400">
          요약 답변
        </p>
        <div className="prose-sm prose max-w-none text-[15px] leading-[1.65] text-ink-800">
          <ReactMarkdown rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>
            {prose}
          </ReactMarkdown>
        </div>
      </section>

      {/* Section: sources */}
      {sourceCount > 0 && (
        <section>
          <p className="section-label mb-3 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            출처 ({sourceCount})
          </p>
          <SourcesGrid sources={sources ?? []} />
        </section>
      )}

      {/* DocViewer modal — lazy loaded */}
      <DocViewer />
    </article>
  );
}
