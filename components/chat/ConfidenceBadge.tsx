'use client';

// @MX:NOTE ConfidenceBadge — displays confidence level with colored dot.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-040)

interface ConfidenceBadgeProps {
  level: 'high' | 'med' | 'low';
  score: number;
}

const LEVEL_STYLES: Record<'high' | 'med' | 'low', { dot: string; label: string; badge: string }> =
  {
    high: {
      dot: 'bg-success-500',
      label: 'HIGH',
      badge: 'bg-success-50 text-success-700 border-success-200',
    },
    med: {
      dot: 'bg-amber-500',
      label: 'MED',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    low: {
      dot: 'bg-danger-500',
      label: 'LOW',
      badge: 'bg-danger-50 text-danger-700 border-danger-200',
    },
  };

export function ConfidenceBadge({ level, score }: ConfidenceBadgeProps) {
  const styles = LEVEL_STYLES[level];
  const pct = Math.round(score * 100);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      {styles.label} · {pct}%
    </span>
  );
}
