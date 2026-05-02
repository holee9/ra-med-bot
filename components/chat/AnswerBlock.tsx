'use client';

// @MX:NOTE AnswerBlock — Phase 3 answer composite component.
// Renders 11 sections in order: meta row, expert-review callout, prose, checklist,
// comparison, timeline, sources, related pills.
// Phase 2 sections: meta row, expert review callout, prose, sources.
// Phase 3 adds: checklist, comparison, timeline, related.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-028)
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-039, REQ-CHAT-030)

import { Copy, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type {
  ChecklistEvent,
  ChecklistItem,
  ComparisonEvent,
  ConfidenceEvent,
  SourceItem,
  TimelineEvent,
} from '../../types/streaming';
import { Callout } from './Callout';
import { Checklist } from './Checklist';
import { ComparisonTable } from './ComparisonTable';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SourcesGrid } from './SourcesGrid';
import { SuggestionPill } from './SuggestionPill';
import { Timeline } from './Timeline';

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
  // Phase 3 structured fields
  messageId?: string;
  blockId?: string;
  checklist?: ChecklistEvent | undefined;
  comparison?: ComparisonEvent | undefined;
  timeline?: TimelineEvent | undefined;
  related?: string[] | undefined;
  onSuggestionClick?: (text: string) => void;
}

export function AnswerBlock({
  confidence,
  sources,
  prose,
  durationMs,
  expertReviewRequired,
  messageId,
  blockId,
  checklist,
  comparison,
  timeline,
  related,
  onSuggestionClick,
}: AnswerBlockProps) {
  const sourceCount = sources?.length ?? 0;
  const durationSec = durationMs !== null ? (durationMs / 1000).toFixed(1) : null;

  return (
    <article className="flex flex-col gap-4">
      {/* Section 1: Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
        {confidence && <ConfidenceBadge level={confidence.level} score={confidence.score} />}
        <span>{sourceCount} 출처</span>
        {durationSec && <span>분석 {durationSec}s</span>}
        {/* Action buttons — copy / regenerate */}
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

      {/* Section 2: Expert review callout (REQ-STRUCT-028 Step 2) */}
      {expertReviewRequired && (
        <Callout variant="expert" title="전문가 검토 필요">
          전문가 검토가 필요한 내용입니다. 규제 전문가의 확인 후 결정을 내리시기 바랍니다.
        </Callout>
      )}

      {/* Section 3: Prose (REQ-STRUCT-028 Step 3) */}
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

      {/* Section 4+5: Checklist (REQ-STRUCT-028 Steps 4~5) */}
      {checklist && (
        <section>
          <p className="section-label mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            핵심 체크리스트
          </p>
          {messageId && blockId ? (
            <Checklist
              blockId={blockId}
              messageId={messageId}
              items={checklist.items as ChecklistItem[]}
            />
          ) : (
            <Checklist
              blockId="preview"
              messageId="preview"
              items={checklist.items as ChecklistItem[]}
              readOnly
            />
          )}
        </section>
      )}

      {/* Section 6+7: Comparison Table (REQ-STRUCT-028 Steps 6~7) */}
      {comparison && (
        <section>
          <p className="section-label mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            주요 관할권별 비교
          </p>
          <ComparisonTable title={comparison.title} cols={comparison.cols} rows={comparison.rows} />
        </section>
      )}

      {/* Section 8+9: Timeline (REQ-STRUCT-028 Steps 8~9) */}
      {timeline && (
        <section>
          <p className="section-label mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            실행 타임라인
          </p>
          <Timeline items={timeline.items} />
        </section>
      )}

      {/* Section 10: Sources (REQ-STRUCT-028 Step 10) */}
      {sourceCount > 0 && (
        <section>
          <p className="section-label mb-3 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            출처 ({sourceCount})
          </p>
          <SourcesGrid sources={sources ?? []} />
        </section>
      )}

      {/* Section 11: Related suggestions (REQ-STRUCT-028 Step 11) */}
      {related && related.length > 0 && (
        <section>
          <p className="section-label mb-2 font-serif text-[10px] uppercase tracking-widest text-ink-400">
            이어서 질문하기
          </p>
          <div className="flex flex-wrap gap-2">
            {related.map((text, idx) => (
              <SuggestionPill key={idx} text={text} onClick={() => onSuggestionClick?.(text)} />
            ))}
          </div>
        </section>
      )}

      {/* DocViewer modal — lazy loaded */}
      <DocViewer />
    </article>
  );
}
