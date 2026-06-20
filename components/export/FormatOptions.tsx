'use client';

/**
 * FormatOptions component - Export format selection menu
 * REQ-EXP-001: Export format option cards (DOCX, PDF, Markdown, Email)
 * REQ-EXP-002: Format-specific export handlers
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001 (REQ-EXP-001, REQ-EXP-002)
 */

import { DOCXExporter } from '@/lib/export/exporters/docx-exporter';
import { EmailExporter } from '@/lib/export/exporters/email-exporter';
import { MarkdownExporter } from '@/lib/export/exporters/markdown-exporter';
import { PDFExporter } from '@/lib/export/exporters/pdf-exporter';
import { ExportFormat, type ExportOptions, type ExportResult } from '@/lib/export/types';
import { File, FileText, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface ExportCitation {
  text: string;
  url?: string;
  source?: string;
  offset?: number;
}

export interface ExportArtifact {
  title: string;
  content: string;
  artifactType: 'answer' | 'checklist' | 'comparison' | 'artifact';
  citations?: ExportCitation[];
  filenameBase?: string;
}

interface FormatOptionsProps {
  artifact: ExportArtifact;
  onClose: () => void;
  onExported?: (result: ExportResult) => void;
  onError?: (error: Error) => void;
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
    format: ExportFormat.EMAIL,
    label: '이메일',
    description: '이메일로 전송',
    icon: Mail,
  },
];

export function FormatOptions({ artifact, onClose, onExported, onError }: FormatOptionsProps) {
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

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);

    try {
      const options: ExportOptions = {
        format,
        includeMetadata: true,
        includeTimestamp: true,
        customFilename: artifact.filenameBase,
      };

      // Select appropriate exporter
      let result: ExportResult;
      switch (format) {
        case ExportFormat.MARKDOWN: {
          const markdownExporter = new MarkdownExporter();
          result = await markdownExporter.export(
            {
              content: artifact.content,
              citations: artifact.citations?.map((citation) => ({
                text: citation.text,
                url: citation.url,
              })),
            },
            options,
          );
          break;
        }

        case ExportFormat.DOCX: {
          const docxExporter = new DOCXExporter();
          result = await docxExporter.export(
            {
              content: artifact.content,
              title: artifact.title,
              author: 'RA Lead',
              citations: artifact.citations?.map((citation) => ({
                text: citation.text,
                url: citation.url,
              })),
              convertHeaders: true,
              addBranding: true,
            },
            options,
          );
          break;
        }

        case ExportFormat.PDF: {
          const pdfExporter = new PDFExporter();
          result = await pdfExporter.export(
            {
              content: artifact.content,
              title: artifact.title,
              metadata: {
                author: 'Regula',
                subject: `${artifact.artifactType} export`,
              },
            },
            options,
          );
          break;
        }

        case ExportFormat.EMAIL: {
          const emailExporter = new EmailExporter();
          result = await emailExporter.export(
            {
              title: artifact.title,
              content: artifact.content,
              artifactType: artifact.artifactType,
              citations: artifact.citations?.map((citation) => ({
                source: citation.source ?? citation.text,
                offset: citation.offset ?? 0,
              })),
            },
            options,
          );
          break;
        }

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (result.success && result.content) {
        // Download the file
        let mimeType = 'text/plain';
        if (format === ExportFormat.MARKDOWN) {
          mimeType = 'text/markdown';
        } else if (format === ExportFormat.DOCX) {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (format === ExportFormat.PDF) {
          mimeType = 'application/pdf';
        }

        if (format === ExportFormat.EMAIL) {
          onExported?.(result);
          return;
        }

        // For binary exports, convert base64 back to blob.
        let blob: Blob;
        if (format === ExportFormat.DOCX || format === ExportFormat.PDF) {
          const binaryString = atob(result.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mimeType });
        } else {
          blob = new Blob([result.content], { type: mimeType });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename || 'export';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onExported?.(result);
      } else {
        const error = result.error ?? new Error('알 수 없는 오류');
        onError?.(error);
        alert(`내보내기 실패: ${error.message}`);
      }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('알 수 없는 오류');
      onError?.(normalized);
      alert(`내보내기 오류: ${normalized.message}`);
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
