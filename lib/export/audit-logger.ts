/**
 * Export audit logging helper
 * REQ-EXP-006: Export operations must be logged to audit trail
 */

import { writeAudit } from '../audit';
import { ExportFormat } from './types';

/**
 * Export audit log parameters
 */
export interface ExportAuditParams {
  /** User UUID who initiated the export, or null for system-initiated */
  actorId: string | null;
  /** Export format */
  format: ExportFormat;
  /** Type of resource being exported (e.g., 'conversation', 'message') */
  resourceType: string;
  /** ID of the resource being exported */
  resourceId: string;
  /** Optional conversation ID for conversation-specific exports */
  conversationId?: string;
  /** Export options used */
  options?: {
    format: ExportFormat;
    includeMetadata?: boolean;
    includeTimestamp?: boolean;
    customFilename?: string;
    template?: string;
  };
  /** Integration type for external exports (email, confluence) */
  integrationType?: 'email' | 'confluence';
  /** Additional metadata for integration exports */
  integrationMeta?: Record<string, unknown>;
}

/**
 * Map export format to audit action
 */
function getExportAction(
  format: ExportFormat,
  integrationType?: 'email' | 'confluence'
): string {
  if (integrationType === 'email') {
    return 'export.email';
  }
  if (integrationType === 'confluence') {
    return 'export.confluence';
  }

  switch (format) {
    case ExportFormat.MARKDOWN:
      return 'export.markdown';
    case ExportFormat.DOCX:
      return 'export.docx';
    case ExportFormat.PDF:
      return 'export.pdf';
    default:
      return 'export.markdown';
  }
}

/**
 * Log export operation to audit trail
 *
 * Records all export operations for compliance tracking (21 CFR Part 11).
 * This includes format exports (markdown, docx, pdf) and integration exports
 * (email, confluence).
 *
 * @param params - Export audit parameters
 * @returns Promise that resolves when audit log is written
 */
export async function logExport(params: ExportAuditParams): Promise<void> {
  const { actorId, format, resourceType, resourceId, conversationId, options, integrationType, integrationMeta } = params;

  // Build metadata JSON
  const metaJson: Record<string, unknown> = {
    format: format.replace('markdown', 'markdown'), // Normalize format name
    ...options,
  };

  // Add integration metadata if present
  if (integrationMeta) {
    Object.assign(metaJson, integrationMeta);
  }

  // Write audit log
  await writeAudit({
    actor_id: actorId,
    action: getExportAction(format, integrationType) as any,
    resource_type: resourceType,
    resource_id: resourceId,
    conversation_id: conversationId,
    meta_json: metaJson,
  });
}
