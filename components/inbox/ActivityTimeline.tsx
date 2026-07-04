// @MX:NOTE [AUTO] ActivityTimeline — ticket metadata timeline (minimal).
// @MX:SPEC SPEC-V3-UI-001 (REQ-V3-UI-012, Issue #320)
// @MX:TODO Full audit timeline requires backend audit_logs fetch API
//         (resource_type='inbox_ticket'). Minimal version shows ticket metadata.
'use client';

import type { TriageState } from '@/lib/domains/inbox/types';

interface ActivityTimelineProps {
  createdAt: string;
  updatedAt: string;
  triageState: TriageState;
  assigneeId?: string | null;
}

interface Activity {
  key: string;
  timestamp: string;
  label: string;
}

export function ActivityTimeline({
  createdAt,
  updatedAt,
  triageState,
  assigneeId,
}: ActivityTimelineProps): React.JSX.Element {
  const activities: Activity[] = [
    { key: 'created', timestamp: createdAt, label: 'Created' },
    { key: 'updated', timestamp: updatedAt, label: 'Updated' },
  ];

  return (
    <section data-testid="activity-timeline" className="space-y-2">
      <h3 className="text-lg font-semibold">Activity</h3>
      <ul className="space-y-1">
        {activities.map((activity) => (
          <li key={activity.key} className="text-sm text-gray-600">
            <time dateTime={activity.timestamp}>
              {new Date(activity.timestamp).toLocaleString()}
            </time>{' '}
            — {activity.label}
          </li>
        ))}
        {assigneeId && (
          <li key="assignee" className="text-sm text-gray-600">
            Assigned: {assigneeId}
          </li>
        )}
      </ul>
      <p className="text-sm font-medium">Current state: {triageState}</p>
    </section>
  );
}
