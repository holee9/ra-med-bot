'use client';

/**
 * ExportButton component - Trigger button for export menu
 * REQ-EXP-001: Export button trigger component
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 * @MX:NOTE ExportButton follows existing action button pattern from chat components
 */

import { FileText } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  disabled: boolean;
  isOpen: boolean;
}

export function ExportButton({ onClick, disabled, isOpen }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isOpen}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-ink-700 hover:text-ink-900 disabled:text-ink-300 disabled:cursor-not-allowed hover:bg-surface-100 disabled:hover:bg-transparent transition-colors"
      aria-label="내보내기"
    >
      <FileText size={16} />
      <span>내보내기</span>
    </button>
  );
}
