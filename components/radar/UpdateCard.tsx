// UpdateCard — displays a single regulatory update with optional impact badge.
// @MX:SPEC SPEC-REGULA-RADAR-001

import Link from 'next/link';
import { ImpactChip } from './ImpactChip';

export interface UpdateCardProps {
  id: string;
  title: string;
  region: string;
  publishedAt: Date | string | null;
  severity?: string;
  impactScore?: number | string | null;
  impactTypeHint?: string | null;
  sourceUrl?: string | null;
}

export function UpdateCard({
  id,
  title,
  region,
  publishedAt,
  severity,
  impactScore,
  impactTypeHint,
  sourceUrl,
}: UpdateCardProps) {
  const score =
    impactScore !== null && impactScore !== undefined
      ? Number.parseFloat(String(impactScore))
      : null;
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString('ko-KR') : '—';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/updates/${id}`}
            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
          >
            {title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{region}</span>
            {impactTypeHint && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">
                {impactTypeHint}
              </span>
            )}
            <span>{date}</span>
            {severity && severity !== 'info' && (
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">{severity}</span>
            )}
          </div>
        </div>
        {score !== null && !Number.isNaN(score) && <ImpactChip score={score} />}
      </div>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-xs text-blue-500 hover:underline truncate"
        >
          {sourceUrl}
        </a>
      )}
    </div>
  );
}
