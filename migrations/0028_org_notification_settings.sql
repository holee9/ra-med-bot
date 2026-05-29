-- Wave 3 Notifications Hub: org-level webhook settings + notification event log
-- SPEC-REGULA-NOTIFICATIONS-001

CREATE TABLE IF NOT EXISTS org_notification_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slack_webhook_url   TEXT,
  teams_webhook_url   TEXT,
  from_email          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_notification_settings_org_unique UNIQUE (org_id)
);

CREATE INDEX idx_org_notification_org ON org_notification_settings (org_id);

COMMENT ON TABLE org_notification_settings IS
  'Per-org Slack/Teams webhook URLs and sender email. REQ-NOTIFY-003.';
