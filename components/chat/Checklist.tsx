'use client';

// @MX:NOTE Checklist component — 16x16 checkboxes with ref badge and optimistic update.
// Debounces PATCH requests to avoid rapid-fire API calls (300ms).
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-019~021)

import { useCallback, useRef, useState } from 'react';
import type { ChecklistItem } from '../../types/streaming';
import { ExportButton } from '../export/ExportButton';
import { useExportState } from '../export/useExportState';

interface ChecklistProps {
  blockId: string;
  messageId: string;
  items: ChecklistItem[];
  readOnly?: boolean;
}

export function Checklist({
  blockId,
  messageId,
  items: initialItems,
  readOnly = false,
}: ChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { state: exportState, setLoading, setSuccess, setError } = useExportState();

  const handleExport = async () => {
    setLoading();
    try {
      // TODO: Implement actual export logic via ExportHub
      const result = {
        filename: `checklist-${messageId}.txt`,
        size: JSON.stringify(items).length
      };
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Export failed'));
    }
  };

  const persistItems = useCallback(
    async (updatedItems: ChecklistItem[]) => {
      try {
        const res = await fetch(`/api/ra/messages/${messageId}/blocks/${blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'checklist', items: updatedItems }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch {
        // Roll back optimistic update
        setItems(initialItems);
        setToastMessage('체크리스트 저장 실패 — 다시 시도하세요');
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [blockId, messageId, initialItems],
  );

  const handleToggle = useCallback(
    (itemId: string) => {
      if (readOnly) return;

      // Optimistic update
      const updated = items.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );
      setItems(updated);

      // Debounce PATCH — 300ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persistItems(updated);
      }, 300);
    },
    [items, readOnly, persistItems],
  );

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div className="flex flex-col gap-2">
      {toastMessage && (
        <div role="alert" className="rounded bg-accent-100 px-3 py-2 text-sm text-accent-700">
          {toastMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">
          {completedCount}/{items.length} 완료
        </p>
        <ExportButton
          onClick={handleExport}
          disabled={exportState === 'loading'}
          isOpen={exportState === 'loading'}
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              id={`checklist-${item.id}`}
              checked={item.completed}
              disabled={readOnly}
              onChange={() => handleToggle(item.id)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border border-ink-300 accent-brand-500 disabled:cursor-not-allowed"
              aria-label={item.title}
            />
            <label
              htmlFor={`checklist-${item.id}`}
              className="flex flex-wrap items-center gap-2 text-sm text-ink-800"
            >
              <span className={item.completed ? 'line-through text-ink-400' : ''}>
                {item.title}
              </span>
              {item.ref && (
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-600">
                  {item.ref}
                </code>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
