-- SPEC-REGULA-DIGEST-001: weekly digest runs + org digest preferences
CREATE TABLE IF NOT EXISTS org_digest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','biweekly','manual','disabled')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  send_day_of_week INTEGER NOT NULL DEFAULT 1 CHECK (send_day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon
  send_hour INTEGER NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  min_severity TEXT NOT NULL DEFAULT 'medium' CHECK (min_severity IN ('low','medium','high','critical')),
  include_immediate_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_digest_prefs_org_unique UNIQUE (org_id)
);

CREATE TABLE IF NOT EXISTS weekly_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,  -- ISO week: '2026-W23'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  digest_json JSONB NOT NULL DEFAULT '{}',
  email_sent_at TIMESTAMPTZ,
  share_token TEXT UNIQUE,
  CONSTRAINT weekly_digests_org_week_unique UNIQUE (org_id, week_id)
);

CREATE INDEX IF NOT EXISTS idx_org_digest_prefs_org ON org_digest_preferences(org_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_org ON weekly_digests(org_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_share_token ON weekly_digests(share_token) WHERE share_token IS NOT NULL;
