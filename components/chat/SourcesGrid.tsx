'use client';

// @MX:NOTE SourcesGrid — grid of SourceCards with 240px min column width.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-039)

import type { SourceItem } from '../../types/streaming';
import { SourceCard } from './SourceCard';

interface SourcesGridProps {
  sources: SourceItem[];
}

export function SourcesGrid({ sources }: SourcesGridProps) {
  if (sources.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
    >
      {sources.map((source) => (
        <SourceCard key={`${source.id}-${source.citeIndex}`} source={source} />
      ))}
    </div>
  );
}
