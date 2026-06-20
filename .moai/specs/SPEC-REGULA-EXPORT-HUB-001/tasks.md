# Task Decomposition - SPEC-REGULA-EXPORT-HUB-001

**Status**: Draft
**Created**: 2026-06-20
**Methodology**: TDD (RED-GREEN-REFACTOR)

## Phase 1: Core Export Infrastructure (Foundation)

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-001 | Define export types and interfaces | REQ-EXP-001 | - | lib/export/types.ts | P1 |
| T-002 | Create export audit action types and DB migration | REQ-EXP-006 | T-001 | migrations/0043_export_audit_actions.sql, lib/db/schema.ts | P1 |
| T-003 | Implement base exporter interface | REQ-EXP-001 | T-001 | lib/export/base-exporter.ts | P1 |
| T-004 | Add export audit logging helper | REQ-EXP-006 | T-002, T-003 | lib/export/audit-logger.ts | P1 |
| T-005 | Write unit tests for export types and audit logging | REQ-EXP-006 | T-001, T-002, T-004 | lib/export/__tests__/types.test.ts, lib/export/__tests__/audit-logger.test.ts | P1 |

## Phase 2: Export Hub UI Component

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-006 | Design ExportHub component with format selection UI | REQ-EXP-001 | T-001 | components/export/ExportHub.tsx | P1 |
| T-007 | Implement ExportButton trigger component | REQ-EXP-001 | T-006 | components/export/ExportButton.tsx | P1 |
| T-008 | Add export format option cards (DOCX, PDF, Markdown, Email) | REQ-EXP-001, REQ-EXP-002 | T-006 | components/export/FormatOptions.tsx | P1 |
| T-009 | Implement export state management (loading, success, error) | REQ-EXP-001 | T-006 | components/export/useExportState.ts | P1 |
| T-010 | Write component tests for ExportHub UI | REQ-EXP-001 | T-006, T-007, T-008, T-009 | components/export/__tests__/ExportHub.test.tsx | P1 |

## Phase 3: Markdown Export Implementation

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-011 | Implement MarkdownExporter class | REQ-EXP-003 | T-003 | lib/export/exporters/markdown-exporter.ts | P1 |
| T-012 | Add citation formatting for Markdown | REQ-EXP-002 | T-011 | lib/export/exporters/markdown-exporter.ts | P1 |
| T-013 | Implement section header conversion for Markdown | REQ-EXP-002 | T-011 | lib/export/exporters/markdown-exporter.ts | P1 |
| T-014 | Write unit tests for MarkdownExporter | REQ-EXP-002, REQ-EXP-003 | T-011, T-012, T-013 | lib/export/__tests__/markdown-exporter.test.ts | P1 |
| T-015 | Integrate Markdown export with ExportHub | REQ-EXP-001, REQ-EXP-003 | T-006, T-011 | components/export/ExportHub.tsx | P1 |

## Phase 4: DOCX Export Implementation

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-016 | Implement DOCXExporter using docx library | REQ-EXP-002 | T-003 | lib/export/exporters/docx-exporter.ts | P1 |
| T-017 | Add DOCX citation formatting with hyperlinks | REQ-EXP-002 | T-016 | lib/export/exporters/docx-exporter.ts | P1 |
| T-018 | Implement DOCX section headers with styles | REQ-EXP-002 | T-016 | lib/export/exporters/docx-exporter.ts | P1 |
| T-019 | Add DOCX metadata (title, author, created date) | REQ-EXP-002 | T-016 | lib/export/exporters/docx-exporter.ts | P1 |
| T-020 | Write unit tests for DOCXExporter | REQ-EXP-002 | T-016, T-017, T-018, T-019 | lib/export/__tests__/docx-exporter.test.ts | P1 |
| T-021 | Integrate DOCX export with ExportHub | REQ-EXP-001, REQ-EXP-002 | T-006, T-016 | components/export/ExportHub.tsx | P1 |

## Phase 5: PDF Export Implementation

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-022 | Implement PDFExporter using @react-pdf/renderer | REQ-EXP-002 | T-003 | lib/export/exporters/pdf-exporter.ts | P1 |
| T-023 | Add PDF header with Regula branding | REQ-EXP-002 | T-022 | lib/export/exporters/pdf-exporter.ts, components/export/pdf/PDFHeader.tsx | P1 |
| T-024 | Implement PDF footer with page numbers | REQ-EXP-002 | T-022 | lib/export/exporters/pdf-exporter.ts, components/export/pdf/PDFFooter.tsx | P1 |
| T-025 | Add PDF document layout and content rendering | REQ-EXP-002 | T-022 | lib/export/exporters/pdf-exporter.ts, components/export/pdf/PDFDocument.tsx | P1 |
| T-026 | Write unit tests for PDFExporter | REQ-EXP-002 | T-022, T-023, T-024, T-025 | lib/export/__tests__/pdf-exporter.test.ts | P1 |
| T-027 | Integrate PDF export with ExportHub | REQ-EXP-001, REQ-EXP-002 | T-006, T-022 | components/export/ExportHub.tsx | P1 |

