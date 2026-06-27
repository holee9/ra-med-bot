'use client';

// @MX:NOTE ReadinessBadge — displays readiness status with colored dot and label.
// Used in Dashboard/Knowledge to surface honest readiness states (pending/blocked/ready).
// @MX:SPEC Issue #158 (Group B - Readiness surfaces)

type ReadinessStatus = 'ready' | 'pending' | 'blocked';

interface ReadinessBadgeProps {
  status: ReadinessStatus;
  className?: string;
}

const STATUS_STYLES: Record<ReadinessStatus, { dot: string; label: string; badge: string }> = {
  ready: {
    dot: 'bg-success-500',
    label: '준비',
    badge: 'bg-success-50 text-success-700 border-success-200',
  },
  pending: {
    dot: 'bg-amber-500',
    label: '대기 중',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  blocked: {
    dot: 'bg-danger-500',
    label: '차단',
    badge: 'bg-danger-50 text-danger-700 border-danger-200',
  },
};

export function ReadinessBadge({ status, className = '' }: ReadinessBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      {styles.label}
    </span>
  );
}
