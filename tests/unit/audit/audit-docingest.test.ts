// RED Phase: Tests for lib/audit.ts extension (document audit actions)
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8A-7

import { describe, expect, it } from 'vitest';
import type { AuditAction } from '@/lib/audit';

describe('AuditAction type includes document actions', () => {
  // These tests verify that the AuditAction union type includes
  // the 6 new document-related actions added in Phase 8A.

  const documentActions: AuditAction[] = [
    'document.upload',
    'document.access',
    'document.redact',
    'document.chunk',
    'document.search',
    'redaction_map.access',
  ];

  it('should include document.upload action', () => {
    const action: AuditAction = 'document.upload';
    expect(action).toBe('document.upload');
  });

  it('should include document.access action', () => {
    const action: AuditAction = 'document.access';
    expect(action).toBe('document.access');
  });

  it('should include document.redact action', () => {
    const action: AuditAction = 'document.redact';
    expect(action).toBe('document.redact');
  });

  it('should include document.chunk action', () => {
    const action: AuditAction = 'document.chunk';
    expect(action).toBe('document.chunk');
  });

  it('should include document.search action', () => {
    const action: AuditAction = 'document.search';
    expect(action).toBe('document.search');
  });

  it('should include redaction_map.access action', () => {
    const action: AuditAction = 'redaction_map.access';
    expect(action).toBe('redaction_map.access');
  });

  it('all 6 document actions should be valid AuditAction values', () => {
    // If this compiles without error, the type includes all 6 values
    for (const action of documentActions) {
      expect(typeof action).toBe('string');
    }
  });
});