## Phase 6: Email Forward Implementation

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-028 | Implement EmailExporter for mailto link generation | REQ-EXP-004 | T-003 | lib/export/exporters/email-exporter.ts | P1 |
| T-029 | Add email subject line formatting with artifact type | REQ-EXP-004 | T-028 | lib/export/exporters/email-exporter.ts | P1 |
| T-030 | Implement email body formatting with artifact content | REQ-EXP-004 | T-028 | lib/export/exporters/email-exporter.ts | P1 |
| T-031 | Add attachment option for DOCX/PDF formats | REQ-EXP-004 | T-028 | lib/export/exporters/email-exporter.ts | P1 |
| T-032 | Write unit tests for EmailExporter | REQ-EXP-004 | T-028, T-029, T-030, T-031 | lib/export/__tests__/email-exporter.test.ts | P1 |
| T-033 | Integrate email export with ExportHub | REQ-EXP-001, REQ-EXP-004 | T-006, T-028 | components/export/ExportHub.tsx | P1 |

## Phase 7: Confluence Integration (Feature-Flagged)

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-034 | Add CONFLUENCE_EXPORT feature flag to feature-flags.ts | REQ-EXP-005 | - | lib/feature-flags.ts | P2 |
| T-035 | Create ConfluenceApiClient for page CRUD operations | REQ-EXP-005 | T-034 | lib/export/integrations/confluence-api.ts | P2 |
| T-036 | Implement ConfluenceExporter with authentication | REQ-EXP-005 | T-003, T-034, T-035 | lib/export/exporters/confluence-exporter.ts | P2 |
| T-037 | Add user Confluence configuration (URL, credentials) | REQ-EXP-005 | T-034 | lib/export/integrations/confluence-config.ts | P2 |
| T-038 | Write unit tests for Confluence integration | REQ-EXP-005 | T-034, T-035, T-036, T-037 | lib/export/__tests__/confluence-exporter.test.ts | P2 |
| T-039 | Integrate Confluence export with ExportHub (gated) | REQ-EXP-001, REQ-EXP-005 | T-006, T-034, T-036 | components/export/ExportHub.tsx | P2 |

## Phase 8: UI Integration Points

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-040 | Add ExportButton to AnswerBlock component | REQ-EXP-007 | T-007 | components/chat/AnswerBlock.tsx | P1 |
| T-041 | Add ExportButton to Checklist component | REQ-EXP-007 | T-007 | components/chat/Checklist.tsx | P1 |
| T-042 | Add ExportButton to ComparisonTable component | REQ-EXP-007 | T-007 | components/chat/ComparisonTable.tsx | P1 |
| T-043 | Write integration tests for ExportButton placement | REQ-EXP-007 | T-040, T-041, T-042 | components/chat/__tests__/export-integration.test.tsx | P1 |
| T-044 | Add keyboard shortcut (Ctrl+E) for export trigger | REQ-EXP-001 | T-007 | components/export/useExportKeyboard.ts | P2 |

## Phase 9: Performance Optimization

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-045 | Implement async export with progress indicators | REQ-EXP-001 | T-009 | components/export/useExportProgress.ts | P2 |
| T-046 | Add export cancellation support | REQ-EXP-001 | T-045 | components/export/useExportCancellation.ts | P2 |
| T-047 | Optimize DOCX generation for large documents (>50 pages) | NFR-001 | T-016 | lib/export/exporters/docx-exporter.ts | P2 |
| T-048 | Optimize PDF generation with lazy rendering | NFR-001 | T-022 | lib/export/exporters/pdf-exporter.ts | P2 |
| T-049 | Write performance tests for export operations | NFR-001, NFR-002 | T-047, T-048 | lib/export/__tests__/performance.test.ts | P2 |

