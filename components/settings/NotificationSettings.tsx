'use client';

// @MX:NOTE [AUTO] NotificationSettings — user-level notification preference toggle UI.
// @MX:SPEC SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-002)

import { useEffect, useState } from 'react';

const EVENT_LABELS: Record<string, string> = {
  expert_review_assigned: 'Expert Review 할당',
  expert_review_sla_warning: 'Expert Review SLA 임박 (24h)',
  regulatory_update_high_risk: '규제 업데이트 (고위험)',
  regulatory_update_weekly_digest: '규제 업데이트 주간 다이제스트',
  workflow_completed: '워크플로우 완료',
  batch_query_completed: '배치 질의 완료',
  knowledge_gap_detected: '지식 갭 감지',
};

type ChannelPrefs = { email: boolean; slack: boolean };
type Prefs = Record<string, ChannelPrefs>;

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch('/api/ra/notifications/preferences')
      .then((r) => r.json())
      .then((data: { preferences: Prefs }) => setPrefs(data.preferences));
  }, []);

  async function handleToggle(event: string, channel: 'email' | 'slack', value: boolean) {
    if (!prefs) return;
    const updated: Prefs = { ...prefs, [event]: { email: (prefs[event]?.email ?? false), slack: (prefs[event]?.slack ?? false), [channel]: value } };
    setPrefs(updated);

    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/ra/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { [event]: { [channel]: value } } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <div data-testid="notification-settings-loading" className="py-4 text-sm text-ink-400">
        알림 설정을 불러오는 중…
      </div>
    );
  }

  return (
    <div data-testid="notification-settings" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-700">알림 채널</p>
        <div className="flex gap-4 text-xs font-medium text-ink-500">
          <span className="w-10 text-center">이메일</span>
          <span className="w-10 text-center">Slack</span>
        </div>
      </div>

      {Object.entries(EVENT_LABELS).map(([event, label]) => {
        const ch = prefs[event] ?? { email: false, slack: false };
        return (
          <div key={event} className="flex items-center justify-between rounded-lg border border-border-weak bg-surface-soft px-4 py-3">
            <span className="text-sm text-ink-700">{label}</span>
            <div className="flex gap-4">
              <input
                type="checkbox"
                data-testid={`notification-${event}-email`}
                checked={ch.email}
                onChange={(e) => void handleToggle(event, 'email', e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-brand-600"
              />
              <input
                type="checkbox"
                data-testid={`notification-${event}-slack`}
                checked={ch.slack}
                onChange={(e) => void handleToggle(event, 'slack', e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-brand-600"
              />
            </div>
          </div>
        );
      })}

      {saving && (
        <p className="text-xs text-ink-400">저장 중…</p>
      )}
      {saved && (
        <p data-testid="notification-settings-saved" className="text-xs text-green-600">
          저장됨
        </p>
      )}
    </div>
  );
}
