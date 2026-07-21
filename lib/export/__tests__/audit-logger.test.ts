/**
 * Unit tests for export audit logging helper
 * REQ-EXP-006: Export operations must be audited
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAudit } from '../../kernel/audit';
import { logExport } from '../audit-logger';
import { ExportFormat, ExportOptions } from '../types';

// Mock writeAudit
vi.mock('../../kernel/audit', () => ({
  writeAudit: vi.fn(),
}));

describe('Export Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log markdown export', async () => {
    await logExport({
      actorId: 'user-123',
      format: ExportFormat.MARKDOWN,
      resourceType: 'conversation',
      resourceId: 'conv-456',
      options: { format: ExportFormat.MARKDOWN },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-123',
      action: 'export.markdown',
      resource_type: 'conversation',
      resource_id: 'conv-456',
      meta_json: {
        format: 'markdown',
      },
    });
  });

  it('should log docx export', async () => {
    await logExport({
      actorId: 'user-789',
      format: ExportFormat.DOCX,
      resourceType: 'message',
      resourceId: 'msg-101',
      options: { format: ExportFormat.DOCX },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-789',
      action: 'export.docx',
      resource_type: 'message',
      resource_id: 'msg-101',
      meta_json: {
        format: 'docx',
      },
    });
  });

  it('should log pdf export', async () => {
    await logExport({
      actorId: null,
      format: ExportFormat.PDF,
      resourceType: 'conversation',
      resourceId: 'conv-202',
      options: { format: ExportFormat.PDF },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: null,
      action: 'export.pdf',
      resource_type: 'conversation',
      resource_id: 'conv-202',
      meta_json: {
        format: 'pdf',
      },
    });
  });

  it('should log email export with recipient', async () => {
    await logExport({
      actorId: 'user-303',
      format: ExportFormat.MARKDOWN,
      resourceType: 'conversation',
      resourceId: 'conv-404',
      options: {
        format: ExportFormat.MARKDOWN,
      },
      integrationType: 'email',
      integrationMeta: {
        recipient: 'test@example.com',
      },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-303',
      action: 'export.email',
      resource_type: 'conversation',
      resource_id: 'conv-404',
      meta_json: {
        format: 'markdown',
        recipient: 'test@example.com',
      },
    });
  });

  it('should log confluence export with space', async () => {
    await logExport({
      actorId: 'user-505',
      format: ExportFormat.DOCX,
      resourceType: 'project',
      resourceId: 'proj-606',
      options: {
        format: ExportFormat.DOCX,
      },
      integrationType: 'confluence',
      integrationMeta: {
        space: 'TEST',
        pageTitle: 'Test Page',
      },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-505',
      action: 'export.confluence',
      resource_type: 'project',
      resource_id: 'proj-606',
      meta_json: {
        format: 'docx',
        space: 'TEST',
        pageTitle: 'Test Page',
      },
    });
  });

  it('should include conversationId if provided', async () => {
    await logExport({
      actorId: 'user-707',
      format: ExportFormat.MARKDOWN,
      resourceType: 'conversation',
      resourceId: 'conv-808',
      options: {
        format: ExportFormat.MARKDOWN,
      },
      conversationId: 'conv-808',
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-707',
      action: 'export.markdown',
      resource_type: 'conversation',
      resource_id: 'conv-808',
      conversation_id: 'conv-808',
      meta_json: {
        format: 'markdown',
      },
    });
  });

  it('should include custom options in meta', async () => {
    await logExport({
      actorId: 'user-909',
      format: ExportFormat.PDF,
      resourceType: 'conversation',
      resourceId: 'conv-1010',
      options: {
        format: ExportFormat.PDF,
        includeMetadata: true,
        includeTimestamp: true,
        customFilename: 'custom.pdf',
      },
    });

    expect(writeAudit).toHaveBeenCalledWith({
      actor_id: 'user-909',
      action: 'export.pdf',
      resource_type: 'conversation',
      resource_id: 'conv-1010',
      meta_json: {
        format: 'pdf',
        includeMetadata: true,
        includeTimestamp: true,
        customFilename: 'custom.pdf',
      },
    });
  });
});
