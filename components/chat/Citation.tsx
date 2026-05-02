'use client';

// @MX:NOTE Citation — inline <sup> component with deep-link support.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-041, REQ-CHAT-042)

import { useCallback } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useDocViewer } from '../../hooks/useDocViewer';

interface CitationProps {
  sourceIndex: number;
  offset: number;
  sourceId?: string;
}

export function Citation({ sourceIndex, offset, sourceId = '' }: CitationProps) {
  const { open } = useDocViewer();

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      open(sourceIndex, offset, sourceId);
    },
    [open, sourceIndex, offset, sourceId],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(sourceIndex, offset, sourceId);
      }
    },
    [open, sourceIndex, offset, sourceId],
  );

  return (
    <sup
      className="cite bg-brand-100 text-brand-700 font-mono text-[10px] font-semibold rounded-[3px] cursor-pointer hover:bg-brand-600 hover:text-white transition-colors px-0.5"
      data-source={sourceIndex}
      data-offset={offset}
      role="button"
      tabIndex={0}
      aria-label={`Source ${sourceIndex}, click to view`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {sourceIndex}
    </sup>
  );
}
