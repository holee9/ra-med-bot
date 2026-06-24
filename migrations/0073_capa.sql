-- SPEC-REGULA-CAPA-001 (Issue #68) — Complaint → CAPA closed-loop management.
--
-- Adds the 'complaint' workflow_type and 7 complaint/capa audit_action values,
-- plus 5 tables that capture structured complaints (REQ-001), CAPA records
-- with corrective/preventive split (REQ-004/005), root cause analysis with
-- 5 Whys / Fishbone (REQ-003), cross-workflow links (REQ-008 — risk /
-- change_control / DHF / PMS), and effectiveness checks (REQ-006).
--
-- REQ-011 close gate is enforced at the application layer (lib/capa/close-gate.ts)
-- backed by complaints.reportability_status + complaints.vigilance_ref. The
-- gate writes 'capa.close_blocked_vigilance_missing' so the 21 CFR Part 11
-- audit trail distinguishes gate enforcement from successful close.
--
-- All 5 tables inherit the app.current_org_id RLS pattern from 0067-0072.
--
-- Single-file convention: this project uses ONE numbered SQL file per
-- migration (see tests/unit/enterprise-migrations.test.ts).

-- ---------------------------------------------------------------------------
-- 1. workflow_type enum extension (1 value) — REQ-001
-- ---------------------------------------------------------------------------
ALTER TYPE workflow_type ADD VALUE IF NOT EXISTS 'complaint';

-- ---------------------------------------------------------------------------
-- 2. audit_action enum extension (7 values) — REQ-010
--    Every regulated CAPA state transition is recorded (21 CFR Part 11).
--    capa.close_blocked_vigilance_missing records close denial when a
--    reportable complaint lacks a vigilance_ref (REQ-011 gate, H-4 pattern
--    mirroring label.export_blocked / change.export_blocked).
-- ---------------------------------------------------------------------------
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'complaint.intake_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'complaint.reportability_assessed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'capa.record_created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'capa.root_cause_documented';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'capa.effectiveness_scheduled';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'capa.closed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'capa.close_blocked_vigilance_missing';

-- ---------------------------------------------------------------------------
-- 3. complaints — top-level structured complaint intake record
--    REQ-001: structured intake form per project.
--    reportability_status lifecycle: pending → assessed (REQ-002).
--    vigilance_ref links to vigilance_reports.id when reportable (REQ-002).
--    REQ-011 close gate blocks CAPA close when reportable + vigilance_ref NULL.
-- ---------------------------------------------------------------------------
CREATE TABLE complaints (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_run_id      UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  -- Structured intake payload (device, event, reporter, lot, etc.)
  intake_data          JSONB NOT NULL DEFAULT '{}',
  -- REQ-002: reportability assessment result
  reportability_status TEXT NOT NULL DEFAULT 'pending'
                         CHECK (reportability_status IN ('pending','reportable','not_reportable')),
  -- REQ-002/011: link to vigilance_reports when reportable
  vigilance_ref        UUID,
  -- REQ-007: trend detection signature for repeat complaints
  trend_signature      TEXT,
  created_by           UUID NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_complaints_project ON complaints (project_id);
CREATE INDEX idx_complaints_org ON complaints (org_id);
CREATE INDEX idx_complaints_reportability ON complaints (reportability_status);
CREATE INDEX idx_complaints_trend ON complaints (org_id, trend_signature);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_complaints"
  ON complaints
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 4. capa_records — corrective AND preventive action records (split)
--    REQ-004: corrective (reactive to existing problem) vs preventive
--    (proactive to potential problem) tracked separately.
--    REQ-005: owner, due_date, effectiveness_status per record.
--    status lifecycle: open → in_progress → pending_effectiveness → closed.
--    effectiveness_status lifecycle: pending → passed / failed (REQ-006).
-- ---------------------------------------------------------------------------
CREATE TABLE capa_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  complaint_id         UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  -- REQ-004: corrective vs preventive
  type                 TEXT NOT NULL CHECK (type IN ('corrective','preventive')),
  description          TEXT NOT NULL,
  -- REQ-005: assigned owner + due date + effectiveness tracking
  owner_id             UUID NOT NULL REFERENCES users(id),
  due_date             DATE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','pending_effectiveness','closed','cancelled')),
  effectiveness_status TEXT NOT NULL DEFAULT 'pending'
                         CHECK (effectiveness_status IN ('pending','passed','failed')),
  -- REQ-010: close signature metadata (ESIG)
  closed_by            UUID REFERENCES users(id),
  closed_at            TIMESTAMPTZ,
  close_signature_hash TEXT,
  created_by           UUID NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capa_records_complaint ON capa_records (complaint_id);
CREATE INDEX idx_capa_records_org ON capa_records (org_id);
CREATE INDEX idx_capa_records_project ON capa_records (project_id);
CREATE INDEX idx_capa_records_status ON capa_records (status);
CREATE INDEX idx_capa_records_owner ON capa_records (owner_id);

ALTER TABLE capa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_capa_records"
  ON capa_records
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 5. capa_root_causes — RCA records (5 Whys / Fishbone)
--    REQ-003: structured root cause analysis per CAPA.
--    method: '5whys' (why1-5 chain) or 'fishbone' (6M categories).
--    analysis_data stores the method-specific structure as JSONB.
-- ---------------------------------------------------------------------------
CREATE TABLE capa_root_causes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id       UUID NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  method        TEXT NOT NULL CHECK (method IN ('5whys','fishbone')),
  analysis_data JSONB NOT NULL DEFAULT '{}',
  summary       TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capa_root_causes_capa ON capa_root_causes (capa_id);
CREATE INDEX idx_capa_root_causes_org ON capa_root_causes (org_id);

ALTER TABLE capa_root_causes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_capa_root_causes"
  ON capa_root_causes
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 6. capa_links — cross-workflow traceability links (REQ-008)
--    Links a CAPA to risk_items (#46), change_assessments (#54),
--    design_history_files (#64), or pms_reports (#53).
--    target_type identifies the linked table; target_id is the row UUID.
--    AC-03: link integrity — every CAPA must have ≥1 link to closed-loop.
-- ---------------------------------------------------------------------------
CREATE TABLE capa_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id     UUID NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('risk','change_control','dhf','pms')),
  target_id   TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (capa_id, target_type, target_id)
);

CREATE INDEX idx_capa_links_capa ON capa_links (capa_id);
CREATE INDEX idx_capa_links_target ON capa_links (target_type, target_id);
CREATE INDEX idx_capa_links_org ON capa_links (org_id);

ALTER TABLE capa_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_capa_links"
  ON capa_links
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- 7. capa_effectiveness_checks — scheduled effectiveness verification
--    REQ-006: each CAPA with effectiveness_status='pending' gets a scheduled
--    check. Inngest cron (lib/inngest/capa/effectiveness-due-reminder.ts)
--    fires daily to notify the owner when due_date passes.
--    result lifecycle: NULL (pending) → 'effective' / 'ineffective'.
-- ---------------------------------------------------------------------------
CREATE TABLE capa_effectiveness_checks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id    UUID NOT NULL REFERENCES capa_records(id) ON DELETE CASCADE,
  due_date   DATE NOT NULL,
  checked_at TIMESTAMPTZ,
  result     TEXT CHECK (result IN ('effective','ineffective')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capa_effectiveness_capa ON capa_effectiveness_checks (capa_id);
CREATE INDEX idx_capa_effectiveness_org ON capa_effectiveness_checks (org_id);
CREATE INDEX idx_capa_effectiveness_due ON capa_effectiveness_checks (due_date);

ALTER TABLE capa_effectiveness_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_capa_effectiveness_checks"
  ON capa_effectiveness_checks
  USING (org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
