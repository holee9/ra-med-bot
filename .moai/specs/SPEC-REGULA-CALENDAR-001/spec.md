# SPEC-REGULA-CALENDAR-001 — Regulatory Calendar & Deadline Management

**Status**: Approved (MVP)
**Issue**: #44
**Wave**: 4
**Created**: 2026-06-21

## 1. Purpose

RA work is structured around regulatory deadlines. Currently these are scattered
across spreadsheets and personal calendars. This SPEC provides a centralized,
project-scoped deadline tracker inside Regula.

## 2. Scope (MVP)

### In scope
- **A. Data model**: `regulatory_deadlines` table with type, jurisdiction, due date, status
- **B. CRUD API**: create / list / update / delete deadlines (project-scoped)
- **C. List view**: `/(app)/calendar` with filtering by project, jurisdiction, type, status

### Out of scope (follow-up)
- Email reminders (sub-feature C of issue #44)
- Holiday-aware clock calculation engine (sub-feature D)
- Auto-generation triggers (510(k) receipt → clock start)
- Month/week calendar grid UI

## 3. Requirements (EARS)

### REQ-CAL-001 (Create)
**WHEN** an ra-lead creates a regulatory deadline for a project, **THE SYSTEM SHALL**
store a `regulatory_deadlines` row with type, jurisdiction, due_date, and status.

### REQ-CAL-002 (Project scoping)
**THE SYSTEM SHALL** scope every deadline to a `projectId`, and enforce project
membership via the standard `project` scope RBAC check.

### REQ-CAL-003 (List + filter)
**WHEN** an ra-member lists deadlines, **THE SYSTEM SHALL** return deadlines for
projects they belong to, filterable by jurisdiction, type, and status, ordered by
due_date ascending.

### REQ-CAL-004 (RBAC)
- `deadline.view` (minRole: ra-member, scope: project) — list + get
- `deadline.manage` (minRole: ra-lead, scope: project) — create + update + delete

### REQ-CAL-005 (Audit)
**THE SYSTEM SHALL** write audit rows for create, update, and delete operations.

### REQ-CAL-006 (Status lifecycle)
**THE SYSTEM SHALL** support statuses: `upcoming`, `due_soon`, `overdue`, `completed`,
`cancelled`. Status is user-set (no automatic computation in MVP).

## 4. Data Model

```sql
CREATE TABLE regulatory_deadlines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  deadline_type TEXT NOT NULL,  -- fda_510k_clock | eu_mdr_cert_expiry | iso13485_surveillance | pmda_reexam | custom
  jurisdiction  TEXT NOT NULL,  -- FDA | EU_MDR | MFDS | PMDA | NMPA | GLOBAL
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming',
  reference     TEXT,           -- submission ID, certificate number, etc.
  notes         TEXT DEFAULT '',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5. API Contract

| Method | Path | Permission |
|--------|------|-----------|
| GET    | `/api/ra/deadlines?projectId=&jurisdiction=&type=&status=` | deadline.view |
| POST   | `/api/ra/deadlines` | deadline.manage |
| GET    | `/api/ra/deadlines/[id]` | deadline.view |
| PATCH  | `/api/ra/deadlines/[id]` | deadline.manage |
| DELETE | `/api/ra/deadlines/[id]` | deadline.manage |

## 6. Acceptance Criteria

- [ ] AC-1: ra-lead can create a deadline → 201 + row in DB
- [ ] AC-2: ra-member can list deadlines for their project
- [ ] AC-3: Non-project-member → 403
- [ ] AC-4: ra-member cannot create/update/delete (manage requires ra-lead) → 403
- [ ] AC-5: Filters by jurisdiction, type, status work
- [ ] AC-6: Audit rows on create/update/delete
- [ ] AC-7: Calendar view renders deadline list with filters
- [ ] AC-8: Unauthenticated → 401
