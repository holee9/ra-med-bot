'use client';

/**
 * ExportHub component - Main export interface
 * REQ-EXP-001: Export Hub UI component with format selection
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 * @MX:NOTE ExportHub integrates Phase 1 export infrastructure with UI
 */

import type { ExportResult } from '@/lib/export/types';
import { useState } from 'react';
import { ExportButton } from './ExportButton';
import { type ExportArtifact, FormatOptions } from './FormatOptions';

interface ExportHubProps {
  conversationId?: string;
  messageId?: string;
  artifact: ExportArtifact;
  disabled?: boolean;
}

export function ExportHub({
  conversationId,
  messageId,
  artifact,
  disabled = false,
}: ExportHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isDisabled =
    disabled || !artifact.content.trim() || conversationId === '' || messageId === '';

  const handleExported = (result: ExportResult) => {
    setStatusMessage(
      result.format === 'email'
        ? '이메일 앱을 열었습니다'
        : `${result.filename ?? '파일'} 내보내기 완료`,
    );
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleError = (error: Error) => {
    setStatusMessage(`내보내기 실패: ${error.message}`);
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="relative">
      <ExportButton onClick={() => setIsOpen(!isOpen)} disabled={isDisabled} isOpen={isOpen} />
      {isOpen && (
        <FormatOptions
          artifact={artifact}
          onClose={() => setIsOpen(false)}
          onExported={handleExported}
          onError={handleError}
        />
      )}
      {statusMessage && (
        <output className="absolute right-0 top-full mt-1 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-[11px] text-ink-600 shadow-sm">
          {statusMessage}
        </output>
      )}
    </div>
  );
}
