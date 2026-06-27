'use client';

// @MX:NOTE TrustPanel — aggregated trust signals panel (confidence, evidence, review, trace).
// Collapsible by default; expands when confidence low or no sources.
// @MX:SPEC Issue #158 (REQ-158-001)

import { ChevronDown, ChevronRight, FileText, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import type { ConfidenceEvent, RagRouteEvent, SourceItem } from '../../types/streaming';
import { ConfidenceBadge } from './ConfidenceBadge';
import { RagRouteBadge } from './RagRouteBadge';

interface TrustPanelProps {
  confidence?: ConfidenceEvent;
  sources?: SourceItem[];
  reviewStatus?: 'approved' | 'pending' | 'none';
  signatureExists?: boolean;
  ragRoute?: RagRouteEvent;
}

const CONFIDENCE_THRESHOLD = 0.7;

export function TrustPanel({
  confidence,
  sources = [],
  reviewStatus = 'none',
  signatureExists = false,
  ragRoute,
}: TrustPanelProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    // Auto-expand if confidence is low or no sources
    const confidenceLow = confidence?.score ? confidence.score < CONFIDENCE_THRESHOLD : false;
    const noSources = sources.length === 0;
    return confidenceLow || noSources;
  });

  const sourceCount = sources.length;
  const approved = reviewStatus === 'approved';
  const reviewPending = reviewStatus === 'pending';

  // Count sources by provenance type
  const provenanceBreakdown = sources.reduce(
    (acc, src) => {
      acc[src.type] = (acc[src.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-ink-100"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-semibold text-ink-800">신뢰 정보</span>
        {isExpanded ? (
          <ChevronDown size={16} className="text-ink-500" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="text-ink-500" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-ink-200 px-4 py-3 space-y-2.5">
          {/* Confidence row */}
          {confidence && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-ink-700">
                <Zap size={14} className="text-amber-600" aria-hidden="true" />
                <span>신뢰도</span>
              </div>
              <ConfidenceBadge level={confidence.level} score={confidence.score} />
            </div>
          )}

          {/* Evidence row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <FileText size={14} className="text-brand-600" aria-hidden="true" />
              <span>증거</span>
            </div>
            <div className="text-right">
              {sourceCount > 0 ? (
                <div className="text-sm text-ink-600">
                  <span className="font-medium">{sourceCount}</span>
                  <span className="text-ink-500"> 출처</span>
                </div>
              ) : null}
              {Object.keys(provenanceBreakdown).length > 0 && (
                <div className="mt-0.5 text-xs text-ink-500">
                  {Object.entries(provenanceBreakdown)
                    .slice(0, 2)
                    .map(([type, count]) => `${type} ${count}`)
                    .join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* Review row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <ShieldCheck
                size={14}
                className={approved ? 'text-success-600' : 'text-ink-400'}
                aria-hidden="true"
              />
              <span>전문가 검토</span>
            </div>
            <div className="text-right">
              {approved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                  <span>검토 완료</span>
                  {signatureExists && <span className="text-success-500">(§11.50 서명)</span>}
                </span>
              )}
              {reviewPending && <span className="text-xs text-amber-700">검토 대기중</span>}
              {!approved && !reviewPending && <span className="text-xs text-ink-500">미검토</span>}
            </div>
          </div>

          {/* Trace row */}
          {ragRoute && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-ink-700">
                <FileText size={14} className="text-brand-600" aria-hidden="true" />
                <span>지식 범위</span>
              </div>
              <RagRouteBadge route={ragRoute} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
