# SPEC-REGULA-EXPORT-HUB-001

## Metadata
- Issue: #87
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: Wave 5 — Multi-format export

## Purpose
Provide a unified export hub for all Regula outputs (answers, checklists, comparison tables,
510(k) drafts, CER sections, eSTAR packages) to external systems including Word, Confluence,
Notion, email, and QMS platforms.

## Scope
- Covers: Export to DOCX, PDF, Markdown, email forward, Confluence page, Notion block
- Out of scope: Import from external systems, real-time sync, version control of exported artifacts

## User Story
As an RA Lead, I want to export any Regula output to my QMS or document system in one click
so that I don't have to manually reformat regulatory artifacts.

## Requirements (EARS format)

WHEN a user selects one or more output artifacts, THE SYSTEM SHALL present an export hub with available format options.

WHEN a user exports to DOCX, THE SYSTEM SHALL generate a formatted Word document preserving citations, section headers, and regulatory references.

WHEN a user exports to PDF, THE SYSTEM SHALL generate a print-ready PDF with Regula branding and page numbers.

WHEN a user selects email forward, THE SYSTEM SHALL compose a pre-formatted email with the artifact as body or attachment.

IF a user has Confluence integration configured, THEN THE SYSTEM SHALL allow direct push to a specified Confluence page.

WHEN an export completes, THE SYSTEM SHALL record the export event in the audit log: artifact type, format, destination, timestamp, user ID.

## Acceptance Criteria
1. DOCX export: citations preserved, section headers formatted, downloadable
2. PDF export: print-ready, includes Regula header/footer
3. Markdown export: clean, copy-pasteable
4. Email forward: opens mail client with pre-filled subject and body
5. Confluence push: creates or updates page at user-configured URL (if integration enabled)
6. All export events in audit log
7. Export hub accessible from answer view, checklist view, and draft view

## Non-Functional Requirements
- DOCX/PDF generation: < 5s for documents up to 50 pages
- Export hub UI loads: < 500ms

## Dependencies
- Audit log infrastructure
- Wave 3/4 output types (answer blocks, checklists, 510(k) drafts, eSTAR)

## Definition of Done
- DOCX + PDF + Markdown + email working
- Audit log for all exports
- Confluence integration optional (feature-flagged)
- Tests covering each format type
