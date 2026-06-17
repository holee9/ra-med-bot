'use client';
// @MX:SPEC Issue #170
// @MX:ANCHOR: [AUTO] ChecklistShell — central client entry point for checklist feature
// @MX:REASON: [AUTO] Orchestrates all checklist sub-views; expected fan_in >= 3 from page, tests, and future links

import { useState } from 'react';
import { Loader2, ChevronLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useGenerateChecklist,
  useChecklist,
  useUpdateChecklistItem,
  useGapAnalysis,
} from '@/lib/queries/useChecklists';
import type { Checklist, ChecklistItem, GapAnalysisResult } from '@/lib/queries/useChecklists';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

const REQUIREMENT_TYPES = ['FDA 510(k)', 'EU MDR Class IIa', 'MFDS'] as const;

const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  skipped: '건너뜀',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  pending: 'bg-ink-100 text-ink-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  skipped: 'bg-ink-100 text-ink-400',
};

// ---------------------------------------------------------------------------
// GenerateForm
// ---------------------------------------------------------------------------

interface GenerateFormProps {
  onSubmit: (params: {
    product_type: string;
    requirement_type?: string;
    product_name?: string;
  }) => void;
  isPending: boolean;
  error: Error | null;
}

function GenerateForm({ onSubmit, isPending, error }: GenerateFormProps) {
  const [productType, setProductType] = useState('');
  const [requirementType, setRequirementType] = useState('');
  const [productName, setProductName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      product_type: productType.trim(),
      requirement_type: requirementType || undefined,
      product_name: productName.trim() || undefined,
    });
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-ink-800">체크리스트 생성</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product_type" className="text-sm font-medium text-ink-700">
            제품 유형 <span className="text-red-500">*</span>
          </label>
          <input
            id="product_type"
            type="text"
            required
            placeholder="예: 혈당측정기, 인공와우"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="requirement_type" className="text-sm font-medium text-ink-700">
            규제 유형
          </label>
          <select
            id="requirement_type"
            value={requirementType}
            onChange={(e) => setRequirementType(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
          >
            <option value="">선택 안함</option>
            {REQUIREMENT_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {rt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product_name" className="text-sm font-medium text-ink-700">
            제품명 (선택)
          </label>
          <input
            id="product_name"
            type="text"
            placeholder="예: GlucoSense Pro"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-ink-300 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !productType.trim()}
          className="flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? '생성 중...' : '체크리스트 생성'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistItemRow
// ---------------------------------------------------------------------------

interface ChecklistItemRowProps {
  item: ChecklistItem;
  checklistId: string;
}

// @MX:NOTE: [AUTO] ChecklistItemRow — renders individual checklist item with inline status update
function ChecklistItemRow({ item, checklistId }: ChecklistItemRowProps) {
  const { mutate: updateItem, isPending } = useUpdateChecklistItem();

  const handleStatusChange = (status: ItemStatus) => {
    updateItem({ checklistId, itemId: item.id, request: { status } });
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-4 transition-colors',
        item.status === 'completed'
          ? 'border-green-200 bg-green-50'
          : item.status === 'skipped'
            ? 'border-ink-100 bg-ink-50 opacity-60'
            : 'border-ink-200 bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-800">{item.title}</span>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {item.category}
            </span>
            {item.requirement_ref && (
              <span className="text-xs text-ink-400">{item.requirement_ref}</span>
            )}
          </div>
          {item.description && (
            <p className="mt-1 text-xs text-ink-500">{item.description}</p>
          )}
          {item.notes && (
            <p className="mt-1 text-xs italic text-ink-400">메모: {item.notes}</p>
          )}
        </div>

        <div className="shrink-0">
          <select
            value={item.status}
            onChange={(e) => handleStatusChange(e.target.value as ItemStatus)}
            disabled={isPending}
            aria-label={`${item.title} 상태 변경`}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed cursor-pointer',
              STATUS_COLORS[item.status],
            )}
          >
            {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistView
// ---------------------------------------------------------------------------

interface ChecklistViewProps {
  checklistId: string;
  onReset: () => void;
}

function ChecklistView({ checklistId, onReset }: ChecklistViewProps) {
  const { data: checklist, isLoading: checklistLoading, error: checklistError } = useChecklist(checklistId);
  const { data: gapAnalysis, isLoading: gapLoading } = useGapAnalysis(checklistId);

  if (checklistLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-2 text-sm text-ink-500">체크리스트 불러오는 중...</span>
      </div>
    );
  }

  if (checklistError) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{checklistError.message}</span>
      </div>
    );
  }

  if (!checklist) return null;

  const completedCount = checklist.items.filter((i) => i.status === 'completed').length;
  const totalCount = checklist.items.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 transition-colors"
          aria-label="새 체크리스트 생성"
        >
          <ChevronLeft className="h-4 w-4" />
          새 체크리스트
        </button>
        <div className="text-sm text-ink-500">
          {completedCount} / {totalCount} 완료
        </div>
      </div>

      {/* Checklist meta */}
      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-ink-800">{checklist.product_type}</span>
          {checklist.product_name && (
            <span className="text-ink-500">— {checklist.product_name}</span>
          )}
          {checklist.requirement_type && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {checklist.requirement_type}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label="체크리스트 진행률"
            />
          </div>
        </div>
      </div>

      {/* Gap analysis panel */}
      <GapAnalysisPanel gapAnalysis={gapAnalysis} isLoading={gapLoading} />

      {/* Items list */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink-800">항목 ({totalCount})</h2>
        {checklist.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">항목이 없습니다.</p>
        ) : (
          checklist.items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} checklistId={checklist.id} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GapAnalysisPanel
// ---------------------------------------------------------------------------

interface GapAnalysisPanelProps {
  gapAnalysis: GapAnalysisResult | undefined;
  isLoading: boolean;
}

function GapAnalysisPanel({ gapAnalysis, isLoading }: GapAnalysisPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        갭 분석 계산 중...
      </div>
    );
  }

  if (!gapAnalysis) return null;

  const completionRate = gapAnalysis.total_items > 0
    ? Math.round(((gapAnalysis.total_items - gapAnalysis.gap_percentage / 100 * gapAnalysis.total_items) / gapAnalysis.total_items) * 100)
    : 0;

  const gapPercent = Math.round(gapAnalysis.gap_percentage);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-amber-800">갭 분석</h3>

      {/* Gap progress bar */}
      <div className="mb-1 flex items-center justify-between text-xs text-amber-700">
        <span>갭 비율</span>
        <span className="font-medium">{gapPercent}%</span>
      </div>
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${gapPercent}%` }}
          role="progressbar"
          aria-valuenow={gapPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="갭 비율"
        />
      </div>

      {/* Critical gaps */}
      {gapAnalysis.critical_gaps.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-amber-800">
            주요 갭 ({gapAnalysis.critical_gaps.length}건)
          </p>
          <ul className="flex flex-col gap-1">
            {gapAnalysis.critical_gaps.map((gap) => (
              <li key={gap.item_id} className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{gap.title}</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-600">
                  {gap.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {gapAnalysis.recommendations.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-amber-800">권고사항</p>
          <ul className="flex flex-col gap-1">
            {gapAnalysis.recommendations.map((rec, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: recommendation list has no stable ID
              <li key={idx} className="flex items-start gap-1.5 text-xs text-amber-700">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-amber-600">
        완료: {gapAnalysis.completed_items} / {gapAnalysis.total_items} 항목 ({100 - gapPercent}% 충족)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistShell (main export)
// ---------------------------------------------------------------------------

// @MX:ANCHOR: [AUTO] ChecklistShell — top-level state controller for checklist page
// @MX:REASON: [AUTO] Manages active checklist ID and delegates to sub-views; consumed by page and future deep links
export function ChecklistShell() {
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const { mutate: generateChecklist, isPending, error } = useGenerateChecklist();

  const handleGenerate = (params: {
    product_type: string;
    requirement_type?: string;
    product_name?: string;
  }) => {
    generateChecklist(params, {
      onSuccess: (data) => {
        setActiveChecklistId(data.id);
      },
    });
  };

  if (activeChecklistId) {
    return (
      <ChecklistView
        checklistId={activeChecklistId}
        onReset={() => setActiveChecklistId(null)}
      />
    );
  }

  return (
    <GenerateForm
      onSubmit={handleGenerate}
      isPending={isPending}
      error={error}
    />
  );
}
