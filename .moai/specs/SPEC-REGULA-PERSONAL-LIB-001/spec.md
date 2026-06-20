# SPEC-REGULA-PERSONAL-LIB-001

## Metadata
- Issue: #86
- Status: Draft
- Created: 2026-06-20
- Priority: Medium
- Category: Wave 5 — Personal RA workflow

## Purpose
Enable individual RA practitioners to bookmark answers, apply personal tags, and build
reusable cheatsheets for fast re-reference — distinct from team-level knowledge promotion (#50)
and project memory (#51).

## Scope
- Covers: Bookmark, personal tag, cheatsheet creation per user
- Out of scope: Team-shared bookmarks (use #50 KNOWLEDGE-PROMO), project-level memory (#51)

## User Story
As an RA Lead, I want to bookmark and tag answers I frequently reference so that I can
retrieve them instantly without re-querying the regulatory corpus.

## Requirements (EARS format)

WHEN a user views an answer, THE SYSTEM SHALL provide a bookmark action that saves the answer to their personal library.

WHEN a user bookmarks an answer, THE SYSTEM SHALL allow them to add personal tags (free-text, max 10 per bookmark).

WHEN a user opens their personal library, THE SYSTEM SHALL display bookmarks filterable by tag, date, and regulatory domain.

IF a user marks an answer as a cheatsheet item, THEN THE SYSTEM SHALL display it in a quick-access cheatsheet panel.

WHEN a user deletes a bookmark, THE SYSTEM SHALL record the deletion in the audit log with timestamp and user ID.

## Acceptance Criteria
1. Bookmark action available on every answer block
2. Tags: free-text, max 10 per bookmark, max 50 chars each
3. Personal library view: filter by tag, date range, domain
4. Cheatsheet panel: shows starred bookmarks, accessible from sidebar
5. Bookmark CRUD operations recorded in audit log
6. Personal library is user-scoped — not visible to other users
7. Bookmark survives session expiry (persisted in DB)

## Non-Functional Requirements
- Bookmark add/remove: < 300ms response time
- Personal library load: < 1s for up to 500 bookmarks

## Dependencies
- #50 KNOWLEDGE-PROMO (team library, separate from personal)
- Audit log infrastructure (Phase 7)

## Definition of Done
- Bookmark, tag, cheatsheet CRUD working
- Personal library UI with filter
- Audit log entries for all mutations
- Unit + integration tests covering RBAC isolation