## Phase 10: E2E Testing

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-050 | Create E2E test setup for export functionality | REQ-EXP-001 ~ REQ-EXP-007 | T-010 | tests/e2e/export-hub.spec.ts | P1 |
| T-051 | Write E2E test for Markdown export flow | REQ-EXP-003 | T-015, T-050 | tests/e2e/export-hub.spec.ts | P1 |
| T-052 | Write E2E test for DOCX export flow | REQ-EXP-002 | T-021, T-050 | tests/e2e/export-hub.spec.ts | P1 |
| T-053 | Write E2E test for PDF export flow | REQ-EXP-002 | T-027, T-050 | tests/e2e/export-hub.spec.ts | P1 |
| T-054 | Write E2E test for email export flow | REQ-EXP-004 | T-033, T-050 | tests/e2e/export-hub.spec.ts | P1 |
| T-055 | Write E2E test for audit logging on all exports | REQ-EXP-006 | T-004, T-050 | tests/e2e/export-hub.spec.ts | P1 |
| T-056 | Write E2E test for Confluence export (gated) | REQ-EXP-005 | T-039, T-050 | tests/e2e/export-hub.spec.ts | P2 |

## Phase 11: Documentation and Cleanup

| Task ID | Description | Requirement | Dependencies | Planned Files | Priority |
|---------|-------------|-------------|--------------|---------------|----------|
| T-057 | Add @MX tags to all export functions | TRUST-5 | All implementation tasks | lib/export/**/*.ts, components/export/**/*.tsx | P2 |
| T-058 | Create export documentation page | REQ-EXP-001 ~ REQ-EXP-007 | All implementation tasks | app/(app)/export/page.tsx | P2 |
| T-059 | Update CHANGELOG with export features | TRUST-5 | All tasks | CHANGELOG.md | P2 |
| T-060 | Run TRUST 5 validation and fix issues | TRUST-5 | All tasks | Various | P1 |

## Summary

**Total Tasks**: 60
**Priority P1 (Core)**: 37 tasks
**Priority P2 (Optional/Enhancement)**: 23 tasks

**Critical Path**:
T-001 → T-002 → T-003 → T-004 → T-006 → T-011 → T-016 → T-022 → T-028 → T-040 → T-050

**Acceptance Criteria Mapping**:
1. DOCX export: T-016, T-017, T-018, T-019, T-021, T-052
2. PDF export: T-022, T-023, T-024, T-025, T-027, T-053
3. Markdown export: T-011, T-012, T-013, T-015, T-051
4. Email forward: T-028, T-029, T-030, T-031, T-033, T-054
5. Confluence push: T-034, T-035, T-036, T-037, T-039, T-056
6. All export events in audit log: T-002, T-004, T-055
7. Export hub accessible from views: T-040, T-041, T-042, T-043

---

## Task Detail Specifications

### T-001: Define export types and interfaces
**Acceptance Criteria**:
- ExportFormat enum: DOCX, PDF, MARKDOWN, EMAIL, CONFLUENCE
- ExportArtifact interface with type, content, metadata fields
- ExportOptions interface with format, destination, includeCitations
- ExportResult interface with success, data, error fields

### T-002: Create export audit action types and DB migration
**Acceptance Criteria**:
- Migration adds export.docx, export.pdf, export.markdown, export.email, export.confluence audit actions
- Schema.ts updated with new enum values
- Migration file follows naming convention 0043_export_audit_actions.sql

### T-003: Implement base exporter interface
**Acceptance Criteria**:
- BaseExporter abstract class with export() method
- Protected methods for audit logging, format validation
- Error handling for unsupported formats

### T-004: Add export audit logging helper
**Acceptance Criteria**:
- writeExportAudit() function calling existing writeAudit()
- Captures: artifact type, format, destination, timestamp, user ID
- Integrated with BaseExporter

### T-016: Implement DOCXExporter using docx library
**Acceptance Criteria**:
- Uses existing docx package dependency
- Generates .docx files with proper formatting
- Handles citations as hyperlinks
- Preserves section headers with hierarchy

### T-022: Implement PDFExporter using @react-pdf/renderer
**Acceptance Criteria**:
- Uses existing @react-pdf/renderer dependency
- Generates print-ready PDF with A4 page size
- Includes Regula header on first page
- Includes page numbers in footer

### T-028: Implement EmailExporter
**Acceptance Criteria**:
- Generates mailto: link with pre-filled subject
- Formats artifact content as email body
- Supports attachment option for DOCX/PDF
- Opens user's default mail client

### T-034: Add CONFLUENCE_EXPORT feature flag
**Acceptance Criteria**:
- FEATURE_FLAGS.CONFLUENCE_EXPORT added
- isFeatureEnabled('CONFLUENCE_EXPORT') checks env var
- Confluence export gated behind flag

### T-040: Add ExportButton to AnswerBlock
**Acceptance Criteria**:
- Button positioned in answer metadata row
- Passes answer content and citations to export
- Triggers ExportHub with correct artifact type

---

**Generated**: 2026-06-20
**Methodology**: TDD (RED-GREEN-REFACTOR)
**Test Coverage Target**: 85%+
