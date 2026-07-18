# SPEC-REGULA-AUDITOR-VIEW-001

## Metadata
- Issue: #92
- Status: Completed
- Created: 2026-06-20
- Updated: 2026-07-18
- Priority: High
- Category: Wave 5 — External auditor read-only persona

> **Status 정정 (2026-07-18, #520)**: "Draft" 표기와 달리 실제 구현·라이브 상태
> (`auditor` RBAC 역할 `lib/auth/rbac.ts`, read-only 강제 `lib/auth/with-permission.ts:63`,
> 워터마크 `components/audit/AuditorWatermark.tsx`, migration 0062). 목적 정합성 감사(#520)에서
> 지양-5(SaaS 외판) 인접으로 플래그됐으나, 규제 감사관 read-only 감사 대응은 외판이 아니라
> 21 CFR Part 11 감사 대응이므로 **범위 내로 판정**. CHARTER.md 지양-5에 예외 명시(read-only 강제
> + 초대 범위 한정 + SSO 재사용 3조건). status Draft→Completed 정정.

## Purpose
Provide a dedicated read-only persona for external auditors (FDA inspectors, MFDS reviewers,
BSI/TÜV CE notified body, internal audit department) and a 1-click audit package builder
that compiles all required compliance evidence into a single downloadable bundle.

## Scope
- Covers: Auditor RBAC role, read-only views, 1-click audit package generation
- Out of scope: Auditor authentication (uses existing SSO), write operations of any kind for auditor role

## User Story
As an external FDA inspector, I want read-only access to all compliance records and a
downloadable evidence package so that I can conduct my inspection without requiring
Regula staff to manually compile documents.

## Requirements (EARS format)

WHEN a user is assigned the `auditor` role, THE SYSTEM SHALL grant read-only access to: audit logs, signed answers, compliance reports, and evidence bundles — and SHALL deny all write/delete/update operations.

WHEN an auditor attempts any write operation, THE SYSTEM SHALL return 403 and log the attempt in the audit trail.

WHEN an auditor requests a 1-click audit package, THE SYSTEM SHALL compile: audit log export (date range), signed answer records, citation sources, expert review decisions, and compliance reports into a single ZIP bundle within 60 seconds.

WHEN an audit package is generated, THE SYSTEM SHALL include a package manifest listing: generation timestamp, requester identity, date range, and SHA-256 hash of each included file.

WHEN an auditor views the audit log, THE SYSTEM SHALL display a read-only, paginated, filterable log with: timestamp, event type, actor, record ID, and outcome.

## Acceptance Criteria
1. `auditor` role: read-only access to audit log, signed answers, compliance reports
2. All write operations (POST/PUT/PATCH/DELETE) return 403 for auditor role
3. 403 attempts logged in audit trail with: auditor ID, attempted action, timestamp
4. 1-click audit package: ZIP with audit log export, signed answers, citations, expert reviews, compliance reports
5. Package manifest: generation timestamp, requester, date range, SHA-256 per file
6. Package generation: < 60s for 12-month date range
7. Audit log view: paginated (50/page), filterable by date range / event type / actor
8. Auditor cannot see other users' personal library (#86 scope)

## Non-Functional Requirements
- Auditor role is additive: existing users can be temporarily granted `auditor` role
- No auditor data persists in Regula storage (read-only queries only)
- Package download link expires after 24 hours

## RBAC Constraints
- `auditor` role: read-only, no data mutation under any condition
- Role assignment: only `admin` can grant/revoke `auditor` role
- Role assignment is audit-logged

## Dependencies
- Audit log infrastructure (Phase 7)
- Electronic signature (SPEC-REGULA-ESIG-001) — signed records must be included in audit package
- RBAC system (existing)

## Definition of Done
- Auditor role with 403 on all write endpoints
- 1-click audit package generation working
- Package manifest with SHA-256 hashes
- Package expiry at 24h
- Integration tests: auditor role access control (positive + negative paths)
- E2E test: generate audit package, verify manifest integrity
