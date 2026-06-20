'use client';

/**
 * ExportHub component - Main export interface
 * REQ-EXP-001: Export Hub UI component with format selection
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001)
 * @MX:NOTE ExportHub integrates Phase 1 export infrastructure with UI
 */

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { ExportButton } from './ExportButton';
import { FormatOptions } from './FormatOptions';

interface ExportHubProps {
  conversationId: string;
  messageId: string;
}

export function ExportHub({ conversationId, messageId }: ExportHubProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isDisabled = !conversationId || !messageId;

  return (
    <div className="relative">
      <ExportButton
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled}
        isOpen={isOpen}
      />
      {isOpen && <FormatOptions onClose={() => setIsOpen(false)} />}
    </div>
  );
}
