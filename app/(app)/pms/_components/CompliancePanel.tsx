'use client';
// @MX:NOTE [AUTO] CompliancePanel — Article 83-86 compliance check result display.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-007, AC-06)
// Fetches GET /api/pms/[projectId]/compliance and renders status per article.
// WCAG 2.1 AA: icon + text for every status (color is never the only signal).

import { useEffect, useState } from 'react';

type ArticleStatus = 'satisfied' | 'partial' | 'missing' | 'not_applicable';

interface ArticleResult {
  article: string;
  status: ArticleStatus;
  detail: string;
}

type OverallCompliance = 'compliant' | 'partial' | 'non_compliant';

export interface ComplianceResult {
  overall: OverallCompliance;
  articles: ArticleResult[];
}

interface CompliancePanelProps {
  /** Pre-fetched result (from RSC). When null, shows loading skeleton. */
  result: ComplianceResult | null;
}

const OVERALL_LABELS: Record<
  OverallCompliance,
  { label: string; icon: string; className: string }
> = {
  compliant: { label: '준수', icon: '✓', className: 'bg-success-bg text-success' },
  partial: { label: '부분 준수', icon: '◐', className: 'bg-warn-bg text-warn' },
  non_compliant: { label: '미준수', icon: '✗', className: 'bg-danger-bg text-danger' },
};

const ARTICLE_STATUS: Record<ArticleStatus, { label: string; icon: string; className: string }> = {
  satisfied: { label: '만족', icon: '✓', className: 'bg-success-bg text-success' },
  partial: { label: '부분', icon: '◐', className: 'bg-warn-bg text-warn' },
  missing: { label: '누락', icon: '✗', className: 'bg-danger-bg text-danger' },
  not_applicable: { label: '해당 없음', icon: '—', className: 'bg-ink-100 text-ink-500' },
};

export function CompliancePanel({ result }: CompliancePanelProps) {
  if (!result) {
    return (
      <div
        className="rounded-lg border border-ink-200 bg-white p-6"
        data-testid="pms-compliance-loading"
      >
        <p className="text-sm text-ink-500">컴플라이언스 체크 결과를 불러오는 중...</p>
      </div>
    );
  }

  const overall = OVERALL_LABELS[result.overall];

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-white p-6"
      aria-labelledby="pms-compliance-heading"
    >
      <div>
        <h2 id="pms-compliance-heading" className="font-serif text-xl text-brand-800">
          EU MDR Article 83-86 컴플라이언스 체크
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          사후시장 감시 시스템 요구사항 준수 여부를 확인합니다.
        </p>
      </div>

      {/* Overall status */}
      <div
        className={`inline-flex items-center gap-2 self-start rounded px-3 py-1 text-sm font-semibold ${overall.className}`}
        data-testid="pms-compliance-overall"
      >
        <span aria-hidden="true">{overall.icon}</span>
        전체 상태: {overall.label}
      </div>

      {/* Per-article results */}
      <ul className="flex flex-col gap-2" data-testid="pms-compliance-articles">
        {result.articles.map((article) => {
          const cfg = ARTICLE_STATUS[article.status];
          return (
            <li
              key={article.article}
              className="flex items-start gap-2 rounded border border-ink-150 bg-surface p-3"
              data-testid={`pms-compliance-article-${article.article}`}
            >
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                aria-label={`상태: ${cfg.label}`}
              >
                <span aria-hidden="true">{cfg.icon}</span>
                {cfg.label}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-800">{article.article}</p>
                <p className="text-xs text-ink-600">{article.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
