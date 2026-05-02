'use client';

// @MX:NOTE SuggestionPill — rounded-full pill with Plus icon, prefill on click.
// Does NOT auto-submit — prefill only (REQ-STRUCT-027).
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-026~027)

import { Plus } from 'lucide-react';

interface SuggestionPillProps {
  text: string;
  onClick: () => void;
}

export function SuggestionPill({ text, onClick }: SuggestionPillProps) {
  return (
    <button
      type="button"
      role="button"
      onClick={onClick}
      aria-label={`이어서 질문하기: ${text}`}
      className="flex items-center gap-1.5 rounded-full border border-subtle px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
    >
      <Plus size={14} className="text-ink-400 flex-shrink-0" aria-hidden="true" />
      <span className="text-left">{text}</span>
    </button>
  );
}
