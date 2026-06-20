'use client';

/**
 * FormatOptions component - Export format selection menu
 * REQ-EXP-001: Export format option cards (DOCX, PDF, Markdown, Email)
 * REQ-EXP-002: Format-specific export handlers
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001, REQ-EXP-002)
 */

import { FileText, File, Mail, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ExportFormat, ExportOptions } from '@/lib/export/types';
import { MarkdownExporter } from '@/lib/export/exporters/markdown-exporter';
import { DOCXExporter } from '@/lib/export/exporters/docx-exporter';

interface FormatOptionsProps {
  onClose: () => void;
}

const formats = [
  {
    format: ExportFormat.DOCX,
    label: 'DOCX',
    description: 'Word 문서로 내보내기',
    icon: FileText,
  },
  {
    format: ExportFormat.PDF,
    label: 'PDF',
    description: 'PDF로 내보내기',
    icon: File,
  },
  {
    format: ExportFormat.MARKDOWN,
    label: 'Markdown',
    description: '마크다운으로 내보내기',
    icon: FileText,
  },
  {
    format: 'email' as const,
    label: '이메일',
    description: '이메일로 전송',
    icon: Mail,
  },
];

export function FormatOptions({ onClose }: FormatOptionsProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat | 'email') => {
    if (format === 'email') {
      // TODO: Implement email export in Phase 6
      console.log('Email export: Coming in Phase 6');
      onClose();
      return;
    }

    setIsExporting(true);

    try {
      const options: ExportOptions = {
        format,
        includeMetadata: true,
        includeTimestamp: true,
      };

      // Select appropriate exporter
      let result;
      switch (format) {
        case ExportFormat.MARKDOWN:
          const markdownExporter = new MarkdownExporter();
          result = await markdownExporter.export(
            {
              content: 'Regula Answer Export', // TODO: Get actual content from message
              citations: [
                // TODO: Get actual citations from message
              ],
            },
            options
          );
          break;

        case ExportFormat.DOCX:
          const docxExporter = new DOCXExporter();
          result = await docxExporter.export(
            {
              content: 'Regula Answer Export', // TODO: Get actual content from message
              title: 'Regula Regulatory Analysis',
              author: 'RA Lead',
              citations: [
                // TODO: Get actual citations from message
              ],
              convertHeaders: true,
              addBranding: true,
            },
            options
          );
          break;

        case ExportFormat.PDF:
          // TODO: Implement in Phase 5
          console.log(`${format} export: Coming in Phase 5`);
          onClose();
          return;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (result?.success && result.content) {
        // Download the file
        let mimeType = 'text/plain';
        if (format === ExportFormat.MARKDOWN) {
          mimeType = 'text/markdown';
        } else if (format === ExportFormat.DOCX) {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        // For DOCX, convert base64 back to blob
        let content = result.content;
        if (format === ExportFormat.DOCX) {
          const binaryString = atob(content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          content = bytes;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'export';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Export failed:', result?.error);
        alert('내보내기 실패: ' + (result?.error?.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 오류: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 w-64 rounded-md border border-surface-200 bg-white shadow-lg z-50"
      role="menu"
      aria-label="내보내기 형식 선택"
    >
      <div className="py-1">
        {formats.map((format) => {
          const Icon = format.icon;
          return (
            <button
              key={format.format}
              type="button"
              onClick={() => handleExport(format.format)}
              disabled={isExporting}
              className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm hover:bg-surface-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              role="menuitem"
            >
              <Icon size={18} className="text-ink-500" />
              <div className="flex-1">
                <div className="font-medium text-ink-900">{format.label}</div>
                <div className="text-xs text-ink-500">{format.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
