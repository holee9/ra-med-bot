'use client';

// @MX:NOTE [AUTO] TopbarClient — T-007 (REQ-ENTERPRISE-028), T-008 (REQ-ENTERPRISE-035).
// Manual flag button: opens dialog to flag current conversation for expert review.
// ThemeToggle: allows switching between light and dark modes.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-028, REQ-ENTERPRISE-035)

import { useState } from 'react';
import { LocaleToggle } from './LocaleToggle';
import ThemeToggle from './ThemeToggle';

interface FlagDialogState {
  open: boolean;
  reason: string;
  submitting: boolean;
}

export default function TopbarClient() {
  const [dialog, setDialog] = useState<FlagDialogState>({
    open: false,
    reason: '',
    submitting: false,
  });

  const openDialog = () => setDialog((prev) => ({ ...prev, open: true }));
  const closeDialog = () => setDialog({ open: false, reason: '', submitting: false });

  const handleSubmit = async () => {
    if (!dialog.reason.trim()) return;
    setDialog((prev) => ({ ...prev, submitting: true }));

    try {
      await fetch('/api/ra/expert-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'current', // Wired to real context in later phase
          messageId: 'current',
          reason: dialog.reason,
        }),
      });
    } catch {
      // Non-critical; silently fail
    } finally {
      closeDialog();
    }
  };

  return (
    <>
      <LocaleToggle />
      <ThemeToggle />
      <button
        type="button"
        aria-label="전문가 검토 요청"
        data-testid="topbar-flag-button"
        onClick={openDialog}
        className="rounded-md border border-ink-200 px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50"
      >
        🚩
      </button>

      {dialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <dialog
            open
            aria-label="전문가 검토 요청"
            className="m-0 w-full max-w-sm rounded-lg border-0 bg-surface p-6 shadow-lg"
          >
            <h2 className="mb-3 text-base font-semibold text-ink-800">전문가 검토 요청</h2>
            <textarea
              aria-label="검토 사유"
              value={dialog.reason}
              onChange={(e) => setDialog((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="검토가 필요한 이유를 입력해 주세요"
              className="mb-3 h-24 w-full resize-none rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={dialog.submitting || !dialog.reason.trim()}
                className="rounded-md bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {dialog.submitting ? '제출 중…' : '제출'}
              </button>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
}
