// ImpactChip — visual indicator for regulatory update impact scores.
// amber chip: 0.7–0.9, danger chip: >= 0.9
// @MX:SPEC SPEC-REGULA-RADAR-001

interface ImpactChipProps {
  score: number;
  className?: string;
}

export function ImpactChip({ score, className = '' }: ImpactChipProps) {
  if (score < 0.7) return null;

  const isHigh = score >= 0.9;
  const pct = Math.round(score * 100);

  const colorClass = isHigh
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';

  const label = isHigh ? 'High Impact' : 'Medium Impact';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass} ${className}`}
      title={`Impact score: ${pct}%`}
    >
      {isHigh ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-500" />
      ) : (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
      {label} {pct}%
    </span>
  );
}
