/**
 * Unit tests for export audit action types
 * REQ-EXP-006: Export operations must be audited
 */

import { describe, expect, it } from 'vitest';
import type { AuditAction } from '../../audit';

describe('Export Audit Action Types', () => {
  it('should have export.markdown as valid AuditAction', () => {
    // Type check only - if the type doesn't exist, TypeScript will fail
    const action: AuditAction = 'export.markdown';
    expect(action).toBe('export.markdown');
  });

  it('should have export.docx as valid AuditAction', () => {
    const action: AuditAction = 'export.docx';
    expect(action).toBe('export.docx');
  });

  it('should have export.pdf as valid AuditAction', () => {
    const action: AuditAction = 'export.pdf';
    expect(action).toBe('export.pdf');
  });

  it('should have export.email as valid AuditAction', () => {
    const action: AuditAction = 'export.email';
    expect(action).toBe('export.email');
  });

  it('should have export.confluence as valid AuditAction', () => {
    const action: AuditAction = 'export.confluence';
    expect(action).toBe('export.confluence');
  });

  it('should allow all export formats in AuditAction union', () => {
    const formats: AuditAction[] = [
      'export.markdown',
      'export.docx',
      'export.pdf',
      'export.email',
      'export.confluence',
    ];

    expect(formats).toHaveLength(5);
    expect(formats).toContain('export.markdown');
    expect(formats).toContain('export.docx');
    expect(formats).toContain('export.pdf');
    expect(formats).toContain('export.email');
    expect(formats).toContain('export.confluence');
  });
});
