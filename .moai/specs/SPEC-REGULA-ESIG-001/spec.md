# SPEC-REGULA-ESIG-001

## Metadata
- Issue: #88
- Status: Draft
- Created: 2026-06-20
- Priority: High
- Category: Wave 5 — 21 CFR Part 11 electronic signature

## Purpose
Implement §11.70 (Signature/record linking) and §11.50 (Signature manifestations) requirements
of 21 CFR Part 11 for Regula answer approvals. Phase 7 implemented audit append-only + 7-year
retention; this SPEC adds the electronic signature layer on top.

## Scope
- Covers: Electronic signature on answer approval, signature/record linking, signature manifestation display, answer lock after signing
- Out of scope: Wet-ink signature scanning, PKI certificate management, biometric authentication

## User Story
As a QA Lead, I want to electronically sign approved regulatory answers so that the signature
is permanently linked to the record and non-repudiable, satisfying 21 CFR Part 11 §11.50/§11.70.

## Requirements (EARS format)

WHEN an RA Lead approves an answer, THE SYSTEM SHALL require an electronic signature consisting of: signer identity, date/time, and meaning of signature (e.g., "Approved for regulatory submission").

WHEN a signature is applied, THE SYSTEM SHALL link the signature record to the answer record with a cryptographic hash that prevents post-signature record modification.

WHEN a signed answer is viewed, THE SYSTEM SHALL display the signature manifestation: signer name, title, date/time, and meaning — visible in printed and displayed forms.

WHEN an answer is signed, THE SYSTEM SHALL lock the answer content — no modifications permitted unless the signature is explicitly revoked with audit trail entry.

IF a signature is revoked, THEN THE SYSTEM SHALL require re-signing before the answer can be used for regulatory submission, and SHALL record the revocation in the immutable audit log.

WHEN the audit log is queried, THE SYSTEM SHALL return signature events with: signer_id, timestamp (UTC ISO-8601), meaning, record_hash, and revocation_status.

## Acceptance Criteria
1. Signature captured: identity (user ID + display name + title), timestamp (UTC), meaning text
2. Signature/record link: SHA-256 hash of answer content stored with signature record
3. Post-signature modification attempt returns 403
4. Signature manifestation visible in UI answer view and PDF export
5. Revocation: requires re-sign, revocation recorded in audit log, answer relocked
6. Audit log query returns all required §11.70 fields
7. Signature events use append-only audit log (no delete, no update)

## Non-Functional Requirements (21 CFR Part 11 compliance)
- Audit log: immutable, append-only, 7-year retention (existing infrastructure)
- Timestamp: UTC, synchronized to NTP source, non-falsifiable
- Non-repudiation: signer cannot deny signature after submission
- Signature manifestation: must appear on both displayed and printed forms (§11.50(a))

## Dependencies
- Audit log infrastructure (Phase 7 — append-only, cold storage)
- Expert review / approval workflow (#171 authoring sessions)
- RBAC: only `ra-lead` and `qa-lead` roles can sign

## Definition of Done
- Signature capture, linking, display, and lock working
- Revocation flow working with audit trail
- §11.50 manifestation in UI and PDF export
- §11.70 record/signature linkage with hash
- Integration tests verifying non-repudiation and immutability
