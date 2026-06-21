/**
 * PDFExporter class
 * SPEC-REGULA-EXPORT-HUB-001 Phase 5 (T-022..T-025)
 * REQ-EXP-005: PDF export with branding, headers, footers, and layout
 * @MX:SPEC SPEC-REGULA-EXPORT-HUB-001
 */

import { BaseExporter } from '../base-exporter';
import { ExportFormat, type ExportOptions, type ExportResult } from '../types';
import { ExportErrorCode } from '../types';

/**
 * Data structure for PDF export
 */
interface PDFData {
  content: string;
  title?: string;
  metadata?: {
    author?: string;
    subject?: string;
  };
}

type PDFRenderer = Pick<
  typeof import('@react-pdf/renderer'),
  'Document' | 'Page' | 'Text' | 'View' | 'pdf'
>;

/**
 * PDFExporter - Export data to PDF format
 * Uses @react-pdf/renderer for PDF generation
 * @MX:NOTE Implements REQ-EXP-005 (PDF export with Regula branding)
 * @MX:NOTE T-022: Basic PDF generation, components will be added in T-023-T-025
 */
export class PDFExporter extends BaseExporter {
  private pdfRenderer: PDFRenderer | null;

  constructor() {
    super();
    // Lazy load @react-pdf/renderer to avoid React initialization issues
    this.pdfRenderer = null;
  }

  /**
   * Export data to PDF format
   */
  async export(data: unknown, options: ExportOptions): Promise<ExportResult> {
    try {
      this.validateOptions(options);

      if (!(await this.validate(data, options))) {
        return this.createErrorResult(
          options.format,
          ExportErrorCode.VALIDATION_ERROR,
          'Invalid data for PDF export',
        );
      }

      const pdfData = data as PDFData;

      // Generate PDF
      const pdfBytes = await this.generatePDF(pdfData);

      // Convert bytes to base64 string for storage/download.
      const base64Content = this.encodeBase64(pdfBytes);

      // Ensure .pdf extension
      const baseFilename = options.customFilename || `export-${this.getTimestamp()}`;
      const filename = baseFilename.endsWith('.pdf') ? baseFilename : `${baseFilename}.pdf`;

      // Calculate size
      const size = pdfBytes.length;

      return {
        success: true,
        format: options.format,
        content: base64Content,
        filename,
        size,
        timestamp: new Date(),
      };
    } catch (error) {
      return this.createErrorResult(
        options.format,
        ExportErrorCode.GENERATION_FAILED,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Validate that the export can be performed
   */
  async validate(data: unknown, options: ExportOptions): Promise<boolean> {
    if (options.format !== this.getFormat()) {
      return false;
    }

    const pdfData = data as PDFData;
    return !!pdfData?.content;
  }

  /**
   * Get the format this exporter handles
   */
  getFormat(): ExportFormat {
    return ExportFormat.PDF;
  }

  private encodeBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  /**
   * Generate PDF using @react-pdf/renderer
   * T-022: Basic PDF generation
   * T-023: Header with Regula branding
   * T-024: Footer with fixed page numbers
   * T-025: Page layout & print-ready styles
   * @MX:NOTE Part of REQ-EXP-005 implementation
   */
  private async generatePDF(data: PDFData): Promise<Uint8Array> {
    // Lazy import to avoid React initialization issues in tests
    if (!this.pdfRenderer) {
      const { Document, Page, Text, View, pdf } = await import('@react-pdf/renderer');
      this.pdfRenderer = { Document, Page, Text, View, pdf };
    }

    const { Document, Page, Text, View, pdf } = this.pdfRenderer;

    // Create document component with proper React structure
    const MyDocument = () => (
      <Document
        title={data.title || 'Regula Export'}
        author={data.metadata?.author || 'Regula'}
        subject={data.metadata?.subject || 'RA Consultation Export'}
        creator="Regula - Medical Device RA Assistant"
      >
        <Page size="A4" style={styles.page}>
          {/* Header with Regula branding */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Regula - Medical Device RA Assistant</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {data.title && <Text style={styles.title}>{data.title}</Text>}
            <Text style={styles.body}>{data.content}</Text>
          </View>

          {/* Footer with page numbers */}
          <View style={styles.footer} fixed>
            <Text
              style={styles.footerText}
              render={({ pageNumber }: { pageNumber: number }) => `Page ${pageNumber}`}
            />
          </View>
        </Page>
      </Document>
    );

    // Generate PDF blob
    const pdfInstance = await pdf(<MyDocument />).toBlob();
    const arrayBuffer = await pdfInstance.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Generate timestamp for filename
   * Format: YYYYMMDDHHmmss
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}

/**
 * PDF styles
 * @MX:NOTE Print-ready styling (REQ-EXP-005)
 */
const styles = {
  page: {
    flexDirection: 'column',
    backgroundColor: 'white',
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid rgb(224, 224, 224)',
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgb(44, 82, 130)',
  },
  content: {
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'rgb(26, 32, 44)',
  },
  body: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'rgb(45, 55, 72)',
    marginBottom: 10,
  },
  footer: {
    marginTop: 20,
    borderTop: '1 solid rgb(224, 224, 224)',
    paddingTop: 10,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 10,
    color: 'rgb(113, 128, 150)',
  },
} as const;
